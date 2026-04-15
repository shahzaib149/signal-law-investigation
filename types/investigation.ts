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
  suggested_date: string
  wordpress_url: string
  wordpress_press_release_url: string
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

/** Category filter — no Risk Tier field exists yet in Airtable */
export type FilterOption = 'All' | string
