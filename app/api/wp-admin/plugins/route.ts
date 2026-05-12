/**
 * GET  /api/wp-admin/plugins        — list all active plugins
 * POST /api/wp-admin/plugins        — deactivate a plugin by slug
 *   body: { plugin: "litespeed-cache/litespeed-cache" }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const WP_SITE = process.env.WORDPRESS_SITE_URL ?? ''

function authHeader() {
  const user = process.env.WORDPRESS_USERNAME ?? ''
  const pass = (process.env.WORDPRESS_APP_PASSWORD ?? '').replace(/\s/g, '')
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

function wpHeaders(extra?: Record<string, string>) {
  return {
    Authorization:    authHeader(),
    Accept:           'application/json',
    'Accept-Encoding': 'gzip, deflate',
    ...extra,
  }
}

export async function GET() {
  if (!WP_SITE) {
    return NextResponse.json({ error: 'WORDPRESS_SITE_URL not configured' }, { status: 500 })
  }

  const res = await fetch(`${WP_SITE}/wp-json/wp/v2/plugins?per_page=100`, {
    headers: wpHeaders(),
    cache: 'no-store',
  })

  if (res.status === 404) {
    return NextResponse.json({
      error: 'Plugin API not available — requires WordPress 5.5+ and the activate_plugins capability.',
    }, { status: 404 })
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return NextResponse.json({ error: `WordPress returned ${res.status}`, body: txt.slice(0, 500) }, { status: 502 })
  }

  const plugins: Array<{ plugin: string; name: string; status: string; description?: { rendered?: string } }> =
    await res.json()

  const active = plugins
    .filter((p) => p.status === 'active')
    .map((p) => ({ plugin: p.plugin, name: p.name, status: p.status }))

  const cachePlugins = active.filter((p) =>
    /cache|litespeed|rocket|w3.?total|autoptimize|hummingbird|swift|breeze|comet|sg.?cachepress|cloudflare/i
      .test(p.name + p.plugin)
  )

  return NextResponse.json({
    total_active: active.length,
    cache_plugins: cachePlugins,
    all_active: active,
  })
}

export async function POST(req: Request) {
  if (!WP_SITE) {
    return NextResponse.json({ error: 'WORDPRESS_SITE_URL not configured' }, { status: 500 })
  }

  let body: { plugin?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const plugin = body?.plugin?.trim()
  if (!plugin) {
    return NextResponse.json({ error: '"plugin" field required (e.g. "litespeed-cache/litespeed-cache")' }, { status: 400 })
  }

  // WP REST API: PUT /wp-json/wp/v2/plugins/{plugin} with status: inactive
  const encoded = encodeURIComponent(plugin)
  const res = await fetch(`${WP_SITE}/wp-json/wp/v2/plugins/${encoded}`, {
    method: 'PUT',
    headers: wpHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status: 'inactive' }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `WordPress returned ${res.status}`, body: txt.slice(0, 500) },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json({ success: true, plugin: data.plugin, status: data.status })
}
