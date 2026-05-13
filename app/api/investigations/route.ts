import { NextResponse } from 'next/server'
import type { Investigation } from '@/types/investigation'
import { fetchCompletedInvestigations } from '@/lib/airtable'
import {
  getPostsBatchData,
  getPostsBatchDataBySlugs,
  listInvestigationPostsFromWordPress,
  type WPBatchData,
} from '@/lib/wordpress'
import { investigationFromWpListRow } from '@/lib/synthetic-investigation-from-wp'

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
 * Returns Airtable rows (Intake | Generating | Active Research | Approved | Published),
 * enriched from WordPress, plus orphan investigation-shaped WP posts (no Airtable row)
 * as synthetic ids `wp-{postId}`. Merged list is sorted by last modified, newest first.
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

    let dataById: Record<number, WPBatchData> = {}
    let dataBySlug: Record<string, WPBatchData> = {}
    try {
      ;[dataById, dataBySlug] = await Promise.all([
        Object.keys(idToRecordId).length
          ? getPostsBatchData(Object.keys(idToRecordId).map(Number))
          : Promise.resolve({} as Record<number, WPBatchData>),
        Object.keys(slugToRecordId).length
          ? getPostsBatchDataBySlugs(Object.keys(slugToRecordId))
          : Promise.resolve({} as Record<string, WPBatchData>),
      ])
    } catch (wpErr) {
      console.error(
        '[GET /api/investigations] WordPress batch enrichment failed — returning Airtable rows without WP scores',
        wpErr
      )
    }

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
        featured_media_url: d?.imageUrl ?? r.featured_media_url ?? null,
        wp_vrs:        d?.vrs        ?? '',
        wp_cis:        d?.cis        ?? '',
        wp_thi:        d?.thi        ?? '',
        wp_escalation: d?.escalation ?? '',
      }
    })

    const linkedPostIds = new Set<number>()
    const linkedSlugs   = new Set<string>()
    for (const r of enriched) {
      const pid = extractPostId(r.wordpress_url)
      if (pid) linkedPostIds.add(pid)
      const slug = extractSlug(r.wordpress_url)
      if (slug) linkedSlugs.add(slug.toLowerCase())
    }

    let wpOrphans: Investigation[] = []
    try {
      const wpRows = await listInvestigationPostsFromWordPress()
      for (const row of wpRows) {
        if (linkedPostIds.has(row.id)) continue
        if (row.slug && linkedSlugs.has(row.slug.toLowerCase())) continue
        wpOrphans.push(investigationFromWpListRow(row))
      }
    } catch (wpListErr) {
      console.error(
        '[GET /api/investigations] WordPress orphan list failed — returning Airtable rows only',
        wpListErr
      )
    }

    const merged = [...enriched, ...wpOrphans].sort(
      (a, b) =>
        new Date(b.last_modified || b.submitted_at || 0).getTime() -
        new Date(a.last_modified || a.submitted_at || 0).getTime()
    )

    return NextResponse.json(merged)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/investigations]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
