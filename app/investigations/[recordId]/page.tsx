'use client'

import { useEffect, useMemo, useState, useCallback, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Investigation, WordPressPost } from '@/types/investigation'
import { metaToScoreTiles } from '@/lib/scoring'
import DashboardHeader from '@/components/DashboardHeader'

/* ─── Utilities ──────────────────────────────────────────────── */

function parsePostId(url: string): number | null {
  const m = url?.match(/[?&]p=(\d+)/)
  return m ? Number(m[1]) : null
}

/** Extract last path segment as slug from a permalink URL. */
function parseSlugFromUrl(url: string): string | null {
  try {
    if (!url) return null
    const pathname = new URL(url).pathname.replace(/\/$/, '')
    const slug = pathname.split('/').pop()
    return slug && slug.length > 0 ? slug : null
  } catch { return null }
}

function splitContent(html: string): { body: string; press: string } {
  if (!html) return { body: '', press: '' }
  const parts = html.split(/<hr\s*\/?>/i)
  if (parts.length < 2) return { body: html, press: '' }
  return { body: parts[0], press: parts.slice(1).join('<hr />') }
}

function parseSections(html: string): Array<{ title: string; content: string }> {
  const parts = html.split(/<h2[^>]*>/i)
  if (parts.length <= 1) return [{ title: '', content: html }]
  const sections: Array<{ title: string; content: string }> = []
  if (parts[0].trim()) sections.push({ title: '', content: parts[0] })
  for (let i = 1; i < parts.length; i++) {
    const endIdx = parts[i].search(/<\/h2>/i)
    if (endIdx === -1) {
      sections.push({ title: parts[i].replace(/<[^>]+>/g, '').trim(), content: '' })
    } else {
      sections.push({
        title: parts[i].slice(0, endIdx).replace(/<[^>]+>/g, '').trim(),
        content: parts[i].slice(endIdx + 5),
      })
    }
  }
  return sections
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>
}) {
  const { recordId } = use(params)

  const [record, setRecord]   = useState<Investigation | null>(null)
  const [post, setPost]       = useState<WordPressPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [showConfirm, setShowConfirm]       = useState(false)
  const [publishing, setPublishing]         = useState(false)
  const [publishError, setPublishError]     = useState<string | null>(null)
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null)

  /* ─── Fetch ──────────────────────────────────────────────────── */
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const recRes = await fetch(`/api/airtable-record/${recordId}`, { cache: 'no-store' })
      if (!recRes.ok) {
        const err = await recRes.json().catch(() => ({}))
        throw new Error(err?.error ?? `Record fetch failed (${recRes.status})`)
      }
      const rec: Investigation = await recRes.json()
      setRecord(rec)

      const postId = parsePostId(rec.wordpress_url)
      const slug   = !postId ? parseSlugFromUrl(rec.wordpress_url) : null

      if (!postId && !slug) {
        setPost(null)
        setError('Investigation content not available — this record has no WordPress post yet.')
        return
      }

      const fetchBody = postId ? { postId } : { slug }
      const postRes = await fetch('/api/get-investigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fetchBody),
      })
      if (postRes.status === 404) { setPost(null); setError('Investigation content not available'); return }
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}))
        throw new Error(err?.error ?? `WordPress fetch failed (${postRes.status})`)
      }
      setPost(await postRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { loadAll() }, [loadAll])

  /* ─── Publish ────────────────────────────────────────────────── */
  const confirmPublish = useCallback(async () => {
    if (!record || !post) return
    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch('/api/publish-investigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, airtableRecordId: record.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `Publish failed (${res.status})`)
      setRecord({ ...record, investigation_status: 'Published', wordpress_url: body.permalink ?? record.wordpress_url })
      setPost({ ...post, status: 'publish', link: body.permalink ?? post.link })
      setPublishSuccess(body.permalink ?? '')
      setShowConfirm(false)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPublishing(false)
    }
  }, [record, post])

  /* ─── Derived ────────────────────────────────────────────────── */
  const scores     = useMemo(() => post ? metaToScoreTiles(post.meta) : [], [post])
  const { body, press } = useMemo(() => splitContent(post?.content ?? ''), [post])
  const sections   = useMemo(() => parseSections(body), [body])
  const isPublished = record?.investigation_status === 'Published' || post?.status === 'publish'
  const lastUpdated = post?.meta.last_updated
    || (record?.last_modified
      ? new Date(record.last_modified).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null)

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f5f5f5' }}>

      {/* Admin nav */}
      <div className="sticky top-0 z-40">
        <DashboardHeader onRefresh={loadAll} loading={loading} />
      </div>

      {loading && (
        <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <DetailSkeleton />
        </div>
      )}

      {!loading && error && !record && (
        <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ErrorPanel title="Couldn't load investigation" message={error} onRetry={loadAll} />
        </div>
      )}

      {!loading && record && (
        <>
          {/* Publish success */}
          {publishSuccess && (
            <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3">
              <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-3"
                style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="font-semibold">Published.</span>
                <a href={publishSuccess} target="_blank" rel="noopener noreferrer"
                  className="underline underline-offset-2 font-medium break-all">{publishSuccess}</a>
                <button onClick={() => setPublishSuccess(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
              </div>
            </div>
          )}

          {/* ── Hero ── */}
          <section className="relative overflow-hidden" style={{ minHeight: 'clamp(300px, 40vw, 460px)' }}>
            {post?.featured_media_url ? (
              <Image
                src={post.featured_media_url}
                alt={post.title || record.company_name}
                fill
                sizes="100vw"
                style={{ objectFit: 'cover' }}
                priority
                unoptimized
              />
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: '#111827' }} />
            )}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.82) 100%)' }}
            />

            <div
              className="relative z-10 flex flex-col justify-end"
              style={{ minHeight: 'clamp(300px, 40vw, 460px)' }}
            >
              <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-10 pb-7 sm:pb-10 pt-12 sm:pt-16">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3 sm:mb-4 max-w-3xl">
                  {post?.title || record.company_name}
                </h1>

                {(post?.meta.executive_intelligence_summary || record.brief_topic) && (
                  <p
                    className="text-xs sm:text-sm text-white mb-4 sm:mb-6 max-w-2xl leading-relaxed line-clamp-3 sm:line-clamp-none"
                    style={{ opacity: 0.88 }}
                  >
                    {post?.meta.executive_intelligence_summary || record.brief_topic}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <StatusPill status={record.investigation_status} />
                  {lastUpdated && <SolidPill label={`Last Updated: ${lastUpdated}`} bold="Last Updated:" />}
                  {record.wordpress_press_release_url && (
                    <SolidPill label="Press Release" href={record.wordpress_press_release_url} external />
                  )}
                  {isPublished && (record.wordpress_url || post?.link) ? (
                    <a
                      href={record.wordpress_url || post?.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold text-white transition-all"
                      style={{ backgroundColor: '#047857', border: '1.5px solid #047857' }}
                    >
                      View Live ↗
                    </a>
                  ) : !isPublished && post ? (
                    <button
                      onClick={() => { setPublishError(null); setShowConfirm(true) }}
                      className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold text-white"
                      style={{ backgroundColor: '#e31837', border: '1.5px solid #e31837' }}
                    >
                      Publish to WordPress
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* ── Scores band ── */}
          {scores.length > 0 && (
            <section style={{ backgroundColor: '#2d3748' }}>
              <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">

                {/* 3 primary scores — single col on mobile, 3-col on sm+ */}
                <div
                  className="grid grid-cols-3 mb-6"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '24px' }}
                >
                  {[
                    { score: scores[0], label: 'Vigilant Risk Score', icon: <ShieldIcon /> },
                    { score: scores[1], label: 'Escalation Momentum', icon: <TrendIcon /> },
                    { score: scores[2], label: 'Litigation Readiness', icon: <ClipboardIcon /> },
                  ].map(({ score, label, icon }, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 sm:gap-1.5 px-2 sm:px-0 py-2 sm:py-0 text-center"
                      style={i < 2 ? { borderRight: '1px solid rgba(255,255,255,0.1)' } : {}}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-0.5 sm:mb-1"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        {icon}
                      </div>
                      <p className="hidden sm:block" style={{ color: '#9ca3af', fontSize: '13px' }}>{label}</p>
                      <p className="sm:hidden text-center" style={{ color: '#9ca3af', fontSize: '10px', lineHeight: 1.2 }}>{label}</p>
                      <p style={{
                        color: 'white',
                        fontSize: i === 0 ? 'clamp(1.4rem, 4vw, 2.4rem)' : 'clamp(1rem, 3vw, 1.4rem)',
                        fontWeight: 700,
                        lineHeight: 1,
                        marginTop: '2px',
                      }}>
                        {score?.value ?? '—'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 4 sub-metrics — 2 col on mobile, 4 col on sm+ */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                  {scores.slice(3).map((s, i) => (
                    <div key={s.key} className="flex items-start gap-2 sm:gap-3">
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
                      >
                        {subMetricIcon(i)}
                      </div>
                      <div className="min-w-0">
                        <p style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.3 }}>
                          {s.label} <strong>{s.key}</strong>
                        </p>
                        <p style={{ color: 'white', fontSize: 'clamp(1rem, 3vw, 1.4rem)', fontWeight: 700, marginTop: '2px', lineHeight: 1.1 }}>
                          {s.value}
                        </p>
                        {s.band && (
                          <p style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>{s.band}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── No post ── */}
          {!post && error && (
            <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
              <div className="rounded-xl p-8 text-center bg-white" style={{ border: '1px dashed #e5e7eb' }}>
                <p className="text-gray-600 text-sm">{error}</p>
                <p className="text-gray-400 text-xs mt-2">
                  Status: <strong>{record.investigation_status}</strong>. Content will appear once generation is complete.
                </p>
                <button onClick={loadAll} className="mt-4 text-xs font-semibold underline underline-offset-2"
                  style={{ color: '#e31837' }}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* ── Main content + sidebar ── */}
          {post && (
            <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">

                {/* Left: sections */}
                <div className="lg:col-span-2 flex flex-col gap-5">
                  {sections.map((section, idx) => (
                    <article
                      key={idx}
                      className="bg-white rounded-lg overflow-hidden"
                      style={{ border: '1px solid #e5e7eb' }}
                    >
                      {section.title && (
                        <div className="px-6 pt-5 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-[0.15em]">
                            {section.title}
                          </h2>
                        </div>
                      )}
                      <div className="px-6 py-5">
                        <div className="signal-content" dangerouslySetInnerHTML={{ __html: section.content }} />
                      </div>
                    </article>
                  ))}

                  {press.trim() && (
                    <article
                      className="bg-white rounded-lg overflow-hidden"
                      style={{ border: '1px solid #e5e7eb', borderTop: '3px solid #e31837' }}
                    >
                      <div className="px-6 py-5">
                        <div className="signal-content" dangerouslySetInnerHTML={{ __html: press }} />
                      </div>
                    </article>
                  )}

                  <p className="text-[11px] text-gray-400">
                    {post.meta.last_updated && <>Last updated {post.meta.last_updated} · </>}
                    Draft ID <span className="font-mono">#{post.id}</span>
                  </p>
                </div>

                {/* Right: sidebar */}
                <div className="lg:col-span-1 flex flex-col gap-6">

                  {/* Evidence and Source Links */}
                  <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                    <div className="px-6 pt-5 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-[0.15em]">
                        Evidence and Source Links
                      </h3>
                    </div>
                    <div className="px-6 py-5 flex flex-col gap-4">
                      {[
                        { title: 'Verified News Reports',   desc: 'Coverage regarding regulatory scrutiny and public reporting.' },
                        { title: 'Consumer Complaints',     desc: 'Publicly filed complaints referencing related issues.' },
                        { title: 'Regulatory Commentary',   desc: 'State and local regulatory discussions concerning the subject matter.' },
                        { title: 'Platform Disclosures',    desc: 'Review of public filings and platform terms.' },
                      ].map((src) => (
                        <div key={src.title} className="flex items-start gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                            fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className="mt-0.5 shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{src.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{src.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-6 pb-5" style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                      <button
                        className="w-full py-2 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-900 transition-colors"
                        style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}
                      >
                        View All Sources
                      </button>
                    </div>
                  </div>

                  {/* Contribute Information */}
                  <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#374151' }}>
                    <div className="px-6 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <h3 className="text-sm font-bold text-white uppercase tracking-[0.15em]">
                        Contribute Information
                      </h3>
                    </div>
                    <div className="px-6 py-4 flex flex-col gap-2">
                      {[
                        {
                          label: 'Receive Research Updates',
                          icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                              fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
                              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                            </svg>
                          ),
                        },
                        {
                          label: 'Join Monitoring List',
                          icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                              fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          ),
                        },
                        {
                          label: 'Submit Information',
                          icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                              fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                          ),
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between py-2.5 px-3 rounded cursor-pointer transition-colors"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                              {item.icon}
                            </div>
                            <span className="text-sm font-semibold text-white">{item.label}</span>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17 17 7M7 7h10v10" />
                          </svg>
                        </div>
                      ))}
                    </div>
                    <div className="px-6 pb-6 pt-1">
                      <p className="text-xs leading-relaxed" style={{ color: '#9ca3af' }}>
                        Individuals with information relating to {record.company_name} may submit
                        information through Signal Law Group&apos;s website.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Publish confirm modal */}
      {showConfirm && post && record && (
        <ConfirmPublishDialog
          post={post}
          record={record}
          publishing={publishing}
          error={publishError}
          onCancel={() => !publishing && setShowConfirm(false)}
          onConfirm={confirmPublish}
        />
      )}
    </div>
  )
}

/* ─── Hero pills (white solid, matching reference design) ───── */

function StatusPill({ status }: { status: string }) {
  const isPublished = status === 'Published'
  const statusColor = isPublished ? '#047857' : '#e31837'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '8px 18px', borderRadius: '999px', fontSize: '13px',
      backgroundColor: 'white', border: '1.5px solid #d1d5db',
      color: '#111827', whiteSpace: 'nowrap', fontWeight: 500,
    }}>
      <strong>Status:</strong>&nbsp;<span style={{ color: statusColor, fontWeight: 700 }}>{status}</span>
    </span>
  )
}

function SolidPill({ label, bold, href, external }: {
  label: string; bold?: string; href?: string; external?: boolean
}) {
  const inner = bold ? (
    <><strong>{bold}</strong>&nbsp;{label.slice(bold.length).trim()}</>
  ) : label
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '8px 18px', borderRadius: '999px', fontSize: '13px',
    backgroundColor: 'white', border: '1.5px solid #d1d5db',
    color: '#111827', whiteSpace: 'nowrap', fontWeight: 500, textDecoration: 'none',
  }
  if (href) {
    return (
      <a href={href} target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined} style={style}>
        {inner}
        {external && (
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        )}
      </a>
    )
  }
  return <span style={style}>{inner}</span>
}

/* ─── Score icons ────────────────────────────────────────────── */

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function TrendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}
function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function subMetricIcon(i: number) {
  const icons = [
    // LPI - scales
    <svg key="lpi" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 6h14" />
      <path d="M5 6l-3 6s3 3 6 0l-3-6z" />
      <path d="M19 6l-3 6s3 3 6 0l-3-6z" />
    </svg>,
    // LSB - person
    <svg key="lsb" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>,
    // THI - monitor
    <svg key="thi" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>,
    // CIS - target/impact
    <svg key="cis" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>,
  ]
  return icons[i] ?? null
}

/* ─── Confirm publish dialog ─────────────────────────────────── */

function ConfirmPublishDialog({
  post, record, publishing, error, onCancel, onConfirm,
}: {
  post: WordPressPost
  record: Investigation
  publishing: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white"
        style={{ border: '1px solid #e5e7eb', boxShadow: '0 30px 70px rgba(0,0,0,0.25)' }}>
        <div className="h-1 w-full" style={{ backgroundColor: '#e31837' }} />
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Publish this investigation?</h2>
          <p className="text-xs text-gray-500 mb-5">
            This will set the post to <strong>Publish</strong> on signallawgroup.com and mark the
            Airtable record as <strong>Published</strong>.
          </p>
          <div className="rounded-xl p-4 mb-5 bg-gray-50" style={{ border: '1px solid #e5e7eb' }}>
            <p className="text-gray-900 font-bold text-sm">{post.title || record.company_name}</p>
            <p className="text-gray-500 text-xs mt-1">{record.investigation_category}</p>
          </div>
          {error && (
            <div className="mb-4 rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626' }}>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={publishing}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-40 focus:outline-none"
              style={{ border: '1px solid #e5e7eb' }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={publishing}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-600"
              style={{ backgroundColor: publishing ? '#b01228' : '#e31837' }}>
              {publishing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Publishing…
                </span>
              ) : 'Confirm Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Skeleton + error ───────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" />
      <div className="h-72 w-full bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-32 w-full bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl p-8 bg-white text-center" style={{ border: '1px solid #fecaca' }}>
      <h2 className="text-sm font-bold text-red-700 uppercase tracking-widest">{title}</h2>
      <p className="text-sm text-gray-700 mt-2">{message}</p>
      <button onClick={onRetry} className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-white"
        style={{ backgroundColor: '#e31837' }}>
        Retry
      </button>
    </div>
  )
}
