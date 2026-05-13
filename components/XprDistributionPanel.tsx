'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Set `NEXT_PUBLIC_XPR_CLIENT_DEBUG=1` in `.env.local` and rebuild: browser console logs + raw `xpr` on validate/publish responses. */
const XPR_CLIENT_DEBUG = process.env.NEXT_PUBLIC_XPR_CLIENT_DEBUG === '1'

/* ─── Validation cache (localStorage, 24-hour TTL) ─────────────────
 * Only **passed** prechecks are cached. Failed scores (e.g. empty HTML on first paint)
 * were being stored and reused for 24h — different origins (localhost vs Vercel) then
 * looked like "75 local / 15 production" when production had a stale bad cache.
 */

function cacheKey(link: string, contentFingerprint: string) {
  const safe = `${link}|${contentFingerprint}`.replace(/[^a-z0-9|]/gi, '_').slice(-96)
  return `xpr_val_v3_${safe}`
}

function contentFingerprint(content: string, title: string): string {
  const c = content ?? ''
  const t = title ?? ''
  return `${c.length}:${t.length}:${c.slice(0, 64)}`
}

function readCache(link: string, contentFingerprintStr: string): ValidationResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(link, contentFingerprintStr))
    if (!raw) return null
    const { result, ts } = JSON.parse(raw) as { result: ValidationResult; ts: number }
    if (Date.now() - ts > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(cacheKey(link, contentFingerprintStr))
      return null
    }
    if (!result.passed) {
      localStorage.removeItem(cacheKey(link, contentFingerprintStr))
      return null
    }
    return result
  } catch { return null }
}

function writeCache(link: string, contentFingerprintStr: string, result: ValidationResult) {
  if (!result.passed) return
  try {
    localStorage.setItem(cacheKey(link, contentFingerprintStr), JSON.stringify({ result, ts: Date.now() }))
  } catch { /* ignore */ }
}

function clearCache(link: string, contentFingerprintStr: string) {
  try { localStorage.removeItem(cacheKey(link, contentFingerprintStr)) } catch { /* ignore */ }
}

/** Remove legacy v2 keys for this link suffix (one-time cleanup on re-validate). */
function clearLegacyV2Cache(link: string) {
  try {
    const legacy = `xpr_val_v2_${link.replace(/[^a-z0-9]/gi, '_').slice(-80)}`
    localStorage.removeItem(legacy)
  } catch { /* ignore */ }
}

/* ─── Types ──────────────────────────────────────────────────────── */

interface XprPublisher {
  name?: string; outlet?: string; network?: string; type?: string
  city?: string; state?: string; location?: string
  publishedAt?: string; date?: string
  sourceUrl?: string; url?: string; link?: string
}

interface XprStatus {
  overallStatus: string
  totalWebsites: number
  liveSince:     string | null
  published:     number
  pending:       number
  needsReview:   number
  aiScore:       number
  liveAt:        XprPublisher[]
  pendingAt:     XprPublisher[]
}

interface ValidationResult {
  passed: boolean; score: number
  classification: string; summary: string
  failedFilters: string[]
}

type Phase = 'checking-status' | 'validating' | 'ready' | 'publishing' | 'distributed'
type Pkg   = 'boost' | 'boost+' | 'boost-pro'
type Tab   = 'live' | 'pending'
type Badge = 'Live' | 'Partially Live' | 'Pending' | 'Not Distributed'

/* ─── Constants ──────────────────────────────────────────────────── */

const BADGE_STYLE: Record<Badge, { bg: string; text: string; border: string }> = {
  'Not Distributed': { bg: 'rgba(100,116,139,.18)', text: '#94a3b8', border: 'rgba(100,116,139,.35)' },
  'Pending':         { bg: 'rgba(245,158,11,.14)',  text: '#f59e0b', border: 'rgba(245,158,11,.35)'  },
  'Partially Live':  { bg: 'rgba(16,185,129,.14)',  text: '#34d399', border: 'rgba(16,185,129,.35)'  },
  'Live':            { bg: 'rgba(16,185,129,.20)',  text: '#6ee7b7', border: 'rgba(16,185,129,.45)'  },
}

const PACKAGES: { id: Pkg; label: string; sites: string; desc: string }[] = [
  { id: 'boost',     label: 'Boost',     sites: '~1,250', desc: 'Core regional & national outlets' },
  { id: 'boost+',    label: 'Boost+',    sites: '~2,000', desc: 'Extended + financial wire coverage' },
  { id: 'boost-pro', label: 'Boost Pro', sites: '~3,000', desc: 'Maximum national + premium wire' },
]

/* ─── Helpers ────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(data: any): XprStatus {
  const d = data?.data ?? data ?? {}
  return {
    overallStatus: String(d.status ?? d.overallStatus ?? (Number(d.live ?? d.published ?? 0) > 0 ? 'Published' : 'Pending')),
    totalWebsites: Number(d.totalWebsites ?? d.total      ?? d.totalCount   ?? 0),
    liveSince:     d.liveSince ?? d.liveAt?.[0]?.publishedAt ?? null,
    published:     Number(d.published ?? d.live      ?? d.liveCount    ?? 0),
    pending:       Number(d.pending   ?? d.pendingCount ?? d.queued     ?? 0),
    needsReview:   Number(d.needsReview ?? d.needsReviewCount ?? 0),
    aiScore:       Number(d.aiScore   ?? d.aiAnalysis?.score ?? 0),
    liveAt:        Array.isArray(d.liveAt)     ? d.liveAt     :
                   Array.isArray(d.publishers) ? d.publishers :
                   Array.isArray(d.items)      ? d.items      : [],
    pendingAt:     Array.isArray(d.pendingAt)  ? d.pendingAt  : [],
  }
}

function getBadge(s: XprStatus | null): Badge {
  if (!s || s.totalWebsites === 0) return 'Not Distributed'
  if (s.published === 0)           return 'Pending'
  if (s.published < s.totalWebsites) return 'Partially Live'
  return 'Live'
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).replace(',', ',')
  } catch { return iso }
}

/* ─── Props ──────────────────────────────────────────────────────── */

interface Props {
  title:      string
  summary:    string
  content:    string
  link:       string
  imageUrl?:  string
  /** WordPress post slug — used as XPR `guid` when no explicit storyGuid */
  slug?:       string
  /** Airtable `XPR Story GUID` — must match what was / will be sent to XPR ingest */
  storyGuid?: string
  /** ISO-ish date from WordPress `date` — sent as `publishedAt` to XPR */
  publishedAt?: string
  investigationCategory?: string
  recordId?:  string
  isPdf?:     boolean
  onLinkChange?: (newLink: string) => void
}

/* ─── Spinner ────────────────────────────────────────────────────── */

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-3">
      <svg className="animate-spin h-4 w-4 shrink-0" style={{ color: '#4b6a9b' }} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-xs" style={{ color: '#4b6a9b' }}>{label}</span>
    </div>
  )
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function XprDistributionPanel({
  title,
  summary,
  content,
  link,
  imageUrl,
  slug,
  storyGuid,
  publishedAt,
  investigationCategory,
  recordId,
  isPdf,
  onLinkChange,
}: Props) {
  const [open,          setOpen]          = useState(true)
  const [phase,         setPhase]         = useState<Phase>('checking-status')
  const [status,        setStatus]        = useState<XprStatus | null>(null)
  const [activeTab,     setActiveTab]     = useState<Tab>('live')
  const [validation,    setValidation]    = useState<ValidationResult | null>(null)
  const [selectedPkg,   setSelectedPkg]   = useState<Pkg>('boost')
  const [statusError,   setStatusError]   = useState<string | null>(null)
  const [validateError, setValidateError] = useState<string | null>(null)
  const [publishError,  setPublishError]  = useState<string | null>(null)
  const [replaceFile,   setReplaceFile]   = useState<File | null>(null)
  const [replacing,     setReplacing]     = useState(false)
  const [replaceError,  setReplaceError]  = useState<string | null>(null)

  // Stable refs so callbacks don't cause cascade re-renders
  const propsRef = useRef({
    title, summary, content, link, imageUrl, slug, storyGuid, publishedAt, investigationCategory, isPdf,
  })
  useEffect(() => {
    propsRef.current = {
      title, summary, content, link, imageUrl, slug, storyGuid, publishedAt, investigationCategory, isPdf,
    }
  }, [title, summary, content, link, imageUrl, slug, storyGuid, publishedAt, investigationCategory, isPdf])

  /* ─── Validate ─── */
  const validate = useCallback(async (overrideContent?: string, force = false) => {
    const { title: t, summary: s, content: c, link: l, imageUrl: img } = propsRef.current

    const fp = contentFingerprint(overrideContent ?? c, t)

    // Use cache only for **passed** prechecks (see readCache / writeCache).
    if (!overrideContent && !force) {
      const cached = readCache(l, fp)
      if (cached) {
        setValidation(cached)
        setPhase('ready')
        return
      }
    }

    setPhase('validating')
    setValidateError(null)
    try {
      const p = propsRef.current
      const requestBody = {
        title: t,
        summary: s,
        content: overrideContent ?? c,
        link: l,
        imageUrl: img,
        slug: p.slug,
        guid: p.storyGuid,
        publishedAt: p.publishedAt,
        investigationCategory: p.investigationCategory,
        includeXprRaw: XPR_CLIENT_DEBUG,
      }
      if (XPR_CLIENT_DEBUG) {
        console.log('[SignalLaw XPR] → POST /api/xpr-validate (payload to our server)', requestBody)
      }
      const res  = await fetch('/api/xpr-validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(requestBody),
      })
      const data = await res.json()
      if (XPR_CLIENT_DEBUG) {
        console.log('[SignalLaw XPR] ← POST /api/xpr-validate (response from our server)', data)
      }
      if (!res.ok) throw new Error(data.error ?? 'Validation failed')
      const result: ValidationResult = {
        passed:         Boolean(data.passed),
        score:          Number(data.score ?? 0),
        classification: String(data.classification ?? ''),
        summary:        String(data.summary ?? ''),
        failedFilters:  Array.isArray(data.failedFilters) ? data.failedFilters : [],
      }
      writeCache(l, fp, result)
      setValidation(result)
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setPhase('ready')
    }
  }, []) // No prop deps — reads from propsRef

  /* ─── Check status ─── */
  const checkStatus = useCallback(async () => {
    const { link: l, slug: sl, storyGuid: g } = propsRef.current
    setPhase('checking-status')
    setStatusError(null)

    /** Avoid precheck while HTML is still empty — ref updates as parent finishes loading. */
    const waitForArticleBody = async () => {
      if (propsRef.current.isPdf === true) return
      const minChars = 280
      const maxWaitMs = 5_000
      const stepMs = 100
      const deadline = Date.now() + maxWaitMs
      while (Date.now() < deadline) {
        if ((propsRef.current.content ?? '').trim().length >= minChars) return
        await new Promise((r) => setTimeout(r, stepMs))
      }
    }

    try {
      const params = new URLSearchParams({ link: l })
      if (g) params.set('guid', g)
      else if (sl) params.set('slug', sl)
      const statusUrl = `/api/xpr-status?${params.toString()}`
      if (XPR_CLIENT_DEBUG) console.log('[SignalLaw XPR] → GET /api/xpr-status', statusUrl)
      const res  = await fetch(statusUrl)
      const data = await res.json()
      if (XPR_CLIENT_DEBUG) console.log('[SignalLaw XPR] ← GET /api/xpr-status', data)
      if (!res.ok) throw new Error(data.error ?? 'Status check failed')
      const s = normalize(data)
      setStatus(s)
      if (s.totalWebsites > 0) {
        setPhase('distributed')
      } else {
        await waitForArticleBody()
        await validate()
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Status check failed')
      await waitForArticleBody()
      await validate()
    }
  }, [validate]) // validate is now stable (no prop deps)

  // Defer first status fetch slightly so parent `content` is in propsRef before precheck.
  useEffect(() => {
    const t = window.setTimeout(() => {
      void checkStatus()
    }, 120)
    return () => window.clearTimeout(t)
  }, [checkStatus])

  /* ─── Publish ─── */
  const handlePublish = async () => {
    setPhase('publishing')
    setPublishError(null)
    try {
      const publishBody = {
        title,
        summary,
        content,
        link,
        imageUrl,
        packageId: selectedPkg,
        slug,
        guid: storyGuid,
        publishedAt,
        investigationCategory,
        includeXprRaw: XPR_CLIENT_DEBUG,
      }
      if (XPR_CLIENT_DEBUG) console.log('[SignalLaw XPR] → POST /api/xpr-publish', publishBody)
      const res  = await fetch('/api/xpr-publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(publishBody),
      })
      const data = await res.json()
      if (XPR_CLIENT_DEBUG) console.log('[SignalLaw XPR] ← POST /api/xpr-publish', data)
      if (!res.ok) throw new Error(data.error ?? 'Distribution failed')

      const statusParams = new URLSearchParams({ link })
      if (storyGuid) statusParams.set('guid', storyGuid)
      else if (slug) statusParams.set('slug', slug)
      const postPubStatusUrl = `/api/xpr-status?${statusParams.toString()}`
      if (XPR_CLIENT_DEBUG) console.log('[SignalLaw XPR] → GET /api/xpr-status (post-publish)', postPubStatusUrl)
      const statusRes  = await fetch(postPubStatusUrl)
      const statusData = await statusRes.json()
      if (XPR_CLIENT_DEBUG) console.log('[SignalLaw XPR] ← GET /api/xpr-status (post-publish)', statusData)
      setStatus(normalize(statusData))
      setPhase('distributed')
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Distribution failed')
      setPhase('ready')
    }
  }

  /* ─── Replace PR (PDF upload) ─── */
  const handleReplace = async () => {
    if (!replaceFile) return
    setReplacing(true)
    setReplaceError(null)
    try {
      const fd = new FormData()
      fd.append('file', replaceFile)
      fd.append('recordId', recordId ?? '')

      const res  = await fetch('/api/upload-press-release-pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'PDF upload failed')

      const newLink: string = data.pdfUrl ?? propsRef.current.link
      const fp = contentFingerprint(propsRef.current.content, propsRef.current.title)
      clearCache(propsRef.current.link, fp)
      clearCache(newLink, fp)
      clearLegacyV2Cache(propsRef.current.link)
      clearLegacyV2Cache(newLink)

      // Notify parent of new URL so page can reload with correct link
      if (onLinkChange) {
        onLinkChange(newLink)
      }

      setReplaceFile(null)
      // Re-validate with summary/title as content (PDF text not extractable)
      const { title: t, summary: s } = propsRef.current
      await validate(s || t || 'Press release content', true)
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setReplacing(false)
    }
  }

  /* ─── Derived ─── */
  const badge       = getBadge(status)
  const headerBadge: Badge = phase === 'distributed' ? badge
    : phase === 'publishing' ? 'Pending'
    : 'Not Distributed'
  const badgeStyle  = BADGE_STYLE[headerBadge]
  const selectedPkgInfo = PACKAGES.find((p) => p.id === selectedPkg)!

  const passColor = '#059669'
  const failColor = '#dc2626'

  const tabPublishers = activeTab === 'live'
    ? (status?.liveAt    ?? [])
    : (status?.pendingAt ?? [])

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#111c30', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left transition-colors"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
          </svg>
          <span className="text-sm font-bold uppercase tracking-[0.13em]" style={{ color: '#f1f5f9' }}>
            Press Release Distribution
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
            whiteSpace: 'nowrap',
            backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`,
          }}>
            {headerBadge}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {phase === 'distributed' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void checkStatus() }}
              title="Refresh status"
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.5, background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#94a3b8' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* ── Body ── */}
      {open && (
        <div className="px-5 sm:px-6 py-5 space-y-3">

          {phase === 'checking-status' && <Spinner label="Checking distribution status…" />}
          {phase === 'validating'      && <Spinner label="Analyzing article quality…" />}

          {statusError && phase !== 'checking-status' && (
            <div className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
              <span className="text-xs" style={{ color: '#6b7280' }}>Status: {statusError}</span>
              <button onClick={checkStatus} className="text-xs font-bold ml-3 shrink-0"
                style={{ color: '#e31837' }}>Retry</button>
            </div>
          )}

          {/* ── Validation result ── */}
          {(phase === 'ready' || phase === 'publishing') && validation && (
            <>
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-[0.13em]" style={{ color: '#6b7280' }}>
                      AI Quality Score
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '999px',
                      backgroundColor: validation.passed ? '#dcfce7' : '#fee2e2',
                      color:           validation.passed ? passColor   : failColor,
                      border: `1px solid ${validation.passed ? '#86efac' : '#fca5a5'}`,
                    }}>
                      {validation.passed ? '✓ Approved' : '✕ Below Threshold'}
                    </span>
                  </div>

                  <div className="flex items-end gap-4">
                    <span style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1,
                      color: validation.passed ? passColor : failColor }}>
                      {validation.score}
                    </span>
                    <div className="mb-2">
                      <p className="text-sm font-semibold" style={{ color: '#374151' }}>out of 100</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Minimum required: 70</p>
                      {validation.classification && (
                        <p className="text-xs mt-1 font-semibold" style={{ color: '#6b7280' }}>
                          {validation.classification.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(validation.score, 100)}%`,
                        backgroundColor: validation.passed ? passColor : failColor }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px]" style={{ color: '#d1d5db' }}>0</span>
                    <span className="text-[10px] font-semibold" style={{ color: '#9ca3af' }}>Threshold: 70</span>
                    <span className="text-[10px]" style={{ color: '#d1d5db' }}>100</span>
                  </div>
                </div>

                {!validation.passed && validation.failedFilters.length > 0 && (
                  <div className="px-5 py-3" style={{ backgroundColor: '#fef2f2', borderTop: '1px solid #fee2e2' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: failColor }}>Issues to resolve:</p>
                    <ul className="space-y-1">
                      {validation.failedFilters.map((f, i) => (
                        <li key={i} className="text-xs flex items-start gap-2" style={{ color: '#374151' }}>
                          <span style={{ color: failColor, flexShrink: 0 }}>✕</span>{String(f)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {validation.passed && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#94a3b8' }}>
                    Select Distribution Package
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PACKAGES.map((pkg) => {
                      const active = selectedPkg === pkg.id
                      return (
                        <button key={pkg.id} type="button" onClick={() => setSelectedPkg(pkg.id)}
                          className="rounded-xl px-3 py-3 text-left transition-all"
                          style={{
                            backgroundColor: 'white',
                            border: active ? '2px solid #e31837' : '1px solid #e5e7eb',
                            boxShadow: active ? '0 0 0 3px rgba(227,24,55,.12)' : 'none',
                          }}>
                          <p className="text-xs font-bold" style={{ color: active ? '#e31837' : '#111827' }}>
                            {pkg.label}
                          </p>
                          <p className="text-[11px] font-semibold mt-0.5"
                            style={{ color: active ? '#e31837' : '#6b7280' }}>{pkg.sites} sites</p>
                          <p className="text-[10px] mt-1 leading-tight" style={{ color: '#9ca3af' }}>{pkg.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Replace PR (score < 70 only) ── */}
              {!validation.passed && phase === 'ready' && (
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#374151' }}>
                      Replace Press Release
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const { link: cl, content: cc, title: ct } = propsRef.current
                        clearCache(cl, contentFingerprint(cc, ct))
                        clearLegacyV2Cache(cl)
                        validate(undefined, true)
                      }}
                      className="text-[11px] font-semibold flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{ color: '#6b7280' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      Re-validate
                    </button>
                  </div>

                  <div className="px-5 py-4">
                    <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                      Upload an improved press release <strong>(.pdf)</strong>.
                      {isPdf
                        ? ' It will be uploaded to WordPress and re-validated automatically.'
                        : ' It will replace the existing file and be re-validated automatically.'}
                    </p>

                    {/* View current */}
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 transition-opacity hover:opacity-80"
                      style={{ color: '#2563eb' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      View current press release
                    </a>

                    {/* Drop zone */}
                    <label className="block cursor-pointer">
                      <div className="rounded-xl border-2 border-dashed py-5 px-4 text-center transition-all"
                        style={{
                          borderColor:     replaceFile ? '#059669' : '#d1d5db',
                          backgroundColor: replaceFile ? '#f0fdf4' : '#fafafa',
                        }}>
                        {replacing ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" style={{ color: '#6b7280' }} viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-xs font-medium" style={{ color: '#6b7280' }}>Uploading & validating…</span>
                          </div>
                        ) : replaceFile ? (
                          <div>
                            <p className="text-sm font-bold" style={{ color: '#059669' }}>✓ {replaceFile.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Ready to upload</p>
                          </div>
                        ) : (
                          <div>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                              fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                              className="mx-auto mb-2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <p className="text-sm font-semibold" style={{ color: '#374151' }}>Drop file or click to browse</p>
                            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Accepts .pdf only</p>
                          </div>
                        )}
                      </div>
                      <input type="file" accept=".pdf,application/pdf" className="hidden"
                        disabled={replacing}
                        onChange={(e) => { setReplaceFile(e.target.files?.[0] ?? null); setReplaceError(null) }} />
                    </label>

                    {replaceError && (
                      <p className="text-xs mt-2 font-medium" style={{ color: '#dc2626' }}>{replaceError}</p>
                    )}

                    {replaceFile && !replacing && (
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={handleReplace}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                          style={{ backgroundColor: '#e31837' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b01228')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e31837')}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Upload PDF & Re-validate
                        </button>
                        <button type="button" onClick={() => { setReplaceFile(null); setReplaceError(null) }}
                          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                          style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {validateError && phase === 'ready' && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between text-xs"
              style={{ backgroundColor: 'white', border: '1px solid #fca5a5', color: failColor }}>
              {validateError}
              <button onClick={() => validate()} className="font-bold ml-3 shrink-0" style={{ color: failColor }}>Retry</button>
            </div>
          )}

          {publishError && phase === 'ready' && (
            <div className="rounded-xl px-4 py-3 text-xs"
              style={{ backgroundColor: 'white', border: '1px solid #fca5a5', color: failColor }}>
              {publishError}
            </div>
          )}

          {phase === 'publishing' && <Spinner label="Submitting to publishers…" />}

          {phase === 'ready' && validation?.passed && (
            <button type="button" onClick={handlePublish}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ backgroundColor: '#e31837', boxShadow: '0 2px 12px rgba(227,24,55,.35)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b01228')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e31837')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Distribute to {selectedPkgInfo.sites} Publishers
            </button>
          )}

          {/* ── Distributed: rich status view ── */}
          {phase === 'distributed' && status && (
            <>
              {/* Network Status card */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#dcfce7', border: '2px solid #86efac' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke={passColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9ca3af' }}>
                        NETWORK STATUS
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xl font-bold" style={{ color: '#111827' }}>
                          {status.overallStatus}
                        </p>
                        {status.totalWebsites > 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                            TOTAL WEBSITES: {status.totalWebsites}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {status.liveSince && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1 justify-end"
                        style={{ color: '#9ca3af' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                          <polyline points="16 7 22 7 22 13" />
                        </svg>
                        LIVE SINCE
                      </p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#374151' }}>
                        {fmtDate(status.liveSince)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 4 Stats tiles */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'PENDING',      value: status.pending,     color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
                  { label: 'PUBLISHED',    value: status.published,   color: passColor, bg: '#f0fdf4', border: '#86efac' },
                  { label: 'NEEDS REVIEW', value: status.needsReview, color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
                  { label: 'AI SCORE',     value: status.aiScore > 0 ? `${status.aiScore}%` : '—', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className="rounded-xl px-3 py-3 text-center"
                    style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1" style={{ color }}>
                      {label}
                    </p>
                    <p className="text-2xl font-bold leading-none" style={{ color }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Network Destinations */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#374151' }}>
                    Network Destinations
                  </p>
                </div>

                {/* Tabs */}
                <div className="flex" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {(['live', 'pending'] as Tab[]).map((t) => {
                    const count   = t === 'live' ? status.published : status.pending
                    const label   = t === 'live' ? `Live At (${count})` : `Pending At (${count})`
                    const isActive = activeTab === t
                    return (
                      <button key={t} type="button" onClick={() => setActiveTab(t)}
                        className="flex-1 px-4 py-3 text-xs font-semibold transition-colors"
                        style={{
                          color:            isActive ? '#2563eb' : '#9ca3af',
                          borderBottom:     isActive ? '2px solid #2563eb' : '2px solid transparent',
                          backgroundColor:  'transparent',
                        }}>
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Publisher rows */}
                <div className="divide-y" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {tabPublishers.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-center" style={{ color: '#9ca3af' }}>
                      {activeTab === 'live' ? 'No live publishers yet — check back shortly.' : 'No pending publishers.'}
                    </p>
                  ) : tabPublishers.map((p, i) => {
                    const href = p.sourceUrl ?? p.url ?? p.link
                    const name = p.name ?? p.outlet ?? 'Publisher'
                    const location = p.location ?? (p.city && p.state ? `${p.city}, ${p.state}` : (p.city ?? p.state ?? ''))
                    const pubDate  = p.publishedAt ?? p.date
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: '#dcfce7', border: '1.5px solid #86efac' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                              fill="none" stroke={passColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#111827' }}>{name}</p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: '#9ca3af' }}>
                              {[p.network && `Network: ${p.network}`, p.type && `Type: ${p.type}`, location && `Location: ${location}`]
                                .filter(Boolean).join('  ')}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {pubDate && (
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: '#9ca3af' }}>
                              PUBLISHED
                            </p>
                          )}
                          {pubDate && (
                            <p className="text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
                              {fmtDate(pubDate)}
                            </p>
                          )}
                          {href && (
                            <a href={href} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              View Article
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
