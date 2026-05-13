'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Investigation } from '@/types/investigation'

/* ─── Design tokens ──────────────────────────────────────────────── */
const PAGE    = '#0d1526'
const SURFACE = '#111c30'
const BORDER  = 'rgba(255,255,255,0.07)'
const T1      = '#f1f5f9'
const T2      = '#94a3b8'
const T3      = '#4b6a9b'

/* ─── Score parsing ──────────────────────────────────────────────── */
// WordPress stores scores as "65 | Yellow" or "7.2" — extract just the number

function extractNum(v: string): number {
  const m = (v ?? '').match(/^(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : NaN
}

function extractBand(v: string): string {
  const m = (v ?? '').match(/\|\s*(.+)$/)
  return m ? m[1].trim() : ''
}

/** Normalize any scale to 0-10 (treats >10 values as 0-100 scale) */
function norm10(n: number): number {
  return n > 10 ? n / 10 : n
}

function vrsColor(v: string): string {
  const n = norm10(extractNum(v))
  if (isNaN(n)) return T3
  if (n >= 8.0) return '#ef4444'
  if (n >= 7.0) return '#f59e0b'
  if (n >= 6.0) return '#f97316'
  return T2
}

function vrsSubLabel(v: string): string {
  const band = extractBand(v).toLowerCase()
  const n    = norm10(extractNum(v))
  if (band === 'red')    return n >= 8.0 ? 'Critical' : 'High Risk'
  if (band === 'yellow') return n >= 7.0 ? 'Priority'  : 'Heightened'
  if (band === 'green')  return 'Moderate'
  if (band)              return extractBand(v)
  if (isNaN(n))          return ''
  if (n >= 8.5) return 'Critical'
  if (n >= 8.0) return 'Priority+'
  if (n >= 7.0) return 'Priority'
  if (n >= 6.5) return 'Heightened'
  if (n >= 6.0) return 'Elevated'
  return 'Moderate'
}

function cisSubLabel(v: string): string {
  const band = extractBand(v)
  if (band) return band
  const n = extractNum(v)
  if (isNaN(n)) return ''
  if (n >= 150) return 'Critical'
  if (n >= 100) return 'High'
  if (n >= 75)  return 'Mod-High'
  if (n >= 50)  return 'Moderate'
  return 'Low-Mod'
}

function thiSubLabel(v: string): string {
  if (!v) return ''
  const m = v.match(/(\d+)/)
  if (!m) return ''
  const n = parseInt(m[1])
  if (n <= 6)  return 'Short'
  if (n <= 12) return 'Mid'
  return 'Long'
}

/* ─── Category badge ─────────────────────────────────────────────── */

function categoryStyle(cat: string): { bg: string; text: string; border: string } {
  if (cat.includes('Securities')) return { bg: 'rgba(99,102,241,.18)',  text: '#818cf8', border: 'rgba(99,102,241,.35)' }
  if (cat.includes('Consumer'))   return { bg: 'rgba(249,115,22,.18)',  text: '#fb923c', border: 'rgba(249,115,22,.35)' }
  if (cat.includes('Platform'))   return { bg: 'rgba(239,68,68,.18)',   text: '#f87171', border: 'rgba(239,68,68,.35)'  }
  if (cat.includes('Regulatory')) return { bg: 'rgba(20,184,166,.18)',  text: '#2dd4bf', border: 'rgba(20,184,166,.35)' }
  if (cat.includes('Insurance'))  return { bg: 'rgba(251,146,60,.18)',  text: '#fb923c', border: 'rgba(251,146,60,.35)' }
  return                                 { bg: 'rgba(100,116,139,.18)', text: T2,        border: 'rgba(100,116,139,.35)'}
}

function CategoryBadge({ cat }: { cat: string }) {
  const s = categoryStyle(cat)
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: '4px',
      backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {cat || 'Uncategorized'}
    </span>
  )
}

/* ─── Momentum label ─────────────────────────────────────────────── */

function momentumInfo(esc: string): { text: string; color: string } {
  const s = (esc ?? '').toLowerCase()
  if (s.includes('surg'))   return { text: '↑↑ Surging',     color: '#ef4444' }
  if (s.includes('accel'))  return { text: '↗ Accelerating', color: '#f97316' }
  if (s.includes('build'))  return { text: '↗ Building',     color: '#f59e0b' }
  if (s.includes('flat'))   return { text: '→ Flat',          color: T3       }
  if (s.includes('declin')) return { text: '↘ Declining',    color: '#ef4444' }
  return                           { text: esc || '—',        color: T3       }
}

/* ─── Stage bar ──────────────────────────────────────────────────── */

function stageInfo(status: string): { label: string; fill: number } {
  if (status === 'Published')       return { label: 'Placement Window', fill: 5 }
  if (status === 'Approved')        return { label: 'Placement Window', fill: 4 }
  if (status === 'Active Research') return { label: 'Development',      fill: 2 }
  if (status === 'Generating')      return { label: 'Generating',       fill: 2 }
  if (status === 'Intake')          return { label: 'Intake',           fill: 1 }
  return                                   { label: 'Research',         fill: 1 }
}

function StageBar({ status }: { status: string }) {
  const { label, fill } = stageInfo(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
      <span style={{ color: T3, fontSize: '11px', whiteSpace: 'nowrap' }}>Stage</span>
      <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            height: '5px', borderRadius: '999px', flex: 1,
            backgroundColor: i < fill ? '#10b981' : i === fill ? '#f59e0b' : '#1e3a5f',
          }} />
        ))}
      </div>
      <span style={{ color: T3, fontSize: '11px', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

/* ─── Sparkline ──────────────────────────────────────────────────── */

function Sparkline({ vrs }: { vrs: string }) {
  const n     = norm10(extractNum(vrs)) || 6.5
  const color = n >= 8.0 ? '#ef4444' : n >= 7.0 ? '#f59e0b' : '#f97316'
  const amp   = Math.min((n - 5) / 4, 1) * 14
  const path  = `M2,${22 - amp * 0.3} C15,${22 - amp * 0.5} 30,${22 - amp * 0.75} 45,${22 - amp * 0.9} S60,${22 - amp} 68,${22 - amp}`
  return (
    <svg width="72" height="26" viewBox="0 0 72 26" fill="none" style={{ display: 'block' }}>
      <path d={path} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Date formatter ─────────────────────────────────────────────── */

function fmtDate(d: string) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '' }
}

/* ─── Score block ────────────────────────────────────────────────── */

function ScoreBlock({
  label, rawValue, displayNum, subLabel, color, fontSize = '30px', subFontSize = '11px',
}: {
  label: string; rawValue: string; displayNum: string; subLabel: string;
  color?: string; fontSize?: string; subFontSize?: string
}) {
  return (
    <div>
      <p style={{ color: T3, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '3px' }}>{label}</p>
      <p style={{ color: color ?? T1, fontSize, fontWeight: 700, lineHeight: 1 }}>{displayNum || '—'}</p>
      <p style={{ color: T3, fontSize: subFontSize, marginTop: '3px' }}>{subLabel}</p>
    </div>
  )
  void rawValue
}

/* ─── Placement Window card (2-col, amber border) ────────────────── */

function PlacementCard({ r }: { r: Investigation }) {
  const mom  = momentumInfo(r.wp_escalation ?? '')
  const vrs  = r.wp_vrs ?? ''
  const cis  = r.wp_cis ?? ''

  return (
    <article style={{
      display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden',
      backgroundColor: SURFACE, border: '1px solid rgba(245,158,11,.25)',
    }}>
      <div style={{ padding: '20px 20px 16px', flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
          <CategoryBadge cat={r.investigation_category} />
          <span style={{ color: mom.color, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{mom.text}</span>
        </div>

        {/* Company */}
        <h3 style={{ color: T1, fontSize: '20px', fontWeight: 700, lineHeight: 1.2, marginBottom: '4px' }}>
          {r.company_name}
        </h3>
        <p style={{ color: T3, fontSize: '12px', marginBottom: '18px', lineHeight: 1.4, fontFamily: 'monospace' }}>
          {[r.ticker_symbol, r.brief_topic ? r.brief_topic.slice(0, 55) : ''].filter(Boolean).join(' · ')}
        </p>

        {/* Scores: VRS | CIS | 12WK */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'start', marginBottom: '4px' }}>
          <div style={{ paddingRight: '16px', borderRight: `1px solid ${BORDER}` }}>
            <ScoreBlock
              label="VRS" rawValue={vrs}
              displayNum={String(extractNum(vrs) || '')}
              subLabel={vrsSubLabel(vrs)}
              color={vrsColor(vrs)} fontSize="30px"
            />
          </div>
          <div style={{ paddingLeft: '16px', paddingRight: '16px', borderRight: `1px solid ${BORDER}` }}>
            <ScoreBlock
              label="CIS" rawValue={cis}
              displayNum={String(extractNum(cis) || '')}
              subLabel={cisSubLabel(cis)}
              fontSize="30px"
            />
          </div>
          <div style={{ paddingLeft: '16px' }}>
            <p style={{ color: T3, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '6px' }}>12WK</p>
            <Sparkline vrs={vrs} />
          </div>
        </div>

        <StageBar status={r.investigation_status} />
      </div>

      <div style={{ padding: '11px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#334d6e', fontSize: '12px' }}>Updated {fmtDate(r.last_modified)}</span>
        <a href={`/investigations/${r.id}`} style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fcd34d')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#f59e0b')}>
          View Profile →
        </a>
      </div>
    </article>
  )
}

/* ─── Active Research card (3-col) ──────────────────────────────── */

function ResearchCard({ r }: { r: Investigation }) {
  const mom = momentumInfo(r.wp_escalation ?? '')
  const vrs = r.wp_vrs ?? ''
  const cis = r.wp_cis ?? ''
  const thi = r.wp_thi ?? ''

  return (
    <article style={{
      display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden',
      backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
    }}>
      <div style={{ padding: '18px 18px 14px', flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
          <CategoryBadge cat={r.investigation_category} />
          <span style={{ color: mom.color, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{mom.text}</span>
        </div>

        {/* Company */}
        <h3 style={{ color: T1, fontSize: '17px', fontWeight: 700, lineHeight: 1.25, marginBottom: '4px' }}>
          {r.company_name}
        </h3>
        <p style={{ color: T3, fontSize: '11px', marginBottom: '16px', lineHeight: 1.4, fontFamily: 'monospace' }}>
          {[r.ticker_symbol, r.brief_topic ? r.brief_topic.slice(0, 48) : ''].filter(Boolean).join(' · ')}
        </p>

        {/* Scores: VRS | CIS | THI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '4px' }}>
          <div style={{ paddingRight: '10px', borderRight: `1px solid ${BORDER}` }}>
            <ScoreBlock label="VRS" rawValue={vrs}
              displayNum={String(extractNum(vrs) || '')} subLabel={vrsSubLabel(vrs)}
              color={vrsColor(vrs)} fontSize="22px" subFontSize="10px" />
          </div>
          <div style={{ paddingLeft: '10px', paddingRight: '10px', borderRight: `1px solid ${BORDER}` }}>
            <ScoreBlock label="CIS" rawValue={cis}
              displayNum={String(extractNum(cis) || '')} subLabel={cisSubLabel(cis)}
              fontSize="22px" subFontSize="10px" />
          </div>
          <div style={{ paddingLeft: '10px' }}>
            <ScoreBlock label="THI" rawValue={thi}
              displayNum={thi} subLabel={thiSubLabel(thi)}
              fontSize="16px" subFontSize="10px" />
          </div>
        </div>

        <StageBar status={r.investigation_status} />
      </div>

      <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#334d6e', fontSize: '11px' }}>Updated {fmtDate(r.last_modified)}</span>
        <a href={`/investigations/${r.id}`} style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fcd34d')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#f59e0b')}>
          View Profile →
        </a>
      </div>
    </article>
  )
}

/* ─── Background Watch row (table) ──────────────────────────────── */

function WatchRow({ r }: { r: Investigation }) {
  const mom = momentumInfo(r.wp_escalation ?? '')
  const vrs = r.wp_vrs ?? ''
  const cs  = categoryStyle(r.investigation_category)
  const vrsNum = extractNum(vrs)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 120px 60px 160px 70px 70px 60px',
      gap: '0 12px',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: `1px solid ${BORDER}`,
    }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {/* Matter */}
      <div style={{ minWidth: 0 }}>
        <span style={{ color: T1, fontSize: '13px', fontWeight: 600 }}>{r.company_name}</span>
        {r.ticker_symbol && (
          <span style={{ color: T3, fontSize: '12px', fontFamily: 'monospace' }}> · {r.ticker_symbol}</span>
        )}
      </div>

      {/* Risk type badge */}
      <div>
        <span style={{
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '2px 6px', borderRadius: '3px',
          backgroundColor: cs.bg, color: cs.text, border: `1px solid ${cs.border}`,
          whiteSpace: 'nowrap',
        }}>
          {r.investigation_category.replace(' Risk', '').replace(' Disclosure', '').slice(0, 14)}
        </span>
      </div>

      {/* VRS */}
      <p style={{ color: vrsColor(vrs), fontSize: '13px', fontWeight: 700 }}>
        {isNaN(vrsNum) ? '—' : String(vrsNum)}
      </p>

      {/* Escalation */}
      <p style={{ color: mom.color, fontSize: '12px' }}>{mom.text}</p>

      {/* THI */}
      <p style={{ color: T2, fontSize: '12px' }}>{r.wp_thi || '—'}</p>

      {/* Updated */}
      <p style={{ color: T3, fontSize: '11px' }}>{fmtDate(r.last_modified)}</p>

      {/* View */}
      <a href={`/investigations/${r.id}`}
        style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600, textDecoration: 'none', textAlign: 'right' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fcd34d')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#f59e0b')}>
        View →
      </a>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────── */

type SortKey = 'vrs-desc' | 'vrs-asc' | 'updated' | 'az'
type StageFilter = 'All' | 'Development' | 'Placement Window' | 'Placed'

export default function InvestigationsView() {
  const [records,     setRecords]     = useState<Investigation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [catFilter,   setCatFilter]   = useState('All')
  const [stageFilter, setStageFilter] = useState<StageFilter>('All')
  const [search,      setSearch]      = useState('')
  const [sort,        setSort]        = useState<SortKey>('updated')

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/investigations', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load investigations')
      setRecords(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  /* ─── Stats ── */
  const stats = useMemo(() => {
    const active    = records.filter(r =>
      r.investigation_status === 'Intake' ||
      r.investigation_status === 'Generating' ||
      r.investigation_status === 'Active Research' ||
      r.investigation_status === 'Approved'
    ).length
    const published = records.filter(r => r.investigation_status === 'Published').length
    const withVrs   = records.filter(r => !isNaN(extractNum(r.wp_vrs ?? '')))
    const avgVrs    = withVrs.length
      ? (withVrs.reduce((s, r) => s + norm10(extractNum(r.wp_vrs ?? '')), 0) / withVrs.length).toFixed(1)
      : '—'
    const distributed = records.filter(r => r.wordpress_press_release_url).length
    return { active, published, avgVrs, distributed, total: records.length }
  }, [records])

  /* ─── Category pills ── */
  const categories = useMemo(() => {
    const seen = new Set<string>()
    records.forEach(r => { if (r.investigation_category) seen.add(r.investigation_category) })
    return ['All', ...Array.from(seen).sort()]
  }, [records])

  /* ─── Stage filter ── */
  function matchStage(r: Investigation, f: StageFilter) {
    if (f === 'All') return true
    if (f === 'Development')      return (
      r.investigation_status === 'Intake' ||
      r.investigation_status === 'Generating' ||
      r.investigation_status === 'Active Research'
    )
    if (f === 'Placement Window') return r.investigation_status === 'Approved'
    if (f === 'Placed')           return r.investigation_status === 'Published'
    return true
  }

  /* ─── Filtered + sorted ── */
  const filtered = useMemo(() => {
    let list = records
    if (catFilter !== 'All')   list = list.filter(r => r.investigation_category === catFilter)
    if (stageFilter !== 'All') list = list.filter(r => matchStage(r, stageFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.company_name.toLowerCase().includes(q) ||
        r.ticker_symbol.toLowerCase().includes(q) ||
        r.brief_topic.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sort === 'vrs-desc') return norm10(extractNum(b.wp_vrs ?? '')) - norm10(extractNum(a.wp_vrs ?? ''))
      if (sort === 'vrs-asc')  return norm10(extractNum(a.wp_vrs ?? '')) - norm10(extractNum(b.wp_vrs ?? ''))
      if (sort === 'updated')  return new Date(b.last_modified ?? 0).getTime() - new Date(a.last_modified ?? 0).getTime()
      return a.company_name.localeCompare(b.company_name)
    })
  }, [records, catFilter, stageFilter, search, sort])

  /* ─── Section splits ── */
  const hasWpScore = (r: Investigation) => {
    const n = extractNum(r.wp_vrs ?? '')
    return !isNaN(n) && n > 0
  }

  const placementWindow = filtered.filter(r =>
    (r.investigation_status === 'Published' || r.investigation_status === 'Approved') && hasWpScore(r)
  )

  const inDevelopmentPipeline = (r: Investigation) =>
    r.investigation_status === 'Intake' ||
    r.investigation_status === 'Generating' ||
    r.investigation_status === 'Active Research'

  const activeResearch = filtered.filter((r) => inDevelopmentPipeline(r))

  const backgroundWatch = filtered.filter((r) => {
    const isPublishedNoScore =
      (r.investigation_status === 'Published' || r.investigation_status === 'Approved') && !hasWpScore(r)
    return isPublishedNoScore
  })

  /* ─── Stage counts ── */
  const stageCounts = {
    All:              records.length,
    Development:      records.filter(r =>
      r.investigation_status === 'Intake' ||
      r.investigation_status === 'Generating' ||
      r.investigation_status === 'Active Research'
    ).length,
    'Placement Window': records.filter(r => r.investigation_status === 'Approved').length,
    Placed:           records.filter(r => r.investigation_status === 'Published').length,
  }

  /* ─── Skeleton ── */
  const Skeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl animate-pulse" style={{ height: '220px', backgroundColor: SURFACE }} />
      ))}
    </div>
  )

  return (
    <div style={{ backgroundColor: PAGE, minHeight: '100vh', paddingBottom: '0' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

        {/* ── Page header ── */}
        <div style={{ paddingTop: '40px', paddingBottom: '28px' }}>
          <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>
            ACTIVE RESEARCH
          </p>
          <h1 style={{ color: T1, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, lineHeight: 1.1, marginBottom: '10px' }}>
            Investigations
          </h1>
          <p style={{ color: T2, fontSize: '14px', maxWidth: '560px', lineHeight: 1.6 }}>
            Signal&apos;s active research portfolio. Each investigation tracks observable patterns under the Vigilant™ methodology.
          </p>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'ACTIVE MATTERS',   value: stats.active,       sub: `${records.length} total tracked` },
            { label: 'PLACEMENT WINDOW', value: stats.published,    sub: 'Published · live', highlight: true },
            { label: 'AVG. VRS',         value: stats.avgVrs,       sub: 'Vigilant Risk Score' },
            { label: 'PRESS RELEASED',   value: stats.distributed,  sub: 'With press release' },
            { label: 'TOTAL TRACKED',    value: stats.total,        sub: 'All statuses' },
          ].map(({ label, value, sub, highlight }) => (
            <div key={label} style={{
              backgroundColor: SURFACE,
              border: `1px solid ${highlight ? 'rgba(245,158,11,.5)' : BORDER}`,
              borderRadius: '12px', padding: '16px',
            }}>
              <p style={{ color: T3, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
              <p style={{ color: highlight ? '#f59e0b' : T1, fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{value}</p>
              <p style={{ color: T3, fontSize: '11px', marginTop: '4px' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Filter bar — single horizontal row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
          marginBottom: '32px', paddingBottom: '20px',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <span style={{ color: T3, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '2px', flexShrink: 0 }}>
            STAGE
          </span>

          {(['All', 'Development', 'Placement Window', 'Placed'] as StageFilter[]).map((f) => {
            const active = stageFilter === f
            const count  = stageCounts[f]
            return (
              <button key={f} onClick={() => setStageFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                  backgroundColor: active ? 'rgba(99,102,241,.85)' : 'transparent',
                  color: active ? '#fff' : T2,
                  border: `1px solid ${active ? 'rgba(99,102,241,.85)' : BORDER}`,
                }}>
                {f} <span style={{ opacity: 0.7 }}>{count}</span>
              </button>
            )
          })}

          {/* Search */}
          <div style={{ flex: '1 1 160px', maxWidth: '300px', position: 'relative', marginLeft: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke={T3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Search company, ticker…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: '28px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
                borderRadius: '999px', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
                backgroundColor: SURFACE, color: T1, border: `1px solid ${BORDER}`, caretColor: '#f59e0b',
              }} />
          </div>

          {/* Sort */}
          <span style={{ color: T3, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
            SORT
          </span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              fontSize: '12px', borderRadius: '6px', padding: '6px 10px', outline: 'none', cursor: 'pointer',
              backgroundColor: SURFACE, color: T1, border: `1px solid ${BORDER}`, flexShrink: 0,
            }}>
            <option value="vrs-desc">VRS High → Low</option>
            <option value="vrs-asc">VRS Low → High</option>
            <option value="updated">Updated (Newest)</option>
            <option value="az">Company (A–Z)</option>
          </select>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            borderRadius: '12px', padding: '12px 16px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
            backgroundColor: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171',
          }}>
            {error}
            <button onClick={fetchRecords} style={{ marginLeft: '8px', textDecoration: 'underline', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>
              Retry
            </button>
          </div>
        )}

        {loading ? <Skeleton /> : (
          <>
            {/* ── Placement Window ── */}
            {(stageFilter === 'All' || stageFilter === 'Placement Window' || stageFilter === 'Placed') && placementWindow.length > 0 && (
              <div style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ color: T1, fontSize: '22px', fontWeight: 700 }}>Placement Window</h2>
                    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, backgroundColor: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>
                      {placementWindow.length} active
                    </span>
                  </div>
                  <span style={{ color: T3, fontSize: '12px', fontFamily: 'monospace' }}>
                    VRS ≥ 7.0 · class threshold met · accepting Circle interest
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {placementWindow.map(r => <PlacementCard key={r.id} r={r} />)}
                </div>
              </div>
            )}

            {/* ── Active Research ── */}
            {(stageFilter === 'All' || stageFilter === 'Development') && activeResearch.length > 0 && (
              <div style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ color: T1, fontSize: '22px', fontWeight: 700 }}>Active Research</h2>
                    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, backgroundColor: 'rgba(99,102,241,.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,.3)' }}>
                      {activeResearch.length} in development
                    </span>
                  </div>
                  <span style={{ color: T3, fontSize: '12px', fontFamily: 'monospace' }}>
                    Evidence assembly · class qualification · exposure modeling
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeResearch.map(r => <ResearchCard key={r.id} r={r} />)}
                </div>
              </div>
            )}

            {/* ── Background Watch ── */}
            {(stageFilter === 'All' || stageFilter === 'Development') && backgroundWatch.length > 0 && (
              <div style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ color: T1, fontSize: '22px', fontWeight: 700 }}>Background Watch</h2>
                    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, backgroundColor: 'rgba(100,116,139,.15)', color: T2, border: `1px solid rgba(100,116,139,.3)` }}>
                      {backgroundWatch.length} in research
                    </span>
                  </div>
                  <span style={{ color: T3, fontSize: '12px', fontFamily: 'monospace' }}>
                    Early-stage signal monitoring · pre-development · public profiles thin
                  </span>
                </div>

                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 60px 160px 70px 70px 60px',
                  gap: '0 12px',
                  padding: '8px 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  borderTop: `1px solid ${BORDER}`,
                  marginBottom: '2px',
                }}>
                  {['MATTER', 'RISK TYPE', 'VRS', 'ESCALATION', 'THI', 'UPDATED', ''].map((h) => (
                    <p key={h} style={{ color: T3, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</p>
                  ))}
                </div>

                {/* Rows */}
                <div>
                  {backgroundWatch.map(r => <WatchRow key={r.id} r={r} />)}
                </div>
              </div>
            )}

            {/* ── Empty ── */}
            {filtered.length === 0 && (
              <div style={{ padding: '80px 0', textAlign: 'center' }}>
                <p style={{ color: T2, fontSize: '14px', fontWeight: 600 }}>No investigations match your filters</p>
                <p style={{ color: T3, fontSize: '12px', marginTop: '6px' }}>Try clearing the filters or search term</p>
                <button onClick={() => { setCatFilter('All'); setStageFilter('All'); setSearch('') }}
                  style={{ marginTop: '16px', padding: '8px 18px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer disclaimer ── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '32px', padding: '24px 24px 32px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <p style={{ color: T3, fontSize: '11px', lineHeight: 1.7, maxWidth: '900px' }}>
            <strong style={{ color: T2 }}>Disclaimer:</strong>{' '}
            Signal Law Group is an independent investigations and research firm. We do not give legal advice, represent clients, or participate in litigation.
            Vigilant™ scores reflect observable patterns derived from public information and proprietary methodology.
            Stage classifications reflect Signal&apos;s research workflow and do not predict litigation outcomes.
            © 2026 Signal Law Group. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
