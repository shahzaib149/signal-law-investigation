import { NextResponse } from 'next/server'

const XPR_BASE = 'https://xprmedia.binwus.com/api/distribution/content-sources'

const PACKAGE_IDS: Record<string, () => string | undefined> = {
  'boost':     () => process.env.XPR_BOOST_ID,
  'boost+':    () => process.env.XPR_BOOST_PLUS_ID,
  'boost-pro': () => process.env.XPR_BOOST_PRO_ID,
}

export async function POST(req: Request) {
  const XPR_API_KEY = process.env.XPR_API_KEY
  if (!XPR_API_KEY) {
    return NextResponse.json({ error: 'XPR_API_KEY not configured' }, { status: 500 })
  }

  let body: {
    title?: string; summary?: string; content?: string
    link?: string; imageUrl?: string; packageId?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, summary, content, link, imageUrl, packageId } = body
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
    const res  = await fetch(`${XPR_BASE}/ingest?publicId=${publicId}&apiKey=${XPR_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ items: [item] }),
    })
    const data: Record<string, unknown> = await res.json()

    if (!res.ok) {
      const msg = String(data?.message ?? data?.error ?? 'Ingest failed')
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    return NextResponse.json({
      success: true,
      message: String(data?.message ?? 'Successfully submitted to publishers'),
    })
  } catch (err) {
    console.error('[xpr-publish] error:', err)
    return NextResponse.json({ error: 'Ingest request failed' }, { status: 502 })
  }
}
