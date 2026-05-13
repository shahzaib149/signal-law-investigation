'use client'

import type { Investigation } from '@/types/investigation'

const BORDER = 'rgba(255,255,255,0.08)'
const T3 = '#4b6a9b'

/** Category pills — Securities indigo, Consumer orange, Platform red, Regulatory teal, Insurance amber */
function categoryStyle(cat: string) {
  if (cat.includes('Securities')) return { bg: 'rgba(99,102,241,.18)',  text: '#818cf8', border: 'rgba(99,102,241,.35)' }
  if (cat.includes('Consumer'))   return { bg: 'rgba(249,115,22,.18)',  text: '#fb923c', border: 'rgba(249,115,22,.35)' }
  if (cat.includes('Platform'))   return { bg: 'rgba(239,68,68,.18)',   text: '#f87171', border: 'rgba(239,68,68,.35)'  }
  if (cat.includes('Regulatory')) return { bg: 'rgba(20,184,166,.18)',  text: '#2dd4bf', border: 'rgba(20,184,166,.35)' }
  if (cat.includes('Insurance'))  return { bg: 'rgba(251,146,60,.18)',  text: '#fb923c', border: 'rgba(251,146,60,.35)' }
  return                                 { bg: 'rgba(100,116,139,.18)', text: '#94a3b8', border: 'rgba(100,116,139,.35)' }
}

function vrsBandLabel(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n <= 39) return 'Low'
  if (n <= 54) return 'Moderate'
  if (n <= 69) return 'Elevated'
  if (n <= 84) return 'High Risk'
  return 'Critical'
}

function cisBandLabel(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n <= 39) return 'Low'
  if (n <= 59) return 'Moderate'
  if (n <= 79) return 'High'
  return 'Very High'
}

/** THI display from LRI score */
function thiFromLri(lri: number | undefined): { display: string; sub: string } {
  if (lri === undefined || !Number.isFinite(lri)) return { display: '—', sub: '' }
  if (lri >= 80) return { display: '<6mo', sub: 'Short' }
  if (lri >= 60) return { display: '6-18mo', sub: 'Mid' }
  return { display: '18mo+', sub: 'Long' }
}

function vrsNumColor(n: number): string {
  if (!Number.isFinite(n)) return '#94a3b8'
  if (n >= 85) return '#ef4444'
  if (n >= 70) return '#f97316'
  if (n >= 55) return '#f59e0b'
  return '#f1f5f9'
}

function stageFillFromVrs(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n <= 20) return 1
  if (n <= 40) return 2
  if (n <= 60) return 3
  if (n <= 80) return 4
  return 5
}

function segmentFillColor(vrs: number): string {
  if (!Number.isFinite(vrs) || vrs <= 0) return '#1e3a5f'
  if (vrs <= 40) return '#14b8a6'
  if (vrs <= 60) return '#f59e0b'
  if (vrs <= 80) return '#f97316'
  return '#ef4444'
}

function isAccelerating(severity: string | undefined): boolean {
  const s = (severity ?? '').toLowerCase()
  return s === 'high' || s === 'critical'
}

function launchButtonMode(rec: string | undefined): 'launch' | 'escalate' | 'watch' {
  const r = (rec ?? '').trim().toLowerCase()
  if (r.includes('escalate')) return 'escalate'
  if (r.includes('watchlist') || r.includes('monitor')) return 'watch'
  return 'launch'
}

/** Prefer long-form Airtable "Why It Matters"; fall back to Risk Summary only when empty. */
function whyNarrativeFromTopic(topic: Investigation): string {
  const why = topic.why_it_matters?.trim() ?? ''
  const risk = topic.risk_summary?.trim() ?? ''
  if (why.length > 0) return why
  return risk
}

/** True when Risk Summary is only a VRS/shorthand line (avoid duplicating the exposure meter). */
function isVrsShorthandOnly(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return /^VRS\s*\d+/i.test(t) && t.length <= 80
}

interface TopicCardProps {
  topic: Investigation
  onLaunch: () => void
  isLaunching?: boolean
}

function ScoreCell({
  label, value, sub, valueColor,
}: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <div className="min-w-0">
      <p className="uppercase tracking-wider mb-0.5 sm:mb-1" style={{ color: T3, fontSize: '9px', letterSpacing: '0.09em' }}>{label}</p>
      <p className="tabular-nums leading-none font-bold text-[22px] sm:text-[26px] truncate" style={{ color: valueColor ?? '#f1f5f9' }}>{value}</p>
      <p className="mt-0.5 sm:mt-1 line-clamp-2" style={{ color: T3, fontSize: '10px' }}>{sub}</p>
    </div>
  )
}

function StageBar({ vrs }: { vrs: number }) {
  const fill = stageFillFromVrs(vrs)
  const fillColor = segmentFillColor(vrs)
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-3.5">
      <span className="shrink-0" style={{ color: T3, fontSize: '10px', whiteSpace: 'nowrap' }}>Stage</span>
      <div className="flex gap-[3px] flex-1 min-w-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[5px] min-w-0 flex-1 rounded-full"
            style={{
              backgroundColor: i <= fill ? fillColor : '#1e3a5f',
            }}
          />
        ))}
      </div>
      <span className="shrink-0" style={{ color: T3, fontSize: '10px', whiteSpace: 'nowrap' }}>Development</span>
    </div>
  )
}

/** Continuous VRS 0–100 bar — band label matches the VRS score cell (Airtable VRS Score). */
function VrsExposureMeter({ vrs, severityLevel }: { vrs: number; severityLevel?: string }) {
  const finite = Number.isFinite(vrs)
  const pct = finite ? Math.min(100, Math.max(0, vrs)) : 0
  const band = finite ? vrsBandLabel(vrs) : '—'
  const fillColor = finite ? segmentFillColor(vrs) : '#334d6e'
  const sev = severityLevel?.trim()
  if (!finite && !sev) return null

  return (
    <div
      className="rounded-lg px-3 py-2.5 mt-3"
      style={{
        backgroundColor: 'rgba(15,23,42,.45)',
        border: `1px solid ${BORDER}`,
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span style={{ color: T3, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Exposure (VRS)
        </span>
        <span className="tabular-nums shrink-0" style={{ fontSize: '12px', fontWeight: 700, color: finite ? vrsNumColor(vrs) : '#94a3b8' }}>
          {finite ? `${Math.round(vrs)}` : '—'}
          <span style={{ color: T3, fontWeight: 600, marginLeft: '6px' }}>{finite ? band : ''}</span>
        </span>
      </div>
      {finite && (
        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#0f172a', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor}dd 100%)`,
              boxShadow: `0 0 12px ${fillColor}55`,
            }}
          />
        </div>
      )}
      {sev && (
        <p className="mt-1.5" style={{ color: T3, fontSize: '10px', lineHeight: 1.4 }}>
          Severity:{' '}
          <span style={{ color: '#fbbf24', fontWeight: 600, textTransform: 'capitalize' }}>{sev}</span>
        </p>
      )}
    </div>
  )
}

export default function TopicCard({ topic, onLaunch, isLaunching }: TopicCardProps) {
  const cs = categoryStyle(topic.investigation_category)
  const vrs = topic.vrs_score
  const cis = topic.confidence_score
  const lri = topic.lri_score
  const thi = thiFromLri(lri)
  const accelerating = isAccelerating(topic.severity_level)
  const whyPrimary = whyNarrativeFromTopic(topic)
  const riskOnly = topic.risk_summary?.trim() ?? ''
  const showRiskAsCaption =
    whyPrimary.length > 0 &&
    riskOnly.length > 0 &&
    riskOnly !== whyPrimary &&
    !whyPrimary.includes(riskOnly) &&
    !isVrsShorthandOnly(riskOnly)
  const whyBody = whyPrimary
  const btnMode = launchButtonMode(topic.launch_recommendation)
  const subtitle = [topic.ticker_symbol, topic.brief_topic].filter(Boolean).join(' · ')

  const vrsDisplay = vrs !== undefined && Number.isFinite(vrs) ? String(Math.round(vrs)) : '—'
  const cisDisplay = cis !== undefined && Number.isFinite(cis) ? String(Math.round(cis)) : '—'

  const vrsN = vrs ?? NaN
  const cisN = cis ?? NaN

  return (
    <article
      className="flex flex-col rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-lg hover:shadow-black/25"
      style={{ backgroundColor: '#111c30', border: `1px solid ${BORDER}` }}
    >
      <div className="flex-1 flex flex-col p-5">

        <div className="flex items-start justify-between gap-2 mb-3">
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '4px',
            backgroundColor: cs.bg, color: cs.text, border: `1px solid ${cs.border}`,
          }}>
            {topic.investigation_category || 'Uncategorized'}
          </span>
          {accelerating ? (
            <span style={{
              fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', color: '#f97316',
            }}>
              ↗ Accelerating
            </span>
          ) : topic.investigation_status === 'Intake' ? (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
              backgroundColor: 'rgba(59,130,246,.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,.25)',
            }}>
              Intake
            </span>
          ) : (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
              backgroundColor: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.25)',
            }}>
              Pending Review
            </span>
          )}
        </div>

        <h3 style={{ color: '#f1f5f9', fontSize: '17px', fontWeight: 700, lineHeight: 1.25, marginBottom: '6px' }}>
          {topic.company_name}
        </h3>

        {subtitle && (
          <p className="line-clamp-2 mb-3" style={{ color: T3, fontSize: '12px', lineHeight: 1.45 }}>
            {subtitle}
          </p>
        )}

        {/* Institutional score strip — matches Investigations dark cards */}
        <div
          className="grid grid-cols-3 gap-2 sm:gap-0 mb-1"
          style={{ alignItems: 'start' }}
        >
          <div className="pr-1 sm:pr-3 border-r min-w-0" style={{ borderColor: BORDER }}>
            <ScoreCell
              label="VRS"
              value={vrsDisplay}
              sub={Number.isFinite(vrsN) ? vrsBandLabel(vrsN) : '—'}
              valueColor={Number.isFinite(vrsN) ? vrsNumColor(vrsN) : '#94a3b8'}
            />
          </div>
          <div className="px-1 sm:px-3 border-r min-w-0" style={{ borderColor: BORDER }}>
            <ScoreCell
              label="CIS"
              value={cisDisplay}
              sub={Number.isFinite(cisN) ? cisBandLabel(cisN) : '—'}
            />
          </div>
          <div className="pl-1 sm:pl-3 min-w-0">
            <ScoreCell
              label="THI"
              value={thi.display}
              sub={thi.sub}
            />
          </div>
        </div>

        <StageBar vrs={Number.isFinite(vrsN) ? vrsN : 0} />

        {(Number.isFinite(vrsN) || (topic.severity_level?.trim() ?? '').length > 0) && (
          <VrsExposureMeter vrs={vrsN} severityLevel={topic.severity_level} />
        )}

        {(whyBody || riskOnly) && (
          <div className="rounded-lg px-3 py-2.5 mt-3" style={{
            backgroundColor: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.18)',
          }}>
            <p style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Why It Matters
            </p>
            {whyBody ? (
              <p className="line-clamp-5" style={{ color: '#e2d4a8', fontSize: '12px', lineHeight: 1.55 }}>
                {whyBody}
              </p>
            ) : (
              <p className="line-clamp-3" style={{ color: '#c8a84b', fontSize: '12px', lineHeight: 1.5 }}>
                {riskOnly}
              </p>
            )}
            {showRiskAsCaption && (
              <p className="line-clamp-2 mt-2 pt-2" style={{
                borderTop: '1px solid rgba(245,158,11,.15)',
                color: T3,
                fontSize: '10px',
                lineHeight: 1.45,
              }}>
                <span style={{ fontWeight: 700, color: '#94a3b8' }}>Risk summary · </span>
                {riskOnly}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-1">
          {topic.suggested_date && (
            <p style={{ color: '#334d6e', fontSize: '11px' }}>
              Signal Date: {topic.suggested_date}
            </p>
          )}
          {topic.priority_rank !== undefined && topic.priority_rank !== null && String(topic.priority_rank).trim() !== '' && (
            <p style={{ color: '#334d6e', fontSize: '11px' }}>
              Priority Rank #{String(topic.priority_rank)}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        {isLaunching ? (
          <div
            className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 badge-generating"
            style={{ backgroundColor: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />
            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>Generating...</span>
          </div>
        ) : btnMode === 'launch' ? (
          <button
            type="button"
            onClick={onLaunch}
            className="topic-card-launch-primary w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 focus:outline-none"
            style={{ backgroundColor: '#e31837' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b01228')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e31837')}
          >
            Launch Investigation ▶
          </button>
        ) : btnMode === 'escalate' ? (
          <button
            type="button"
            onClick={onLaunch}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 focus:outline-none"
            style={{ backgroundColor: '#d97706' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b45309')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
          >
            Escalate ▶
          </button>
        ) : (
          <button
            type="button"
            onClick={onLaunch}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 focus:outline-none"
            style={{
              backgroundColor: 'rgba(30,58,95,.85)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(51,77,110,.95)'
              e.currentTarget.style.color = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(30,58,95,.85)'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            {topic.launch_recommendation?.trim() || 'Monitor'} ▶
          </button>
        )}
      </div>
    </article>
  )
}
