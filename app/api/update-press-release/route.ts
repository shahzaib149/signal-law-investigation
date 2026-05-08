import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const WP_URL  = process.env.WORDPRESS_SITE_URL
  const WP_USER = process.env.WORDPRESS_USERNAME
  const WP_PASS = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s/g, '')

  if (!WP_URL || !WP_USER || !WP_PASS) {
    return NextResponse.json({ error: 'WordPress credentials not configured' }, { status: 500 })
  }

  let body: { link?: string; content?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { link, content } = body
  if (!link || !content) {
    return NextResponse.json({ error: 'link and content are required' }, { status: 400 })
  }

  const auth    = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64')
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` }

  // 1. Try ?p=N pattern
  let postId: number | null = null
  const pMatch = link.match(/[?&]p=(\d+)/)
  if (pMatch) {
    postId = Number(pMatch[1])
  }

  // 2. Fallback: look up by slug
  if (!postId) {
    try {
      const u    = new URL(link)
      const slug = u.pathname.replace(/\/$/, '').split('/').pop()
      if (slug) {
        const res   = await fetch(`${WP_URL}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id`, { headers })
        const posts = await res.json()
        if (Array.isArray(posts) && posts.length > 0) {
          postId = Number(posts[0].id)
        }
      }
    } catch { /* ignore */ }
  }

  if (!postId) {
    return NextResponse.json({ error: 'Could not find WordPress post from the given link' }, { status: 400 })
  }

  const updateRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${postId}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ content }),
  })

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: (err as { message?: string })?.message ?? `WordPress update failed (${updateRes.status})` },
      { status: updateRes.status }
    )
  }

  return NextResponse.json({ success: true })
}
