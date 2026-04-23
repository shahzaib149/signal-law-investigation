'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Investigation, StatusItem } from '@/types/investigation'
import DashboardHeader from '@/components/DashboardHeader'
import TopicCard from '@/components/TopicCard'
import StatusBoard from '@/components/StatusBoard'
import LaunchModal from '@/components/LaunchModal'
import InvestigationsView from '@/components/InvestigationsView'

type Tab = 'topics' | 'investigations'

export default function Dashboard() {
  const [tab, setTab]                     = useState<Tab>('topics')

  /* Read ?tab= from URL on mount */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t === 'investigations') setTab('investigations')
  }, [])
  const [topics, setTopics]               = useState<Investigation[]>([])
  const [statusItems, setStatusItems]     = useState<StatusItem[]>([])
  const [filter, setFilter]               = useState<string>('All')
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<Investigation | null>(null)
  const [launching, setLaunching]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  /* ─── Fetching ───────────────────────────────────────────────── */
  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('Failed to load topics')
      const data: Investigation[] = await res.json()
      setTopics(data)
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
      const data: StatusItem[] = await res.json()
      setStatusItems(data)
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

  /* ─── Launch ─────────────────────────────────────────────────── */
  const handleLaunch = useCallback((topic: Investigation) => {
    setSelectedTopic(topic)
  }, [])

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
      setTopics((prev) => prev.filter((t) => t.id !== selectedTopic.id))
      setSelectedTopic(null)
      fetchStatus()
    } catch { /* keep modal open */ } finally {
      setLaunching(false)
    }
  }, [selectedTopic, fetchStatus])

  /* ─── Dynamic category filter pills ─────────────────────────── */
  const categories = useMemo(() => {
    const seen = new Set<string>()
    topics.forEach((t) => { if (t.investigation_category) seen.add(t.investigation_category) })
    return ['All', ...Array.from(seen).sort()]
  }, [topics])

  const filteredTopics = useMemo(
    () => filter === 'All' ? topics : topics.filter((t) => t.investigation_category === filter),
    [topics, filter]
  )

  /* ─── Sub-components ─────────────────────────────────────────── */
  const SkeletonGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-72 rounded-xl animate-pulse bg-gray-100"
          style={{ border: '1px solid #f3f4f6' }} />
      ))}
    </div>
  )

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-gray-50"
      style={{ border: '1px dashed #d1d5db' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-white shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
          viewBox="0 0 24 24" fill="none" stroke="#e31837"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <p className="text-gray-800 font-semibold text-sm">No topics found</p>
      <p className="text-gray-400 text-xs mt-1">
        {filter !== 'All' ? `No "${filter}" topics in the queue` : 'The investigation queue is empty'}
      </p>
    </div>
  )

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fa' }}>

      {/* Sticky header — tabs live inside the header */}
      <div className="sticky top-0 z-40">
        <DashboardHeader
          onRefresh={handleRefresh}
          loading={refreshing}
          tab={tab}
          onTabChange={setTab}
          topicCount={topics.length}
        />
      </div>

      {/* Body */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Tab: Today's Topics ── */}
        {tab === 'topics' && (
          <>
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-[0.15em]">
                Today&apos;s Investigation Topics
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                AI-generated candidates · pending review
              </p>
            </div>

            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => {
                  const isActive = filter === cat
                  const count = cat === 'All' ? topics.length : topics.filter((t) => t.investigation_category === cat).length
                  return (
                    <button key={cat} onClick={() => setFilter(cat)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                      style={isActive
                        ? { backgroundColor: '#e31837', color: '#fff',    border: '1px solid #e31837' }
                        : { backgroundColor: '#ffffff', color: '#374151', border: '1px solid #e5e7eb' }
                      }
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = '#e31837' }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = '#e5e7eb' }}
                    >
                      {cat}
                      <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg px-4 py-3 text-xs flex items-center gap-2"
                style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error} —{' '}
                <button onClick={handleRefresh} className="underline underline-offset-2">retry</button>
              </div>
            )}

            {loading ? <SkeletonGrid /> : filteredTopics.length === 0 ? <EmptyState /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} onLaunch={() => handleLaunch(topic)} />
                ))}
              </div>
            )}

            <StatusBoard items={statusItems} />
          </>
        )}

        {/* ── Tab: Investigations ── */}
        {tab === 'investigations' && <InvestigationsView />}
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

