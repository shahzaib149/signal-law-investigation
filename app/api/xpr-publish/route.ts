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

const PACKAGE_IDS: Record<string, () => string | undefined> = {
  boost: () => process.env.XPR_BOOST_ID,
  'boost+': () => process.env.XPR_BOOST_PLUS_ID,
  'boost-pro': () => process.env.XPR_BOOST_PRO_ID,
}

export async function POST(req: Request) {
  const XPR_API_KEY = process.env.XPR_API_KEY
  if (!XPR_API_KEY) {
    return NextResponse.json({ error: 'XPR_API_KEY not configured' }, { status: 500 })
  }

  let body: {
    title?: string
    summary?: string
    content?: string
    link?: string
    imageUrl?: string
    packageId?: string
    guid?: string
    slug?: string
    publishedAt?: string
    categories?: string[]
    investigationCategory?: string
    /** Echo full XPR ingest JSON in our API response (for DevTools / analysis). */
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
    packageId,
    guid: bodyGuid,
    slug,
    publishedAt,
    categories: bodyCategories,
    investigationCategory,
    includeXprRaw,
  } = body

  const echoXprRaw = Boolean(includeXprRaw)

  if (!title || !link || !packageId) {
    return NextResponse.json({ error: 'title, link, and packageId are required' }, { status: 400 })
  }

  const resolveId = PACKAGE_IDS[packageId.toLowerCase()]
  if (!resolveId) {
    return NextResponse.json({ error: `Unknown package: ${packageId}` }, { status: 400 })
  }
  const publicId = resolveId()
  if (!publicId) {
    return NextResponse.json({ error: `Package ${packageId} is not configured` }, { status: 500 })
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
    logXpr('publish/incoming-from-dashboard', {
      packageId,
      title: title.slice(0, 120),
      link,
      storyGuid,
      published,
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

  const xprUrl = `${XPR_BASE}/ingest?publicId=${publicId}&apiKey=${XPR_API_KEY}`
  const outboundBody = { items: [item] }

  if (xprDebugLogsEnabled()) {
    logXpr('publish/outbound-to-xpr-ingest', {
      method: 'POST',
      url: redactXprUrl(xprUrl),
    })
    logXprJsonFull('publish/outbound-to-xpr-ingest-body-full', 'JSON body sent to XPR ingest', outboundBody)
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
      logXprJsonFull('publish/xpr-ingest-response-body-full', `HTTP ${res.status} (ingest)`, data)
    }

    if (!res.ok) {
      const msg = String(data?.message ?? data?.error ?? 'Ingest failed')
      const errBody: Record<string, unknown> = { error: msg, xpr: data }
      return NextResponse.json(errBody, { status: res.status })
    }

    const okPayload: Record<string, unknown> = {
      success: true,
      message: String(data?.message ?? 'Successfully submitted to publishers'),
      storyGuid,
    }
    if (echoXprRaw) okPayload.xpr = data

    return NextResponse.json(okPayload)
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    console.error('[xpr-publish] error:', err)
    return NextResponse.json(
      { error: timedOut ? 'Ingest request timed out' : 'Ingest request failed' },
      { status: timedOut ? 504 : 502 }
    )
  }
}
