'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Investigation, StatusItem } from '@/types/investigation'
import DashboardHeader from '@/components/DashboardHeader'
import TopicCard from '@/components/TopicCard'
import LaunchModal from '@/components/LaunchModal'
import InvestigationsView from '@/components/InvestigationsView'

type Tab = 'topics' | 'investigations'

const PAGE_BG   = '#0d1526'
const SURFACE   = '#111c30'
const BORDER    = 'rgba(255,255,255,0.08)'
const T1        = '#f1f5f9'
const T2        = '#94a3b8'
const T3        = '#4b6a9b'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('topics')

  /* Sync tab with URL — reads on mount + popstate (back/forward) */
  useEffect(() => {
    function syncTab() {
      const params = new URLSearchParams(window.location.search)
      setTab(params.get('tab') === 'investigations' ? 'investigations' : 'topics')
    }
    syncTab()
    window.addEventListener('popstate', syncTab)
    return () => window.removeEventListener('popstate', syncTab)
  }, [])

  /* Update URL when tab changes so reload stays on the same tab */
  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab)
    const url = new URL(window.location.href)
    if (newTab === 'topics') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', newTab)
    }
    window.history.pushState({}, '', url.toString())
  }, [])

  /* Keep InvestigationsView mounted once visited — prevents skeleton reload on tab switch */
  const [invMounted, setInvMounted] = useState(false)
  useEffect(() => {
    if (tab === 'investigations') setInvMounted(true)
  }, [tab])

  const [topics,       setTopics]       = useState<Investigation[]>([])
  const [statusItems,  setStatusItems]  = useState<StatusItem[]>([])
  const [launchingIds, setLaunchingIds] = useState<Set<string>>(new Set())
  const [catFilter,    setCatFilter]    = useState('All')
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<Investigation | null>(null)
  const [launching,    setLaunching]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  /* ─── Fetch ── */
  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('Failed to load topics')
      setTopics(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      if (!res.ok) return
      setStatusItems(await res.json())
    } catch { /* silent */ }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchTopics(), fetchStatus()])
    setRefreshing(false)
  }, [fetchTopics, fetchStatus])

  useEffect(() => {
    fetchTopics()
    fetchStatus()
    const interval = setInterval(fetchStatus, 15_000)
    return () => clearInterval(interval)
  }, [fetchTopics, fetchStatus])

  /* Auto-redirect when launched record reaches Active Research */
  useEffect(() => {
    if (launchingIds.size === 0) return
    for (const item of statusItems) {
      if (launchingIds.has(item.id) && item.investigation_status === 'Active Research') {
        window.location.href = `/investigations/${item.id}`
        return
      }
    }
  }, [statusItems, launchingIds])

  /* ─── Launch ── */
  const handleLaunch = useCallback((topic: Investigation) => setSelectedTopic(topic), [])

  const confirmLaunch = useCallback(async () => {
    if (!selectedTopic) return
    setLaunching(true)
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: selectedTopic.id }),
      })
      if (!res.ok) throw new Error('Launch failed')
      setLaunchingIds((prev) => new Set(prev).add(selectedTopic.id))
      setSelectedTopic(null)
    } catch { /* keep modal open */ } finally {
      setLaunching(false)
    }
  }, [selectedTopic])

  /* ─── Derived ── */
  const categories = useMemo(() => {
    const seen = new Set<string>()
    topics.forEach((t) => { if (t.investigation_category) seen.add(t.investigation_category) })
    return ['All', ...Array.from(seen).sort()]
  }, [topics])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = { All: topics.length }
    topics.forEach((t) => { m[t.investigation_category] = (m[t.investigation_category] ?? 0) + 1 })
    return m
  }, [topics])

  const filteredTopics = useMemo(
    () => catFilter === 'All' ? topics : topics.filter((t) => t.investigation_category === catFilter),
    [topics, catFilter]
  )

  /* ─── Skeleton / Empty ── */
  const SkeletonGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-72 rounded-xl animate-pulse" style={{ backgroundColor: SURFACE }} />
      ))}
    </div>
  )

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 rounded-xl"
      style={{ border: `1px dashed ${BORDER}` }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: SURFACE }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="#e31837" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <p style={{ color: T1, fontWeight: 600, fontSize: '14px' }}>No topics found</p>
      <p style={{ color: T3, fontSize: '12px', marginTop: '4px' }}>
        {catFilter !== 'All' ? `No "${catFilter}" topics in the queue` : 'The investigation queue is empty'}
      </p>
    </div>
  )

  /* ─── Render ── */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: PAGE_BG }}>

      <div className="sticky top-0 z-40">
        <DashboardHeader
          onRefresh={handleRefresh}
          loading={refreshing}
          tab={tab}
          onTabChange={handleTabChange}
          topicCount={topics.length}
        />
      </div>

      <main className="flex-1">

        {/* ── Today's Topics ── */}
        {tab === 'topics' && (
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 64px' }}>

            {/* Page header */}
            <div style={{ marginBottom: '32px' }}>
              <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>
                PENDING REVIEW
              </p>
              <h1 style={{ color: T1, fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, lineHeight: 1.1, marginBottom: '10px' }}>
                Today&apos;s Topics
              </h1>
              <p style={{ color: T2, fontSize: '14px', maxWidth: '520px', lineHeight: 1.6 }}>
                AI-generated investigation candidates · review each topic and launch to begin active research.
              </p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: 'PENDING TOPICS',   value: topics.length,          sub: 'In review queue' },
                { label: 'CATEGORIES',        value: categories.length - 1,  sub: 'Risk types today' },
                { label: 'GENERATING',        value: launchingIds.size,      sub: 'In progress now',  highlight: launchingIds.size > 0 },
                { label: 'QUEUE STATUS',      value: topics.length > 0 ? 'Active' : 'Clear', sub: 'Refresh every 15s' },
              ].map(({ label, value, sub, highlight }) => (
                <div key={label} className="rounded-xl px-4 py-4" style={{
                  backgroundColor: SURFACE,
                  border: `1px solid ${highlight ? 'rgba(245,158,11,.4)' : BORDER}`,
                }}>
                  <p style={{ color: T3, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
                  <p style={{ color: highlight ? '#f59e0b' : T1, fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{value}</p>
                  <p style={{ color: T3, fontSize: '11px', marginTop: '4px' }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Category filter pills */}
            {categories.length > 1 && (
              <div className="overflow-x-auto mb-6" style={{ marginLeft: '-4px' }}>
                <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
                  <span style={{ color: T3, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', alignSelf: 'center', paddingLeft: '4px', marginRight: '4px' }}>
                    RISK TYPE
                  </span>
                  {categories.map((cat) => {
                    const active = catFilter === cat
                    return (
                      <button key={cat} onClick={() => setCatFilter(cat)}
                        className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all focus:outline-none"
                        style={active
                          ? { backgroundColor: '#f59e0b', color: '#000', border: '1px solid #f59e0b' }
                          : { backgroundColor: 'transparent', color: T2, border: `1px solid ${BORDER}` }
                        }
                      >
                        {cat} <span style={{ opacity: 0.65 }}>{catCounts[cat] ?? 0}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-6 rounded-xl px-4 py-3 text-xs flex items-center gap-2"
                style={{ backgroundColor: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error} —{' '}
                <button onClick={handleRefresh} className="underline">retry</button>
              </div>
            )}

            {/* Cards grid */}
            {loading ? <SkeletonGrid /> : filteredTopics.length === 0 ? <EmptyState /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onLaunch={() => handleLaunch(topic)}
                    isLaunching={launchingIds.has(topic.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Investigations ── mount once, hide with CSS to preserve data between tab switches */}
        {invMounted && (
          <div style={{ display: tab === 'investigations' ? 'block' : 'none' }}>
            <InvestigationsView />
          </div>
        )}
      </main>

      {/* Launch modal */}
      {selectedTopic && (
        <LaunchModal
          topic={selectedTopic}
          onConfirm={confirmLaunch}
          onCancel={() => !launching && setSelectedTopic(null)}
          loading={launching}
        />
      )}
    </div>
  )
}
