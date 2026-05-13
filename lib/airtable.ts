import type { Investigation, StatusItem } from '@/types/investigation'

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`

function safeJson(text: string): string | null {
  try { return JSON.stringify(JSON.parse(text)) } catch { return null }
}

function authHeaders() {
  return {
    Authorization:    `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type':   'application/json',
    'Accept-Encoding': 'gzip, deflate', // exclude brotli — Node fetch can't decompress it
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickField(r: any, keys: string[]): unknown {
  for (const k of keys) {
    const v = r.fields?.[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

function pickNum(r: any, keys: string[]): number | undefined {
  const v = pickField(r, keys)
  if (v === undefined) return undefined
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const n = parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function pickStr(r: any, keys: string[]): string | undefined {
  const v = pickField(r, keys)
  if (v === undefined) return undefined
  if (Array.isArray(v)) {
    const first = v[0]
    if (first === undefined || first === null) return undefined
    const s = String(first).trim()
    return s.length ? s : undefined
  }
  const s = String(v).trim()
  return s.length ? s : undefined
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
    last_modified:               r.fields['Last Modified']                 ?? '',
    suggested_date:              r.fields['Suggested Date']                ?? '',
    wordpress_url:               r.fields['WordPress Research Profile URL'] ?? r.fields['WordPress URL'] ?? '',
    wordpress_press_release_url: r.fields['WordPress Press Release URL']   ?? '',
    explanatory_video:           r.fields['Explanatory Video']             ?? '',
    xpr_story_guid:                r.fields['XPR Story GUID'] != null && r.fields['XPR Story GUID'] !== ''
      ? String(r.fields['XPR Story GUID'])
      : undefined,
    vrs_score:                     pickNum(r, ['VRS Score', 'vrs_score']),
    ems_score:                   pickNum(r, ['EMS Score', 'ems_score']),
    lri_score:                   pickNum(r, ['LRI Score', 'lri_score']),
    confidence_score:            pickNum(r, ['Confidence Score', 'confidence_score']),
    severity_level:              pickStr(r, ['Severity Level', 'severity_level']),
    priority_rank:               pickField(r, ['Priority Rank', 'priority_rank']) as number | string | undefined,
    launch_recommendation:       pickStr(r, ['Launch Recommendation', 'launch_recommendation']),
    risk_summary:                pickStr(r, ['Risk Summary', 'risk_summary']),
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

/** GET records for Today's Topics — new AI queue (Pending / Intake / unset), newest activity first */
export async function fetchPendingTopics(): Promise<Investigation[]> {
  const params = new URLSearchParams({
    filterByFormula:
      `OR({Investigation Status}='Pending', {Investigation Status}='Intake', {Investigation Status}=BLANK())`,
    'sort[0][field]':     'Last Modified',
    'sort[0][direction]': 'desc',
    maxRecords: '50',
  })

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err  = safeJson(text)
    throw new Error(`Airtable fetchPendingTopics failed (${res.status}): ${err ?? text.slice(0, 200)}`)
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
    const text = await res.text().catch(() => '')
    const err  = safeJson(text)
    throw new Error(`Airtable fetchStatusItems failed (${res.status}): ${err ?? text.slice(0, 200)}`)
  }

  const data = await res.json()
  return (data.records ?? []).map(mapToStatusItem)
}

/**
 * GET records with an investigation attached — i.e. status is
 * Active Research OR Approved OR Published. Rejected is excluded.
 * Sorted by Last Modified desc.
 */
export async function fetchCompletedInvestigations(): Promise<Investigation[]> {
  const params = new URLSearchParams({
    filterByFormula: `OR({Investigation Status}='Intake', {Investigation Status}='Generating', {Investigation Status}='Active Research', {Investigation Status}='Approved', {Investigation Status}='Published')`,
    'sort[0][field]':     'Last Modified',
    'sort[0][direction]': 'desc',
    maxRecords: '100',
  })

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err  = safeJson(text)
    throw new Error(`Airtable fetchCompletedInvestigations failed (${res.status}): ${err ?? text.slice(0, 200)}`)
  }

  const data = await res.json()
  return (data.records ?? []).map(mapToInvestigation)
}

/** GET a single record by ID */
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

/** Update only the WordPress Press Release URL field on a record. */
export async function updatePressReleaseUrl(
  recordId: string,
  pressReleaseUrl: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      fields: { 'WordPress Press Release URL': pressReleaseUrl },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Airtable updatePressReleaseUrl failed: ${JSON.stringify(err)}`)
  }
}

/**
 * Mark an Airtable record as Published and replace the draft preview URL
 * with the live WordPress permalink.
 */
export async function markRecordPublished(
  recordId: string,
  permalink: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      fields: {
        'Investigation Status': 'Published',
        'WordPress Research Profile URL': permalink,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Airtable markRecordPublished failed: ${JSON.stringify(err)}`)
  }
}
