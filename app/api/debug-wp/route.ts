/**
 * TEMPORARY DIAGNOSTIC ENDPOINT — remove after debugging is done.
 * GET /api/debug-wp?postId=123
 * Returns the full raw WordPress REST response shape for a given post ID
 * so we can see exactly which keys carry score data.
 */
export const dynamic = 'force-dynamic'

const WP_BASE = `${process.env.WORDPRESS_SITE_URL}/wp-json/wp/v2`
const WP_SITE = process.env.WORDPRESS_SITE_URL ?? ''

function authHeader(): string {
  const user = process.env.WORDPRESS_USERNAME ?? ''
  const pass = process.env.WORDPRESS_APP_PASSWORD ?? ''
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const postIdParam = searchParams.get('postId')

  if (!postIdParam) {
    return Response.json({ error: 'Pass ?postId=123' }, { status: 400 })
  }

  const postId = Number(postIdParam)
  if (!Number.isFinite(postId) || postId <= 0) {
    return Response.json({ error: 'postId must be a positive integer' }, { status: 400 })
  }

  // ── Layer 1: standard REST endpoint ──────────────────────────
  const url = `${WP_BASE}/posts/${postId}?status=draft&context=edit&_embed`
  console.log(`[debug-wp] fetching: ${url}`)

  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    cache: 'no-store',
  })

  const httpStatus = res.status
  if (!res.ok) {
    const body = await res.text()
    return Response.json({ error: `WordPress returned ${httpStatus}`, body }, { status: 502 })
  }

  const raw = await res.json()

  // ── Layer 2: ACF v3 endpoint ──────────────────────────────────
  let acfData: Record<string, unknown> | null = null
  let acfStatus = 0
  try {
    const acfRes = await fetch(`${WP_SITE}/wp-json/acf/v3/posts/${postId}`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      cache: 'no-store',
    })
    acfStatus = acfRes.status
    if (acfRes.ok) {
      const d = await acfRes.json()
      acfData = d?.acf ?? d ?? null
    }
  } catch (e) {
    acfData = { fetchError: String(e) }
  }

  // ── Score field extraction test ───────────────────────────────
  const SCORE_FIELDS = [
    'vigilant_risk_score',
    'escalation_momentum_score',
    'litigation_readiness_index',
    'legal_process_indicator',
    'threat_horizon_index',
    'case_impact_score',
    'loss_severity_band',
    'executive_intelligence_summary',
    'investigation_status',
    'last_updated',
  ]

  const meta = raw.meta ?? {}
  const acf  = raw.acf  ?? acfData ?? {}

  const scoreExtraction: Record<string, string | null> = {}
  for (const k of SCORE_FIELDS) {
    const fromMeta = meta[k]
    const fromAcf  = acf[k]
    const val = (fromMeta ?? fromAcf)
    scoreExtraction[k] = val !== undefined && val !== null && val !== false
      ? String(val).trim() || null
      : null
  }

  return Response.json({
    layer1_raw_response: {
      httpStatus,
      topLevelKeys:      Object.keys(raw),
      postId:            raw.id,
      title:             raw.title?.rendered ?? raw.title?.raw ?? null,
      postStatus:        raw.status,
      featured_media_id: raw.featured_media,
      embedded_media_url: raw._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null,
      meta_keys:         Object.keys(meta),
      meta_values:       meta,
      acf_inline_keys:   Object.keys(raw.acf ?? {}),
      acf_inline_values: raw.acf ?? {},
    },
    layer2_acf_v3_endpoint: {
      httpStatus:  acfStatus,
      acf_keys:    acfData ? Object.keys(acfData) : [],
      acf_values:  acfData ?? {},
    },
    layer3_score_extraction: scoreExtraction,
  })
}
