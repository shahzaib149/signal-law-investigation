import { NextResponse } from 'next/server'
import { deriveXprStoryGuid, legacyPathGuidRaw } from '@/lib/xpr-item'
import { logXpr, logXprJsonFull, logXprTextFull, redactXprUrl, xprDebugLogsEnabled } from '@/lib/xpr-debug'

const XPR_STATUS_BASE = 'https://xprmedia.binwus.com/api/distribution/story-status-check'
const FETCH_TIMEOUT_MS = 25_000

const XPR_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'SignalLawDashboard/1.0',
} as const

function isEmptyStoryPayload(d: Record<string, unknown>): boolean {
  const tw = Number(d.totalWebsites ?? d.total ?? d.totalCount ?? 0)
  const pub = Number(d.published ?? d.live ?? d.liveCount ?? 0)
  const pend = Number(d.pending ?? d.pendingCount ?? 0)
  const pubs = d.publishers ?? d.liveAt ?? d.items
  const plen = Array.isArray(pubs) ? pubs.length : 0
  return tw === 0 && pub === 0 && pend === 0 && plen === 0
}

async function fetchStoryStatusRaw(
  apiKey: string,
  secure: string,
  domain: string,
  guidRaw: string
): Promise<{ res: Response; text: string; requestUrlRedacted: string }> {
  const guidEnc = encodeURIComponent(guidRaw)
  const url = `${XPR_STATUS_BASE}?apiKey=${apiKey}&secure=${secure}&domain=${domain}&guid=${guidEnc}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: XPR_HEADERS,
    })
    const text = await res.text()
    return { res, text, requestUrlRedacted: redactXprUrl(url) }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(req: Request) {
  const XPR_API_KEY = process.env.XPR_API_KEY
  if (!XPR_API_KEY) {
    return NextResponse.json({ error: 'XPR_API_KEY is not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const link = searchParams.get('link')
  const explicitGuid = searchParams.get('guid')?.trim() || undefined
  const slug = searchParams.get('slug')?.trim() || undefined

  if (!link) {
    return NextResponse.json({ error: 'link parameter is required' }, { status: 400 })
  }

  let domain: string
  let secure: string
  try {
    const u = new URL(link)
    domain = u.hostname
    secure = u.protocol === 'https:' ? 'yes' : 'no'
  } catch {
    return NextResponse.json({ error: 'invalid link URL' }, { status: 400 })
  }

  const primaryGuid = deriveXprStoryGuid(link, slug, explicitGuid)
  const legacyGuid = legacyPathGuidRaw(link)
  const tryGuids = explicitGuid
    ? [primaryGuid]
    : Array.from(new Set([primaryGuid, legacyGuid]))

  if (xprDebugLogsEnabled()) {
    logXpr('status/incoming', { link, domain, secure, slug, explicitGuid, tryGuids })
  }

  let lastHttpError: { status: number; text: string } | undefined

  for (let i = 0; i < tryGuids.length; i++) {
    const guidRaw = tryGuids[i]!

    if (xprDebugLogsEnabled()) {
      logXpr('status/outbound-to-xpr', {
        method: 'GET',
        domain,
        secure,
        guidRaw,
      })
    }

    try {
      const { res, text, requestUrlRedacted } = await fetchStoryStatusRaw(XPR_API_KEY, secure, domain, guidRaw)

      if (xprDebugLogsEnabled()) {
        logXpr('status/outbound-url-full', requestUrlRedacted)
        logXprTextFull('status/xpr-response-raw-body', `HTTP ${res.status} (guid=${guidRaw})`, text)
      }

      if (res.status === 404) {
        if (xprDebugLogsEnabled()) {
          logXpr('status/xpr-response-meta', { guidRaw, httpStatus: 404, note: 'empty or unknown guid' })
        }
        continue
      }

      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        data = { parseError: true, raw: text }
      }

      if (xprDebugLogsEnabled()) {
        logXprJsonFull('status/xpr-response-parsed-json', `HTTP ${res.status} (guid=${guidRaw})`, data)
      }

      if (!res.ok) {
        lastHttpError = { status: res.status, text: text.slice(0, 800) }
        console.error(`[xpr-status] XPR ${res.status} guid=${guidRaw}:`, text.slice(0, 400))
        continue
      }

      const obj = data as Record<string, unknown>

      const shouldTryLegacy =
        !explicitGuid &&
        tryGuids.length > 1 &&
        guidRaw === primaryGuid &&
        legacyGuid !== primaryGuid &&
        isEmptyStoryPayload(obj)

      if (shouldTryLegacy) {
        if (xprDebugLogsEnabled()) {
          logXpr('status/primary-empty-retry-legacy-path', { primaryGuid, legacyGuid })
        }
        continue
      }

      return NextResponse.json(data)
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      console.error('[xpr-status] fetch error:', err)
      if (isTimeout) {
        return NextResponse.json({
          total: 0,
          live: 0,
          pending: 0,
          publishers: [],
          timedOut: true,
        })
      }
      return NextResponse.json({ error: 'Failed to reach XPR API' }, { status: 502 })
    }
  }

  if (lastHttpError) {
    return NextResponse.json(
      { error: `XPR API error (${lastHttpError.status})`, detail: lastHttpError.text },
      { status: lastHttpError.status >= 400 && lastHttpError.status < 600 ? lastHttpError.status : 502 }
    )
  }

  return NextResponse.json({ total: 0, live: 0, pending: 0, publishers: [] })
}
