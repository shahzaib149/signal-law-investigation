'use client'

import { useCallback, useEffect, useState } from 'react'

/* ─── Types ──────────────────────────────────────────────────────── */

interface XprPublisher {
  name?: string
  outlet?: string
  network?: string
  city?: string
  state?: string
  sourceUrl?: string
  url?: string
  link?: string
}

interface XprStatus {
  total:      number
  live:       number
  pending:    number
  publishers: XprPublisher[]
}

type Badge = 'Live' | 'Partially Live' | 'Pending' | 'Not Distributed'

/* ─── Helpers ────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(data: any): XprStatus {
  const d = data?.data ?? data ?? {}
  return {
    total:      Number(d.total      ?? d.totalCount      ?? 0),
    live:       Number(d.live       ?? d.liveCount       ?? d.published ?? 0),
    pending:    Number(d.pending    ?? d.pendingCount    ?? d.queued    ?? 0),
    publishers: Array.isArray(d.publishers) ? d.publishers :
                Array.isArray(d.items)      ? d.items      :
                Array.isArray(d.outlets)    ? d.outlets    : [],
  }
}

function getBadge(s: XprStatus | null): Badge {
  if (!s || s.total === 0) return 'Not Distributed'
  if (s.live === 0)        return 'Pending'
  if (s.live < s.total)    return 'Partially Live'
  return 'Live'
}

const BADGE_STYLE: Record<Badge, { bg: string; text: string; border: string }> = {
  'Not Distributed': { bg: '#f9fafb', text: '#6b7280',  border: '#e5e7eb' },
  'Pending':         { bg: '#fefce8', text: '#854d0e',  border: '#fde047' },
  'Partially Live':  { bg: '#f0fdf4', text: '#166534',  border: '#86efac' },
  'Live':            { bg: '#dcfce7', text: '#15803d',  border: '#4ade80' },
}

/* ─── Props ──────────────────────────────────────────────────────── */

interface Props {
  postId:  number
  title:   string
  summary: string
  link:    string
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function XprDistributionPanel({ postId, title, summary, link }: Props) {
  const [open,          setOpen]          = useState(true)
  const [xprStatus,     setXprStatus]     = useState<XprStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError,   setStatusError]   = useState<string | null>(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError,   setSubmitError]   = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    setStatusError(null)
    try {
      const res  = await fetch(`/api/xpr-status?postId=${postId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Status fetch failed')
      setXprStatus(normalize(data))
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoadingStatus(false)
    }
  }, [postId])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const res  = await fetch('/api/xpr-submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, summary, link, guid: link }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed')
      setSubmitSuccess(data.message ?? 'Successfully submitted to 226 publishers')
      await fetchStatus()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const badge       = getBadge(xprStatus)
  const badgeStyle  = BADGE_STYLE[badge]
  const showSubmit  = !submitSuccess && (badge === 'Not Distributed' || badge === 'Pending')
  const liveCount   = xprStatus?.live    ?? 0
  const pendingCount= xprStatus?.pending ?? 0
  const totalCount  = xprStatus?.total   ?? 0
  const livePublishers = (xprStatus?.publishers ?? []).filter(
    (p) => !p.sourceUrl && !p.url && !p.link ? false : true
  )

  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>

      {/* ── Header / toggle ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* newspaper icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
          </svg>
          <span className="text-sm font-bold text-gray-900 uppercase tracking-[0.13em]">
            Press Release Distribution
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
            whiteSpace: 'nowrap',
            backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`,
          }}>
            {badge}
          </span>
        </div>

        {/* Chevron */}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 ml-3"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Body ── */}
      {open && (
        <div className="px-5 sm:px-6 py-5">

          {/* Loading */}
          {loadingStatus && (
            <div className="flex items-center gap-2.5 py-3">
              <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-400">Checking distribution status…</span>
            </div>
          )}

          {/* Error */}
          {!loadingStatus && statusError && (
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-red-600">{statusError}</span>
              <button onClick={fetchStatus} className="text-xs font-semibold underline underline-offset-2 ml-3"
                style={{ color: '#e31837' }}>
                Retry
              </button>
            </div>
          )}

          {/* Status summary */}
          {!loadingStatus && !statusError && xprStatus && (
            <>
              {totalCount > 0 && (
                <div className="flex items-center gap-4 mb-4 pb-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold text-gray-700">{liveCount} Live</span>
                  </div>
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                      <span className="text-xs font-semibold text-gray-700">{pendingCount} Pending</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{totalCount} total publishers</span>
                </div>
              )}

              {/* Live publisher list */}
              {livePublishers.length > 0 && (
                <div className="space-y-2 mb-4">
                  {livePublishers.map((p, i) => {
                    const href = p.sourceUrl ?? p.url ?? p.link
                    const name = p.name ?? p.outlet ?? 'Publisher'
                    const meta = [p.network, p.city && p.state ? `${p.city}, ${p.state}` : (p.city ?? p.state)]
                      .filter(Boolean).join(' · ')
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg"
                        style={{ backgroundColor: '#f9fafb', border: '1px solid #f3f4f6' }}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{name}</p>
                          {meta && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta}</p>}
                        </div>
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold transition-colors"
                            style={{ color: '#e31837' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#b01228')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#e31837')}>
                            View ↗
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Not distributed empty state */}
              {totalCount === 0 && (
                <p className="text-xs text-gray-400 mb-4">
                  This press release has not been distributed yet.
                </p>
              )}
            </>
          )}

          {/* Submit success */}
          {submitSuccess && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="font-semibold">{submitSuccess}</span>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="rounded-lg px-4 py-3 mb-4 text-xs"
              style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626' }}>
              {submitError}
            </div>
          )}

          {/* Distribute button */}
          {!loadingStatus && showSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: submitting ? '#b01228' : '#e31837' }}
              onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#b01228' }}
              onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#e31837' }}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Distribute Press Release
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
