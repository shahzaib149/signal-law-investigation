import type { Investigation, StatusItem } from '@/types/investigation'

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToInvestigation(r: any): Investigation {
  return {
    id:                          r.id,
    company_name:                r.fields['Company Name']                  ?? '',
    ticker_symbol:               r.fields['Ticker Symbol']                 ?? '',
    investigation_category:      r.fields['Investigation Category']        ?? '',
    brief_topic:                 r.fields['Brief Topic']                   ?? '',
    why_it_matters:              r.fields['Why It Matters']                ?? '',
    investigation_status:        r.fields['Investigation Status']          ?? 'Pending',
    submitted_at:                r.fields['Submitted At']                  ?? '',
    suggested_date:              r.fields['Suggested Date']                ?? '',
    wordpress_url:               r.fields['WordPress Research Profile URL'] ?? r.fields['WordPress URL'] ?? '',
    wordpress_press_release_url: r.fields['WordPress Press Release URL']   ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToStatusItem(r: any): StatusItem {
  return {
    id:                     r.id,
    company_name:           r.fields['Company Name']                  ?? '',
    investigation_category: r.fields['Investigation Category']        ?? '',
    investigation_status:   r.fields['Investigation Status']          ?? 'Intake',
    submitted_at:           r.fields['Submitted At']                  ?? '',
    wordpress_url:          r.fields['WordPress Research Profile URL'] ?? r.fields['WordPress URL'] ?? '',
  }
}

/** GET all Pending records — sorted newest first */
export async function fetchPendingTopics(): Promise<Investigation[]> {
  const params = new URLSearchParams({
    filterByFormula: `{Investigation Status}='Pending'`,
    'sort[0][field]':     'Submitted At',
    'sort[0][direction]': 'desc',
    maxRecords: '25',
  })

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Airtable fetchPendingTopics failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return (data.records ?? []).map(mapToInvestigation)
}

/** GET all non-Pending records for the status board */
export async function fetchStatusItems(): Promise<StatusItem[]> {
  const params = new URLSearchParams({
    filterByFormula: `NOT({Investigation Status}='Pending')`,
    'sort[0][field]':     'Last Modified',
    'sort[0][direction]': 'desc',
    maxRecords: '20',
  })

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Airtable fetchStatusItems failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return (data.records ?? []).map(mapToStatusItem)
}

/** GET a single record by ID (used to build webhook payload) */
export async function fetchRecordById(recordId: string): Promise<Investigation | null> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const r = await res.json()
  return mapToInvestigation(r)
}

/**
 * PATCH a record: set status to 'Intake'.
 * NOTE: 'Submitted At' is a createdTime field (read-only) — do NOT write to it.
 */
export async function launchInvestigation(recordId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      fields: {
        'Investigation Status': 'Intake',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Airtable launchInvestigation failed: ${JSON.stringify(err)}`)
  }
}
