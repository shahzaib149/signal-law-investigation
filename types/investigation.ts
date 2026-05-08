/* ─── Airtable ──────────────────────────────────────────────────────── */

/** Full investigation record from Airtable */
export interface Investigation {
  id: string
  company_name: string
  ticker_symbol: string
  investigation_category: string
  brief_topic: string
  why_it_matters: string
  investigation_status: InvestigationStatus
  submitted_at: string        // createdTime — read-only
  last_modified: string
  suggested_date: string
  wordpress_url: string
  wordpress_press_release_url: string
  explanatory_video: string
  featured_media_url?: string | null
  wp_vrs?: string
  wp_cis?: string
  wp_thi?: string
  wp_escalation?: string
}

/** Lighter shape used on the status board */
export interface StatusItem {
  id: string
  company_name: string
  investigation_category: string
  investigation_status: InvestigationStatus
  submitted_at: string
  wordpress_url: string
}

/**
 * Actual status values from Airtable:
 * Pending → Intake → Generating → Active Research → Approved → Published | Rejected
 */
export type InvestigationStatus =
  | 'Pending'
  | 'Intake'
  | 'Generating'
  | 'Active Research'
  | 'Approved'
  | 'Published'
  | 'Rejected'

export type FilterOption = 'All' | string

/* ─── WordPress ─────────────────────────────────────────────────────── */

export interface WordPressMeta {
  vigilant_risk_score:            string
  escalation_momentum_score:      string
  litigation_readiness_index:     string
  legal_process_indicator:        string
  threat_horizon_index:           string
  case_impact_score:              string
  loss_severity_band:             string
  executive_intelligence_summary: string
  investigation_status:           string
  last_updated:                   string
}

export interface WordPressPost {
  id: number
  title: string
  content: string               // rendered HTML
  status: string
  date: string
  link: string                  // permalink (becomes canonical after publish)
  featured_media: number        // media ID; 0 if none
  featured_media_url: string | null
  press_release_link: string | null   // ACF field: press_release_link (URL)
  meta: WordPressMeta
}

/** Raw shapes — used internally by lib/wordpress.ts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WordPressPostRaw {
  id: number
  title: { rendered?: string; raw?: string }
  content: { rendered?: string; raw?: string }
  status: string
  date: string
  link: string
  featured_media: number
  meta?: Record<string, unknown>
  acf?: Record<string, unknown>   // ACF REST API fields
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url?: string }>
  }
}

export interface WordPressMediaRaw {
  id: number
  source_url: string
  media_details?: {
    width?: number
    height?: number
  }
}

/* ─── Scoring view-model ────────────────────────────────────────────── */

export type ScoreBand = 'Green' | 'Yellow' | 'Red' | 'Low' | 'Moderate' | 'High' | null

export interface ParsedScore {
  key: string           // short tag: VRS, EMS, LRI, LPI, LSB, THI, CIS
  label: string         // human name
  value: string         // "75" or "Accelerating" or "$50-250m"
  band: ScoreBand       // color tier
}
