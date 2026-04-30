/**
 * WordPress REST API wrapper for signallawgroup.com.
 * SERVER-ONLY — imports of this file must never reach the client bundle.
 */

import type { WordPressPost, WordPressPostRaw, WordPressMediaRaw } from '@/types/investigation'

const WP_BASE = `${process.env.WORDPRESS_SITE_URL}/wp-json/wp/v2`
const WP_SITE = process.env.WORDPRESS_SITE_URL ?? ''

function authHeader(): string {
  const user = process.env.WORDPRESS_USERNAME ?? ''
  const pass = process.env.WORDPRESS_APP_PASSWORD ?? ''
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

/** GET /posts/{id} — includes drafts, embeds featured media + ACF fields */
export async function getPost(postId: number): Promise<WordPressPost | null> {
  const res = await fetch(
    `${WP_BASE}/posts/${postId}?status=draft&context=edit&_embed&acf_format=standard`,
    { headers: { Authorization: authHeader(), Accept: 'application/json' }, cache: 'no-store' }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`getPost(${postId}) failed: ${res.status} ${await safeReadText(res)}`)
  const raw: WordPressPostRaw = await res.json()

  console.log(`[wordpress] getPost(${postId}) status=${raw.status}`)
  console.log(`[wordpress] meta keys:`, Object.keys(raw.meta ?? {}))
  console.log(`[wordpress] acf keys:`, Object.keys(raw.acf ?? {}))
  console.log(`[wordpress] featured_media=${raw.featured_media} embed_url=${raw._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? 'none'}`)

  const post = mapPost(raw)
  await enrichWithAcf(postId, post)
  return post
}

/** GET /posts?slug={slug} — fetch by permalink slug */
export async function getPostBySlug(slug: string): Promise<WordPressPost | null> {
  const res = await fetch(
    `${WP_BASE}/posts?slug=${encodeURIComponent(slug)}&context=edit&_embed&acf_format=standard`,
    { headers: { Authorization: authHeader(), Accept: 'application/json' }, cache: 'no-store' }
  )
  if (!res.ok) return null
  const posts: WordPressPostRaw[] = await res.json()
  if (!Array.isArray(posts) || !posts.length) return null

  console.log(`[wordpress] getPostBySlug(${slug}) found id=${posts[0].id} status=${posts[0].status}`)
  console.log(`[wordpress] meta keys:`, Object.keys(posts[0].meta ?? {}))
  console.log(`[wordpress] acf keys:`, Object.keys(posts[0].acf ?? {}))

  const post = mapPost(posts[0])
  await enrichWithAcf(posts[0].id, post)
  return post
}

/** POST /posts/{id} → publish */
export async function publishPost(postId: number): Promise<WordPressPost> {
  const res = await fetch(
    `${WP_BASE}/posts/${postId}?context=edit&_embed=wp:featuredmedia`,
    {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ status: 'publish' }),
      cache: 'no-store',
    }
  )
  if (!res.ok) throw new Error(`publishPost(${postId}) failed: ${res.status} ${await safeReadText(res)}`)
  const raw: WordPressPostRaw = await res.json()
  return mapPost(raw)
}

/** GET /media/{id} */
export async function getMedia(mediaId: number): Promise<string | null> {
  if (!mediaId || mediaId <= 0) return null
  const res = await fetch(`${WP_BASE}/media/${mediaId}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const raw: WordPressMediaRaw = await res.json()
  return raw?.source_url ?? null
}

/** Batch-fetch featured image URLs keyed by post ID.
 *  IMPORTANT: Do NOT add _fields here — _fields strips _embedded from the response,
 *  which breaks the featured image URL extraction. Verified against live WP API.
 *  status=any is required so draft posts (Active Research) are included. */
export async function getPostsFeaturedImages(postIds: number[]): Promise<Record<number, string | null>> {
  if (!postIds.length) return {}
  const ids = postIds.slice(0, 100).join(',')
  const res = await fetch(
    `${WP_BASE}/posts?include=${ids}&_embed=wp:featuredmedia&per_page=100&status=any&context=edit`,
    { headers: { Authorization: authHeader(), Accept: 'application/json' }, cache: 'no-store' }
  )
  if (!res.ok) {
    console.log(`[wordpress] getPostsFeaturedImages failed: ${res.status}`)
    return {}
  }
  const posts: Array<{
    id: number
    _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> }
  }> = await res.json()
  console.log(`[wordpress] getPostsFeaturedImages: requested ${postIds.length} ids, got ${posts.length} posts back`)
  const result: Record<number, string | null> = {}
  for (const p of posts) {
    result[p.id] = p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  }
  return result
}

/** Batch-fetch featured image URLs keyed by slug (for published posts whose URL is a permalink).
 *  Same rule: no _fields — it strips _embedded. */
export async function getPostsFeaturedImagesBySlugs(slugs: string[]): Promise<Record<string, string | null>> {
  if (!slugs.length) return {}
  const slugParam = slugs.slice(0, 100).map((s) => `slug[]=${encodeURIComponent(s)}`).join('&')
  const res = await fetch(
    `${WP_BASE}/posts?${slugParam}&_embed=wp:featuredmedia&per_page=100&context=edit`,
    { headers: { Authorization: authHeader(), Accept: 'application/json' }, cache: 'no-store' }
  )
  if (!res.ok) {
    console.log(`[wordpress] getPostsFeaturedImagesBySlugs failed: ${res.status}`)
    return {}
  }
  const posts: Array<{
    id: number
    slug: string
    _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> }
  }> = await res.json()
  console.log(`[wordpress] getPostsFeaturedImagesBySlugs: requested ${slugs.length} slugs, got ${posts.length} posts back`)
  const result: Record<string, string | null> = {}
  for (const p of posts) {
    result[p.slug] = p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  }
  return result
}

/** Parse "?p=123" from Airtable-stored URL */
export function parsePostIdFromUrl(url: string | null | undefined): number | null {
  if (!url) return null
  const m = url.match(/[?&]p=(\d+)/)
  return m ? Number(m[1]) : null
}

/* ─── ACF fallback ──────────────────────────────────────────────────── */

/** Score-specific meta keys — used to decide whether ACF fallback is needed. */
const SCORE_KEYS = [
  'vigilant_risk_score',
  'escalation_momentum_score',
  'litigation_readiness_index',
  'legal_process_indicator',
  'threat_horizon_index',
  'case_impact_score',
  'loss_severity_band',
] as const

/**
 * Try ACF REST API (/wp-json/acf/v3/posts/{id}) if score fields are empty.
 * NOTE: we check SCORE fields specifically — not just any meta key — because
 * `investigation_status` / `last_updated` can arrive via standard meta while
 * all the score fields live only in ACF, causing a false "meta is populated"
 * exit that previously swallowed the ACF lookup entirely.
 */
async function enrichWithAcf(postId: number, post: WordPressPost): Promise<void> {
  const hasScores = SCORE_KEYS.some((k) => post.meta[k] && post.meta[k].trim() !== '')
  if (hasScores) {
    console.log(`[wordpress] enrichWithAcf(${postId}) — scores already populated, skipping ACF`)
    return
  }

  console.log(`[wordpress] enrichWithAcf(${postId}) — score fields empty, trying ACF endpoint`)

  try {
    const res = await fetch(`${WP_SITE}/wp-json/acf/v3/posts/${postId}`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.log(`[wordpress] ACF endpoint returned ${res.status} for post ${postId}`)
      return
    }

    const data = await res.json()
    // ACF v3 returns { id, acf: { field_name: value } }; some setups return the fields at root
    const acf: Record<string, unknown> = data?.acf ?? data ?? {}

    console.log(`[wordpress] ACF keys for post ${postId}:`, Object.keys(acf))

    const pick = (key: string): string => {
      const v = acf[key]
      return v !== undefined && v !== null && v !== false ? String(v).trim() : ''
    }

    if (pick('vigilant_risk_score'))            post.meta.vigilant_risk_score            = pick('vigilant_risk_score')
    if (pick('escalation_momentum_score'))      post.meta.escalation_momentum_score      = pick('escalation_momentum_score')
    if (pick('litigation_readiness_index'))     post.meta.litigation_readiness_index     = pick('litigation_readiness_index')
    if (pick('legal_process_indicator'))        post.meta.legal_process_indicator        = pick('legal_process_indicator')
    if (pick('threat_horizon_index'))           post.meta.threat_horizon_index           = pick('threat_horizon_index')
    if (pick('case_impact_score'))              post.meta.case_impact_score              = pick('case_impact_score')
    if (pick('loss_severity_band'))             post.meta.loss_severity_band             = pick('loss_severity_band')
    if (pick('executive_intelligence_summary')) post.meta.executive_intelligence_summary = pick('executive_intelligence_summary')
    if (pick('investigation_status'))           post.meta.investigation_status           = pick('investigation_status')
    if (pick('last_updated'))                   post.meta.last_updated                   = pick('last_updated')
    // press_release_link: URL field — overwrite only if ACF returned a non-empty value
    if (!post.press_release_link && pick('press_release_link')) {
      post.press_release_link = pick('press_release_link')
    }

    console.log(`[wordpress] After ACF: vigilant_risk_score="${post.meta.vigilant_risk_score}" escalation_momentum_score="${post.meta.escalation_momentum_score}"`)
  } catch (err) {
    console.log(`[wordpress] ACF fetch error for post ${postId}:`, err)
  }
}

/* ─── internals ─────────────────────────────────────────────────────── */

function mapPost(raw: WordPressPostRaw): WordPressPost {
  const embeddedMedia = raw._embedded?.['wp:featuredmedia']?.[0]
  const featured_media_url = embeddedMedia?.source_url ?? null

  // Check both standard `meta` AND inline `acf`
  // acf is populated once field groups have "Show in REST API" enabled in ACF, or
  // after enabling acf_format=standard and REST exposure per field group.
  const meta = raw.meta ?? {}
  const acf  = Array.isArray(raw.acf) ? {} : (raw.acf ?? {})  // WP returns [] when no ACF fields exposed

  const get = (key: string): string => {
    const v = meta[key] ?? acf[key]
    return v !== undefined && v !== null && v !== false ? String(v).trim() : ''
  }

  // press_release_link: URL ACF field — check acf first (standard REST), then meta (register_post_meta path)
  const pressRaw = acf['press_release_link'] ?? meta['press_release_link']
  const press_release_link =
    pressRaw && String(pressRaw).trim().length > 0 ? String(pressRaw).trim() : null

  console.log(`[wordpress] mapPost(${raw.id}) press_release_link="${press_release_link ?? 'null'}"`)

  return {
    id: raw.id,
    title: stripHtml(raw.title?.rendered ?? raw.title?.raw ?? ''),
    content: raw.content?.rendered ?? raw.content?.raw ?? '',
    status: raw.status,
    date: raw.date,
    link: raw.link,
    featured_media: raw.featured_media,
    featured_media_url,
    press_release_link,
    meta: {
      vigilant_risk_score:            get('vigilant_risk_score'),
      escalation_momentum_score:      get('escalation_momentum_score'),
      litigation_readiness_index:     get('litigation_readiness_index'),
      legal_process_indicator:        get('legal_process_indicator'),
      threat_horizon_index:           get('threat_horizon_index'),
      case_impact_score:              get('case_impact_score'),
      loss_severity_band:             get('loss_severity_band'),
      executive_intelligence_summary: get('executive_intelligence_summary'),
      investigation_status:           get('investigation_status'),
      last_updated:                   get('last_updated'),
    },
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim()
}

async function safeReadText(res: Response): Promise<string> {
  try { return await res.text() } catch { return '(no body)' }
}
