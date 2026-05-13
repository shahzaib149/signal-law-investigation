import { NextResponse } from 'next/server'
import { categoriesFromInvestigation } from '@/lib/xpr-categories'
import { deriveXprStoryGuid } from '@/lib/xpr-item'
import { prepareXprContentForItem } from '@/lib/xpr-content'
import { logXpr, logXprJsonFull, redactXprUrl, xprDebugLogsEnabled } from '@/lib/xpr-debug'

const XPR_BASE = 'https://xprmedia.binwus.com/api/distribution/content-sources'
const FETCH_TIMEOUT_MS = 60_000

const XPR_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'SignalLawDashboard/1.0',
} as const

export async function POST(req: Request) {
  const XPR_API_KEY = process.env.XPR_API_KEY
  const XPR_BOOST_ID = process.env.XPR_BOOST_ID

  if (!XPR_API_KEY || !XPR_BOOST_ID) {
    return NextResponse.json({ error: 'XPR credentials not configured' }, { status: 500 })
  }

  let body: {
    title?: string
    summary?: string
    content?: string
    link?: string
    imageUrl?: string
    guid?: string
    slug?: string
    publishedAt?: string
    categories?: string[]
    investigationCategory?: string
    /** When true, API echoes full XPR precheck JSON for browser / tooling analysis. */
    includeXprRaw?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    title,
    summary,
    content,
    link,
    imageUrl,
    guid: bodyGuid,
    slug,
    publishedAt,
    categories: bodyCategories,
    investigationCategory,
    includeXprRaw,
  } = body

  const echoXprRaw = Boolean(includeXprRaw)

  if (!title || !link) {
    return NextResponse.json({ error: 'title and link are required' }, { status: 400 })
  }

  const summaryStr = summary ?? ''
  const storyGuid = deriveXprStoryGuid(link, slug, bodyGuid)
  const published =
    publishedAt?.trim() && !Number.isNaN(Date.parse(publishedAt))
      ? new Date(publishedAt).toISOString()
      : new Date().toISOString()

  const categories =
    Array.isArray(bodyCategories) && bodyCategories.length > 0
      ? bodyCategories
      : categoriesFromInvestigation(investigationCategory)

  const contentHtml = prepareXprContentForItem(content, summaryStr, title)

  if (xprDebugLogsEnabled()) {
    logXpr('validate/incoming-from-dashboard', {
      title: title.slice(0, 120),
      link,
      storyGuid,
      published,
      slug,
      categories,
      imageUrl: imageUrl ? '[set]' : undefined,
      summaryLength: summaryStr.length,
      contentLength: contentHtml.length,
    })
  }

  const item: Record<string, unknown> = {
    title,
    summary: summaryStr,
    content: contentHtml,
    link,
    author: 'Signal Law Group',
    publishedAt: published,
    guid: storyGuid,
    categories,
  }

  if (imageUrl && String(imageUrl).trim().length > 0) {
    item.imageUrl = imageUrl.trim()
  }

  const xprUrl = `${XPR_BASE}/precheck?publicId=${XPR_BOOST_ID}&apiKey=${XPR_API_KEY}`
  const outboundBody = { items: [item] }

  if (xprDebugLogsEnabled()) {
    logXpr('validate/outbound-to-xpr-precheck', {
      method: 'POST',
      url: redactXprUrl(xprUrl),
    })
    logXprJsonFull('validate/outbound-to-xpr-precheck-body-full', 'JSON body sent to XPR precheck', outboundBody)
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(xprUrl, {
      method: 'POST',
      headers: XPR_HEADERS,
      body: JSON.stringify(outboundBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    const text = await res.text()
    let data: Record<string, unknown> = {}
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      data = { _parseError: true, _raw: text }
    }

    if (xprDebugLogsEnabled()) {
      logXprJsonFull('validate/xpr-precheck-response-body-full', `HTTP ${res.status} (precheck)`, data)
    }

    if (!res.ok) {
      const msg = String(data?.message ?? data?.error ?? 'Precheck failed')
      return NextResponse.json({ error: msg, xpr: data }, { status: res.status })
    }

    if (data.success === false) {
      return NextResponse.json(
        {
          error: String(data.message ?? data.error ?? 'Precheck rejected'),
          passed: false,
          score: 0,
          xpr: data,
        },
        { status: 400 }
      )
    }

    const ai = (data?.aiAnalysis ?? {}) as Record<string, unknown>
    const score = Number(ai?.score ?? 0)
    const passed = score >= 70

    const payload: Record<string, unknown> = {
      passed,
      score,
      classification: String(ai?.classification ?? ''),
      summary: String(ai?.summary ?? ''),
      failedFilters: Array.isArray(data?.failedFilters) ? data.failedFilters : [],
      storyGuid,
      xprSuccess: Boolean(data.success),
    }
    if (echoXprRaw) payload.xpr = data

    return NextResponse.json(payload)
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    console.error('[xpr-validate] error:', err)
    return NextResponse.json(
      { error: timedOut ? 'Precheck request timed out' : 'Precheck request failed' },
      { status: timedOut ? 504 : 502 }
    )
  }
}
