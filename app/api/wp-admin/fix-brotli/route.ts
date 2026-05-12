/**
 * POST /api/wp-admin/fix-brotli
 * Attempts to fix the WordPress brotli compression issue by:
 * 1. Purging all LiteSpeed Cache
 * 2. Disabling brotli in LiteSpeed Cache settings (if accessible)
 * GET  — diagnostic only (check current settings)
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const WP_SITE = process.env.WORDPRESS_SITE_URL ?? ''

function auth() {
  const user = process.env.WORDPRESS_USERNAME ?? ''
  const pass = (process.env.WORDPRESS_APP_PASSWORD ?? '').replace(/\s/g, '')
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

function wpHeaders(extra?: Record<string, string>) {
  return {
    Authorization:    auth(),
    Accept:           'application/json',
    'Content-Type':   'application/json',
    'Accept-Encoding': 'gzip, deflate',
    ...extra,
  }
}

async function safeCall(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, { ...options, headers: { ...wpHeaders(), ...(options?.headers as Record<string, string> | undefined) } })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }
    return { ok: res.ok, status: res.status, json, text: text.slice(0, 200) }
  } catch (err) {
    return { ok: false, status: 0, json: null, text: String(err) }
  }
}

export async function GET() {
  if (!WP_SITE) return NextResponse.json({ error: 'WP not configured' }, { status: 500 })

  const results: Record<string, unknown> = {}

  // Check posts API (this should always work)
  const posts = await safeCall(`${WP_SITE}/wp-json/wp/v2/posts?per_page=1&_fields=id,title`, { cache: 'no-store' })
  results.posts_api = { status: posts.status, ok: posts.ok, parsedJson: posts.json !== null, preview: posts.text.slice(0, 80) }

  // Check WP settings
  const settings = await safeCall(`${WP_SITE}/wp-json/wp/v2/settings`, { cache: 'no-store' })
  results.wp_settings = { status: settings.status, ok: settings.ok, parsedJson: settings.json !== null, text: settings.text.slice(0, 80) }

  // Check LiteSpeed endpoints
  const lsConf = await safeCall(`${WP_SITE}/wp-json/litespeed/v1/conf`, { cache: 'no-store' })
  results.ls_conf = { status: lsConf.status, ok: lsConf.ok, parsedJson: lsConf.json !== null, text: lsConf.text }

  // Check if plugins endpoint works
  const plugins = await safeCall(`${WP_SITE}/wp-json/wp/v2/plugins?per_page=20`, { cache: 'no-store' })
  results.plugins = { status: plugins.status, ok: plugins.ok, parsedJson: plugins.json !== null, data: plugins.json }

  return NextResponse.json(results)
}

export async function POST() {
  if (!WP_SITE) return NextResponse.json({ error: 'WP not configured' }, { status: 500 })

  const steps: Array<{ step: string; status: number; result: unknown }> = []

  // Step 1: Purge LiteSpeed Cache
  const purge = await safeCall(`${WP_SITE}/wp-json/litespeed/v1/purge/all`, { method: 'POST' })
  steps.push({ step: 'litespeed_purge_all', status: purge.status, result: purge.text })

  // Step 2: Try to disable LiteSpeed brotli via REST conf endpoint
  const disableBrotli = await safeCall(`${WP_SITE}/wp-json/litespeed/v1/conf`, {
    method: 'POST',
    body: JSON.stringify({ data: { compress_brotli: false, cache_browser_ttl: 0 } }),
  })
  steps.push({ step: 'ls_disable_brotli', status: disableBrotli.status, result: disableBrotli.text })

  // Step 3: Try to clear via LiteSpeed admin-ajax
  const ajaxPurge = await safeCall(`${WP_SITE}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'action=litespeed_purge_all',
  })
  steps.push({ step: 'ls_ajax_purge', status: ajaxPurge.status, result: ajaxPurge.text.slice(0, 100) })

  // Step 4: Try WordPress native transient purge
  const wpPurge = await safeCall(`${WP_SITE}/wp-json/wp/v2/settings`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  steps.push({ step: 'wp_settings_touch', status: wpPurge.status, result: typeof wpPurge.json === 'object' ? 'ok' : wpPurge.text })

  const anySuccess = steps.some((s) => s.status >= 200 && s.status < 300)

  return NextResponse.json({
    message: anySuccess
      ? 'One or more fix steps succeeded. Check the site now — if still broken, manual WP admin action required.'
      : 'All fix steps failed — manual fix required through WordPress admin or Elementor Cloud dashboard.',
    steps,
    manual_steps: [
      '1. Log in to https://www.signallawgroup.com/wp-admin/',
      '2. Go to LiteSpeed Cache → Cache → Disable "Enable Brotli" toggle',
      '3. Click "Save Changes"',
      '4. Go to LiteSpeed Cache → Toolbox → Purge All',
      '5. OR: Deactivate LiteSpeed Cache plugin entirely from Plugins page',
    ],
  })
}
