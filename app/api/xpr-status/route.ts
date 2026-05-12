import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const XPR_API_KEY = process.env.XPR_API_KEY
  if (!XPR_API_KEY) {
    return NextResponse.json({ error: 'XPR_API_KEY is not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const link = searchParams.get('link')

  if (!link) {
    return NextResponse.json({ error: 'link parameter is required' }, { status: 400 })
  }

  let domain: string
  let guid:   string
  let secure: string

  try {
    const u = new URL(link)
    domain = u.hostname
    guid   = encodeURIComponent(u.pathname + (u.search || ''))
    secure = u.protocol === 'https:' ? 'yes' : 'no'
  } catch {
    return NextResponse.json({ error: 'invalid link URL' }, { status: 400 })
  }

  const url = `https://xprmedia.binwus.com/api/distribution/story-status-check` +
    `?apiKey=${XPR_API_KEY}&secure=${secure}&domain=${domain}&guid=${guid}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal }).finally(() => clearTimeout(timer))

    if (res.status === 404) {
      return NextResponse.json({ total: 0, live: 0, pending: 0, publishers: [] })
    }

    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!res.ok) {
      console.error(`[xpr-status] XPR returned ${res.status}:`, text)
      return NextResponse.json({ error: `XPR API error (${res.status})` }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    console.error('[xpr-status] fetch error:', err)
    if (isTimeout) return NextResponse.json({ total: 0, live: 0, pending: 0, publishers: [], timedOut: true })
    return NextResponse.json({ error: 'Failed to reach XPR API' }, { status: 502 })
  }
}
