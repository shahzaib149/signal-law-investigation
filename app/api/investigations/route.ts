import { NextResponse } from 'next/server'
import { fetchCompletedInvestigations } from '@/lib/airtable'
import { getPostsBatchData, getPostsBatchDataBySlugs, type WPBatchData } from '@/lib/wordpress'

function extractPostId(url: string): number | null {
  const m = url?.match(/[?&]p=(\d+)/)
  return m ? Number(m[1]) : null
}

function extractSlug(url: string): string | null {
  try {
    if (!url || url.includes('?p=')) return null
    const pathname = new URL(url).pathname.replace(/\/$/, '')
    const slug = pathname.split('/').pop()
    return slug && slug.length > 0 ? slug : null
  } catch { return null }
}

/**
 * GET /api/investigations
 * Returns Airtable records (Active Research | Approved | Published)
 * server-side enriched with featured image + VRS/CIS/THI/escalation from WordPress.
 */
export async function GET() {
  try {
    const records = await fetchCompletedInvestigations()

    const idToRecordId:   Record<number, string> = {}
    const slugToRecordId: Record<string, string> = {}

    for (const r of records) {
      const postId = extractPostId(r.wordpress_url)
      if (postId) { idToRecordId[postId] = r.id; continue }
      const slug = extractSlug(r.wordpress_url)
      if (slug) slugToRecordId[slug] = r.id
    }

    const [dataById, dataBySlug] = await Promise.all([
      Object.keys(idToRecordId).length
        ? getPostsBatchData(Object.keys(idToRecordId).map(Number))
        : Promise.resolve({} as Record<number, WPBatchData>),
      Object.keys(slugToRecordId).length
        ? getPostsBatchDataBySlugs(Object.keys(slugToRecordId))
        : Promise.resolve({} as Record<string, WPBatchData>),
    ])

    const byRecord: Record<string, { imageUrl: string | null; vrs: string; cis: string; thi: string; escalation: string }> = {}
    for (const [postId, recordId] of Object.entries(idToRecordId)) {
      const d = dataById[Number(postId)]
      if (d) byRecord[recordId] = d
    }
    for (const [slug, recordId] of Object.entries(slugToRecordId)) {
      const d = dataBySlug[slug]
      if (d) byRecord[recordId] = d
    }

    const enriched = records.map((r) => {
      const d = byRecord[r.id]
      return {
        ...r,
        featured_media_url: d?.imageUrl ?? null,
        wp_vrs:        d?.vrs        ?? '',
        wp_cis:        d?.cis        ?? '',
        wp_thi:        d?.thi        ?? '',
        wp_escalation: d?.escalation ?? '',
      }
    })

    return NextResponse.json(enriched)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/investigations]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
