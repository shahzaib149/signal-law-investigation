import type { Investigation, WordPressPost } from '@/types/investigation'
import type { WpInvestigationListRow } from '@/lib/wordpress'

/** Synthetic Airtable id for WordPress-only rows (detail page + links). */
export function wpSyntheticRecordId(postId: number): string {
  return `wp-${postId}`
}

export function isWpSyntheticRecordId(id: string): boolean {
  return /^wp-\d+$/.test(id)
}

export function parseWpSyntheticPostId(id: string): number | null {
  const m = /^wp-(\d+)$/.exec(id)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Minimal `Investigation` from a full WordPress post (detail / press-release for `wp-{id}` routes).
 */
export function investigationStubFromWordPressPost(post: WordPressPost, recordId: string): Investigation {
  return {
    id: recordId,
    company_name: post.title,
    ticker_symbol: '',
    investigation_category: 'Securities Disclosure Risk',
    brief_topic: (post.meta.executive_intelligence_summary ?? '').slice(0, 300),
    why_it_matters: '',
    investigation_status: post.status === 'publish' ? 'Published' : 'Active Research',
    submitted_at: post.date,
    last_modified: post.date,
    suggested_date: '',
    wordpress_url: post.link || `?p=${post.id}`,
    wordpress_press_release_url: post.press_release_link ?? '',
    explanatory_video: '',
    featured_media_url: post.featured_media_url,
    wp_vrs: post.meta.vigilant_risk_score ?? '',
    wp_cis: post.meta.case_impact_score ?? '',
    wp_thi: post.meta.threat_horizon_index ?? '',
    wp_escalation: post.meta.escalation_momentum_score ?? '',
  }
}

/**
 * Map a WordPress list row to the dashboard `Investigation` shape.
 * Drafts surface as Active Research; live posts as Published.
 */
export function investigationFromWpListRow(row: WpInvestigationListRow): Investigation {
  const id = wpSyntheticRecordId(row.id)
  const isPublish = row.status === 'publish'
  const brief =
    row.titlePlain.length > 140 ? `${row.titlePlain.slice(0, 137)}…` : row.titlePlain

  return {
    id,
    company_name: row.titlePlain || `Post ${row.id}`,
    ticker_symbol: '',
    investigation_category: 'Securities Disclosure Risk',
    brief_topic: brief,
    why_it_matters: '',
    investigation_status: isPublish ? 'Published' : 'Active Research',
    submitted_at: row.date,
    last_modified: row.modified || row.date,
    suggested_date: '',
    wordpress_url: row.link || `?p=${row.id}`,
    wordpress_press_release_url: '',
    explanatory_video: '',
    featured_media_url: row.imageUrl,
    wp_vrs: row.vrs,
    wp_cis: row.cis,
    wp_thi: row.thi,
    wp_escalation: row.escalation,
  }
}
