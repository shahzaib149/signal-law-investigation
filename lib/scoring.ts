import type { ParsedScore, ScoreBand, WordPressMeta } from '@/types/investigation'

/**
 * Parse "75 | Red" or just "Accelerating" / "$50-250m" into a value + band.
 */
function parse(raw: string): { value: string; band: ScoreBand } {
  if (!raw) return { value: '—', band: null }
  if (raw.includes('|')) {
    const [left, right] = raw.split('|').map((s) => s.trim())
    return { value: left || '—', band: normalizeBand(right) }
  }
  return { value: raw.trim(), band: null }
}

function normalizeBand(b: string | undefined): ScoreBand {
  if (!b) return null
  const n = b.toLowerCase()
  if (n === 'red')      return 'Red'
  if (n === 'yellow' || n === 'amber') return 'Yellow'
  if (n === 'green')    return 'Green'
  if (n === 'high')     return 'High'
  if (n === 'moderate') return 'Moderate'
  if (n === 'low')      return 'Low'
  return null
}

/**
 * Convert WordPress meta into the 7-tile scoring dashboard.
 * Order matches Signal Law's standard VRS → CIS sequence.
 */
export function metaToScoreTiles(meta: WordPressMeta): ParsedScore[] {
  const vrs = parse(meta.vigilant_risk_score)
  const lpi = parse(meta.legal_process_indicator)
  const cis = parse(meta.case_impact_score)

  return [
    { key: 'VRS', label: 'Vigilant Risk Score',         ...vrs },
    { key: 'EMS', label: 'Escalation Momentum',         value: meta.escalation_momentum_score  || '—', band: null },
    { key: 'LRI', label: 'Litigation Readiness',        value: meta.litigation_readiness_index || '—', band: null },
    { key: 'LPI', label: 'Legal Process Indicator',     ...lpi },
    { key: 'LSB', label: 'Loss Severity Band',          value: meta.loss_severity_band         || '—', band: null },
    { key: 'THI', label: 'Threat Horizon',              value: meta.threat_horizon_index       || '—', band: null },
    { key: 'CIS', label: 'Case Impact Score',           ...cis },
  ]
}

/** Hex colors used by the ScoreTile component. */
export function bandAccent(band: ScoreBand): { text: string; bg: string; border: string } {
  switch (band) {
    case 'Red':
    case 'High':
      return { text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }
    case 'Yellow':
    case 'Moderate':
      return { text: '#b45309', bg: '#fffbeb', border: '#fde68a' }
    case 'Green':
    case 'Low':
      return { text: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
    default:
      return { text: '#374151', bg: '#f9fafb', border: '#e5e7eb' }
  }
}
