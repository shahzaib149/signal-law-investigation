import { NextResponse } from 'next/server'

const XPR_BASE      = 'https://xprmedia.binwus.com/api/distribution/content-sources'
const XPR_PUBLIC_ID = '01KJZ5Y6PCR98G7C136H58NX9M'
const XPR_API_KEY   = 'bf224152-53b3-4e02-831f-05fdf75f4198'
const XPR_PARAMS    = `publicId=${XPR_PUBLIC_ID}&apiKey=${XPR_API_KEY}`

export async function POST(req: Request) {
  let body: { title?: string; summary?: string; link?: string; guid?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, summary, link, guid } = body
  if (!title || !link) {
    return NextResponse.json({ error: 'title and link are required' }, { status: 400 })
  }

  const item = {
    title:       `${title} — Press Release`,
    summary:     summary ?? '',
    content:     `<p>${summary ?? ''}</p>`,
    link,
    author:      'Signal Law Group',
    publishedAt: new Date().toISOString(),
    guid:        guid ?? link,
    categories:  ['Legal', 'Press Releases', 'Business'],
  }

  const headers = { 'Content-Type': 'application/json' }
  const itemBody = JSON.stringify({ items: [item] })

  // 1. Precheck
  let precheckData: Record<string, unknown>
  try {
    const precheckRes = await fetch(`${XPR_BASE}/precheck?${XPR_PARAMS}`, {
      method: 'POST', headers, body: itemBody,
    })
    precheckData = await precheckRes.json()
    if (!precheckData.success) {
      const msg = (precheckData.message ?? precheckData.error ?? 'Precheck failed') as string
      return NextResponse.json({ error: String(msg) }, { status: 400 })
    }
  } catch (err) {
    console.error('[xpr-submit] precheck error:', err)
    return NextResponse.json({ error: 'Precheck request failed' }, { status: 502 })
  }

  // 2. Ingest
  try {
    const ingestRes  = await fetch(`${XPR_BASE}/ingest?${XPR_PARAMS}`, {
      method: 'POST', headers, body: itemBody,
    })
    const ingestData: Record<string, unknown> = await ingestRes.json()
    if (!ingestRes.ok) {
      const msg = (ingestData.message ?? ingestData.error ?? 'Ingest failed') as string
      return NextResponse.json({ error: String(msg) }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Successfully submitted to 226 publishers' })
  } catch (err) {
    console.error('[xpr-submit] ingest error:', err)
    return NextResponse.json({ error: 'Ingest request failed' }, { status: 502 })
  }
}
