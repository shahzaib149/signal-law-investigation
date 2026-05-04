import { NextResponse } from 'next/server'

const XPR_API_KEY = 'bf224152-53b3-4e02-831f-05fdf75f4198'
const XPR_DOMAIN  = 'www.signallawgroup.com'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const postId = searchParams.get('postId')

  if (!postId || isNaN(Number(postId))) {
    return NextResponse.json({ error: 'valid postId is required' }, { status: 400 })
  }

  const guid = encodeURIComponent(`/?p=${postId}`)
  const url  = `https://xprmedia.binwus.com/api/distribution/story-status-check` +
    `?apiKey=${XPR_API_KEY}&secure=yes&domain=${XPR_DOMAIN}&guid=${guid}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!res.ok) {
      console.error(`[xpr-status] XPR returned ${res.status}:`, text)
      return NextResponse.json({ error: `XPR API error (${res.status})` }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[xpr-status] fetch error:', err)
    return NextResponse.json({ error: 'Failed to reach XPR API' }, { status: 502 })
  }
}
