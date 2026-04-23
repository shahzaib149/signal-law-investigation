import { NextResponse } from 'next/server'
import { fetchCompletedInvestigations } from '@/lib/airtable'
import { getPostsFeaturedImages, getPostsFeaturedImagesBySlugs } from '@/lib/wordpress'

/**
 * Extract ?p=123 post ID from a WordPress draft preview URL.
 * Returns null for permalink-style URLs.
 */
function extractPostId(url: string): number | null {
  const m = url?.match(/[?&]p=(\d+)/)
  return m ? Number(m[1]) : null
}

/**
 * Extract the last path segment as a slug from a full permalink URL.
 * e.g. "https://site.com/investigations/lyft-safety-review/" → "lyft-safety-review"
 * Returns null for draft preview URLs (?p=123) or empty slugs.
 */
function extractSlug(url: string): string | null {
  try {
    if (!url || url.includes('?p=')) return null
    const pathname = new URL(url).pathname.replace(/\/$/, '')
    const slug = pathname.split('/').pop()
    return slug && slug.length > 0 ? slug : null
  } catch {
    return null
  }
}

/**
 * GET /api/investigations
 * Returns Airtable records (Active Research | Approved | Published)
 * server-side enriched with featured_media_url from WordPress.
 */
export async function GET() {
  try {
    const records = await fetchCompletedInvestigations()

    // Bucket each record into ID-keyed or slug-keyed for the two WP batch calls
    const idToRecordId:   Record<number, string> = {}  // wpPostId  → airtable recordId
    const slugToRecordId: Record<string, string> = {}  // urlSlug   → airtable recordId

    for (const r of records) {
      const postId = extractPostId(r.wordpress_url)
      if (postId) {
        idToRecordId[postId] = r.id
        continue
      }
      const slug = extractSlug(r.wordpress_url)
      if (slug) {
        slugToRecordId[slug] = r.id
      }
    }

    console.log(`[investigations] ${records.length} records: ${Object.keys(idToRecordId).length} by ID, ${Object.keys(slugToRecordId).length} by slug`)

    // Run both WP batch fetches in parallel
    const [imgById, imgBySlug] = await Promise.all([
      Object.keys(idToRecordId).length
        ? getPostsFeaturedImages(Object.keys(idToRecordId).map(Number))
        : Promise.resolve({} as Record<number, string | null>),
      Object.keys(slugToRecordId).length
        ? getPostsFeaturedImagesBySlugs(Object.keys(slugToRecordId))
        : Promise.resolve({} as Record<string, string | null>),
    ])

    // Build a map from airtable recordId → featuredImageUrl
    const imageByRecord: Record<string, string | null> = {}
    for (const [postId, recordId] of Object.entries(idToRecordId)) {
      imageByRecord[recordId] = imgById[Number(postId)] ?? null
    }
    for (const [slug, recordId] of Object.entries(slugToRecordId)) {
      imageByRecord[recordId] = imgBySlug[slug] ?? null
    }

    console.log(`[investigations] image results: ${JSON.stringify(imageByRecord)}`)

    const enriched = records.map((r) => ({
      ...r,
      featured_media_url: imageByRecord[r.id] ?? null,
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/investigations]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
