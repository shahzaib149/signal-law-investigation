import { NextResponse } from 'next/server'

const XPR_BASE = 'https://xprmedia.binwus.com/api/distribution/content-sources'

export async function POST(req: Request) {
  const XPR_API_KEY  = process.env.XPR_API_KEY
  const XPR_BOOST_ID = process.env.XPR_BOOST_ID

  if (!XPR_API_KEY || !XPR_BOOST_ID) {
    return NextResponse.json({ error: 'XPR credentials not configured' }, { status: 500 })
  }

  let body: { title?: string; summary?: string; content?: string; link?: string; imageUrl?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, summary, content, link, imageUrl } = body
  if (!title || !link) {
    return NextResponse.json({ error: 'title and link are required' }, { status: 400 })
  }

  const item = {
    title,
    summary:     summary ?? '',
    content:     content ?? `<p>${summary ?? ''}</p>`,
    link,
    author:      'Signal Law Group',
    publishedAt: new Date().toISOString(),
    guid:        link,
    categories:  ['Legal', 'Press Releases', 'Business'],
    ...(imageUrl ? { imageUrl } : {}),
  }

  try {
    const res  = await fetch(`${XPR_BASE}/precheck?publicId=${XPR_BOOST_ID}&apiKey=${XPR_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ items: [item] }),
    })
    const data: Record<string, unknown> = await res.json()

    if (!res.ok) {
      const msg = String(data?.message ?? data?.error ?? 'Precheck failed')
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    // XPR precheck response: { success, fields, failedFilters, aiAnalysis: { score, classification, summary } }
    const ai    = (data?.aiAnalysis ?? {}) as Record<string, unknown>
    const score = Number(ai?.score ?? 0)
    const passed = score >= 70

    return NextResponse.json({
      passed,
      score,
      classification: String(ai?.classification ?? ''),
      summary:        String(ai?.summary        ?? ''),
      failedFilters:  Array.isArray(data?.failedFilters) ? data.failedFilters : [],
    })
  } catch (err) {
    console.error('[xpr-validate] error:', err)
    return NextResponse.json({ error: 'Precheck request failed' }, { status: 502 })
  }
}
