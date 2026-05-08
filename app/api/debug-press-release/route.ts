import { NextResponse } from 'next/server'

const WP_BASE = `${process.env.WORDPRESS_SITE_URL}/wp-json/wp/v2`
const WP_SITE = process.env.WORDPRESS_SITE_URL ?? ''

function authHeader(): string {
  const user = process.env.WORDPRESS_USERNAME ?? ''
  const pass = (process.env.WORDPRESS_APP_PASSWORD ?? '').replace(/\s/g, '')
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

/**
 * GET /api/debug-press-release?link=URL
 * Diagnostic endpoint — returns raw data about the PR URL.
 */
export async function GET(req: Request) {
  const url  = new URL(req.url)
  const link = url.searchParams.get('link') ?? ''
  if (!link) return NextResponse.json({ error: 'link param required' })

  const auth = authHeader()
  const hdrs = { Authorization: auth, Accept: 'application/json' }

  let u: URL
  try { u = new URL(link) } catch { return NextResponse.json({ error: 'bad link' }) }
  const slug = u.pathname.replace(/\/$/, '').split('/').pop() ?? ''

  const results: Record<string, unknown> = { link, slug }

  // 1. Raw HTML fetch
  try {
    const htmlRes = await fetch(link, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)', Accept: 'text/html' },
      redirect: 'follow', cache: 'no-store',
    })
    const body = await htmlRes.text()
    results.html_status    = htmlRes.status
    results.html_final_url = htmlRes.url
    results.html_snippet   = body.slice(0, 800)
    results.html_has_title = /<title/i.test(body)
    results.html_has_og    = /og:title/i.test(body)
    results.html_has_entry = /entry-content/i.test(body)
  } catch (e) { results.html_error = String(e) }

  // 2. REST posts by slug
  try {
    const r = await fetch(`${WP_BASE}/posts?slug=${encodeURIComponent(slug)}&status=any&context=edit&per_page=5&_fields=id,slug,status,link`, { headers: hdrs, cache: 'no-store' })
    results.rest_posts_status = r.status
    results.rest_posts        = await r.json().catch(() => '(bad json)')
  } catch (e) { results.rest_posts_error = String(e) }

  // 3. REST pages by slug
  try {
    const r = await fetch(`${WP_BASE}/pages?slug=${encodeURIComponent(slug)}&status=any&context=edit&per_page=5&_fields=id,slug,status,link`, { headers: hdrs, cache: 'no-store' })
    results.rest_pages_status = r.status
    results.rest_pages        = await r.json().catch(() => '(bad json)')
  } catch (e) { results.rest_pages_error = String(e) }

  // 4. Global search across all types
  try {
    const r = await fetch(`${WP_BASE}/search?search=${encodeURIComponent(slug)}&per_page=10&_fields=id,title,url,type,subtype`, { headers: hdrs, cache: 'no-store' })
    results.rest_search_status = r.status
    results.rest_search        = await r.json().catch(() => '(bad json)')
  } catch (e) { results.rest_search_error = String(e) }

  // 5. List WP registered types
  try {
    const r = await fetch(`${WP_SITE}/wp-json/wp/v2/types`, { headers: hdrs, cache: 'no-store' })
    const data: Record<string, { rest_base?: string }> = await r.json().catch(() => ({}))
    results.registered_types = Object.entries(data).map(([k, v]) => `${k} → ${v.rest_base}`)
  } catch (e) { results.types_error = String(e) }

  return NextResponse.json(results, { status: 200 })
}
