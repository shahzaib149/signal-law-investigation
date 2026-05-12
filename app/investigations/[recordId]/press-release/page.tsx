'use client'

import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Investigation, WordPressPost } from '@/types/investigation'
import DashboardHeader from '@/components/DashboardHeader'
import XprDistributionPanel from '@/components/XprDistributionPanel'

interface PressReleasePost extends WordPressPost {
  isPdf?:  boolean
  pdfUrl?: string
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function PressReleasePage({
  params,
}: {
  params: Promise<{ recordId: string }>
}) {
  const { recordId } = use(params)

  const [record, setRecord]   = useState<Investigation | null>(null)
  const [prPost, setPrPost]   = useState<PressReleasePost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [prLink, setPrLink]   = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const recRes = await fetch(`/api/airtable-record/${recordId}`, { cache: 'no-store' })
      if (!recRes.ok) {
        const err = await recRes.json().catch(() => ({}))
        throw new Error((err as { error?: string })?.error ?? `Record fetch failed (${recRes.status})`)
      }
      const rec: Investigation = await recRes.json()
      setRecord(rec)
      setPrLink(rec.wordpress_press_release_url || null)

      if (!rec.wordpress_press_release_url) {
        setError('No press release URL is linked to this investigation.')
        return
      }

      const postRes = await fetch('/api/get-press-release', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ link: rec.wordpress_press_release_url }),
      })
      if (postRes.status === 404) {
        setError('Press release content not found.')
        return
      }
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}))
        throw new Error((err as { error?: string })?.error ?? `Press release fetch failed (${postRes.status})`)
      }
      setPrPost(await postRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { loadAll() }, [loadAll])

  const canShowXpr = !loading && !!record && !!prPost && !!(prLink || record.wordpress_press_release_url)

  const handleLinkChange = (newLink: string) => {
    setPrLink(newLink)
    // Reload the press release content with the new PDF URL
    loadAll()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f1f5f9' }}>

      {/* Admin nav */}
      <div className="sticky top-0 z-40">
        <DashboardHeader onRefresh={loadAll} loading={loading} />
      </div>

      {/* Breadcrumb */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 flex-wrap">
          <Link
            href={`/investigations/${recordId}`}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: '#6b7280', textDecoration: 'none' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Investigation
          </Link>
          {record && (
            <>
              <span style={{ color: '#d1d5db', fontSize: '16px' }}>›</span>
              <span className="text-sm font-semibold truncate max-w-xs" style={{ color: '#111827' }}>
                {record.company_name}
              </span>
              <span style={{ color: '#d1d5db', fontSize: '16px' }}>›</span>
              <span className="text-sm font-semibold" style={{ color: '#e31837' }}>Press Release</span>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <PressReleaseSkeleton />
        </div>
      )}

      {/* Fatal error (no record) */}
      {!loading && error && !record && (
        <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <ErrorPanel title="Could not load press release" message={error} onRetry={loadAll} />
        </div>
      )}

      {/* Main layout */}
      {!loading && record && (
        <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

            {/* ── Left: document viewer ── */}
            <div className="lg:col-span-2 flex flex-col gap-5">

              {/* Page heading */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded"
                    style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                    Press Release
                  </span>
                  {record.investigation_category && (
                    <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>
                      {record.investigation_category}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: '#111827' }}>
                  {prPost?.title || record.company_name}
                </h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {record.wordpress_press_release_url && (
                    <a
                      href={record.wordpress_press_release_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      View on WordPress
                    </a>
                  )}
                  {prPost?.meta?.last_updated && (
                    <span className="text-xs" style={{ color: '#9ca3af' }}>
                      Last updated: {prPost.meta.last_updated}
                    </span>
                  )}
                </div>
              </div>

              {/* Featured image */}
              {prPost?.featured_media_url && (
                <div className="relative w-full overflow-hidden rounded-xl"
                  style={{ aspectRatio: '16/7', border: '1px solid #e5e7eb' }}>
                  <Image
                    src={prPost.featured_media_url}
                    alt={prPost.title || record.company_name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
              )}

              {/* Document card */}
              {prPost ? (
                <article
                  className="rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderTop: '3px solid #e31837',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {prPost.isPdf && prPost.pdfUrl ? (
                    /* ── PDF viewer ── */
                    <>
                      <div className="px-5 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2"
                        style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                            fill="none" stroke="#e31837" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#9ca3af' }}>
                            PDF Document
                          </span>
                        </div>
                        <a href={prPost.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', textDecoration: 'none' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download PDF
                        </a>
                      </div>
                      <iframe
                        src={prPost.pdfUrl}
                        className="w-full"
                        style={{ height: '780px', border: 'none', display: 'block' }}
                        title="Press Release PDF"
                      />
                    </>
                  ) : (
                    /* ── HTML content ── */
                    <>
                      <div className="px-6 sm:px-10 pt-8 pb-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <div className="flex items-center gap-3 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="#e31837" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                          <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: '#9ca3af' }}>
                            Signal Law Group — Official Press Release
                          </span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold leading-snug mt-3" style={{ color: '#111827' }}>
                          {prPost.title}
                        </p>
                      </div>
                      <div className="px-6 sm:px-10 py-8">
                        <div className="signal-content" dangerouslySetInnerHTML={{ __html: prPost.content }} />
                      </div>
                      {prPost.id > 0 && (
                        <div className="px-6 sm:px-10 pb-6 pt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
                          <p className="text-xs" style={{ color: '#9ca3af' }}>
                            WordPress Post ID: <span className="font-mono">#{prPost.id}</span>
                            {prPost.date && (
                              <> · Created: {new Date(prPost.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</>
                            )}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </article>
              ) : error ? (
                <div className="rounded-xl p-8 text-center"
                  style={{ backgroundColor: 'white', border: '1px dashed #e2e8f0' }}>
                  <p className="text-sm" style={{ color: '#6b7280' }}>{error}</p>
                  <button onClick={loadAll} className="mt-4 text-xs font-semibold underline underline-offset-2"
                    style={{ color: '#e31837' }}>
                    Retry
                  </button>
                </div>
              ) : null}
            </div>

            {/* ── Right: distribution panel (sticky) ── */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-20 flex flex-col gap-4">

                {canShowXpr ? (
                  <XprDistributionPanel
                    title={prPost!.title || record.company_name}
                    summary={prPost!.meta?.executive_intelligence_summary || record.brief_topic || ''}
                    content={prPost!.content || record.brief_topic || ''}
                    link={prLink || record.wordpress_press_release_url}
                    imageUrl={prPost!.featured_media_url ?? undefined}
                    recordId={recordId}
                    isPdf={prPost!.isPdf === true}
                    onLinkChange={handleLinkChange}
                  />
                ) : !loading && record && (
                  <div className="rounded-xl p-5 text-center"
                    style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      {error ? 'Distribution unavailable — press release could not be loaded.' : 'Loading distribution panel…'}
                    </p>
                  </div>
                )}

                {/* Quick info card */}
                <div className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                  <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <h3 className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: '#111827' }}>
                      Investigation
                    </h3>
                  </div>
                  <div className="px-5 py-4 flex flex-col gap-3">
                    <InfoRow label="Company" value={record.company_name} />
                    {record.ticker_symbol && (
                      <InfoRow label="Ticker" value={record.ticker_symbol} mono />
                    )}
                    <InfoRow label="Category" value={record.investigation_category} />
                    <InfoRow label="Status" value={record.investigation_status}
                      valueColor={record.investigation_status === 'Published' ? '#059669' : '#d97706'} />
                  </div>
                  <div className="px-5 pb-5">
                    <Link
                      href={`/investigations/${recordId}`}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', color: '#374151', textDecoration: 'none' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                      </svg>
                      View Full Investigation
                    </Link>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────── */

function InfoRow({
  label, value, mono, valueColor,
}: {
  label: string; value: string; mono?: boolean; valueColor?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs shrink-0" style={{ color: '#9ca3af' }}>{label}</span>
      <span
        className={`text-xs font-semibold text-right ${mono ? 'font-mono' : ''}`}
        style={{ color: valueColor ?? '#374151' }}
      >
        {value || '—'}
      </span>
    </div>
  )
}

function PressReleaseSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <div className="lg:col-span-2 space-y-4">
        <div className="h-6 w-1/4 rounded animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
        <div className="h-9 w-3/4 rounded animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
        <div className="h-56 w-full rounded-xl animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
        <div className="h-80 w-full rounded-xl animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
      </div>
      <div className="lg:col-span-1 space-y-4">
        <div className="h-64 w-full rounded-xl animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
        <div className="h-40 w-full rounded-xl animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
      </div>
    </div>
  )
}

function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'white', border: '1px solid #fca5a5' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#dc2626' }}>{title}</h2>
      <p className="text-sm mt-2" style={{ color: '#6b7280' }}>{message}</p>
      <button onClick={onRetry} className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-white"
        style={{ backgroundColor: '#e31837' }}>
        Retry
      </button>
    </div>
  )
}
