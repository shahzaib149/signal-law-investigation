'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Investigation } from '@/types/investigation'
import InvestigationCard from './InvestigationCard'

type StatusFilter = 'All' | 'Active Research' | 'Published'
const FILTERS: StatusFilter[] = ['All', 'Active Research', 'Published']

function parsePostId(url: string): number | null {
  const m = url?.match(/[?&]p=(\d+)/)
  return m ? Number(m[1]) : null
}

export default function InvestigationsView() {
  const [records, setRecords] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<StatusFilter>('All')

  const fetchImages = useCallback(async (recs: Investigation[]) => {
    const postIds = recs.map(r => parsePostId(r.wordpress_url)).filter((id): id is number => id !== null)
    if (!postIds.length) return
    try {
      const res = await fetch('/api/batch-featured-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds }),
      })
      if (!res.ok) return
      const { images }: { images: Record<string, string | null> } = await res.json()
      setRecords(prev => prev.map(r => {
        const pid = parsePostId(r.wordpress_url)
        return pid && images[pid] ? { ...r, featured_media_url: images[pid] } : r
      }))
    } catch { /* silent — cards fall back to placeholder */ }
  }, [])

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/investigations', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load investigations')
      const data: Investigation[] = await res.json()
      setRecords(data)
      setError(null)
      fetchImages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [fetchImages])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const filtered = useMemo(() => {
    if (filter === 'All') return records
    return records.filter((r) => r.investigation_status === filter)
  }, [records, filter])

  const counts = useMemo(() => {
    const m = { All: records.length, 'Active Research': 0, Published: 0 } as Record<StatusFilter, number>
    for (const r of records) {
      if (r.investigation_status === 'Active Research') m['Active Research']++
      else if (r.investigation_status === 'Published')  m['Published']++
    }
    return m
  }, [records])

  /* ─── Skeleton ── */
  const Skeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg animate-pulse bg-gray-100" style={{ height: '240px', border: '1px solid #f3f4f6' }} />
      ))}
    </div>
  )

  /* ─── Empty ── */
  const Empty = () => (
    <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-gray-50 text-center"
      style={{ border: '1px dashed #d1d5db' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-white shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="#e31837" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <p className="text-gray-800 font-semibold text-sm">
        {filter === 'All' ? 'No investigations yet' : `No ${filter} investigations`}
      </p>
      <p className="text-gray-400 text-xs mt-1">
        Launch a topic from <span className="font-semibold">Today&apos;s Topics</span> to start one.
      </p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-[0.15em]">Investigations</h2>
        <p className="text-xs text-gray-400 mt-0.5">Generated research profiles · review and publish</p>
      </div>

      {/* Filter pills — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
        <div className="flex gap-2 px-4 sm:px-0 pb-1 min-w-max sm:min-w-0 sm:flex-wrap sm:items-center">
          {FILTERS.map((f) => {
            const isActive = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                style={isActive
                  ? { backgroundColor: '#e31837', color: '#fff', border: '1px solid #e31837' }
                  : { backgroundColor: '#fff', color: '#374151', border: '1px solid #e5e7eb' }
                }>
                {f}
                <span className="ml-1.5 tabular-nums opacity-60">{counts[f]}</span>
              </button>
            )
          })}
          <button onClick={() => { setLoading(true); fetchRecords() }} disabled={loading}
            className="shrink-0 sm:ml-auto px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: '#fff', color: '#374151', border: '1px solid #e5e7eb' }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg px-4 py-3 text-xs flex items-center gap-2"
          style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {loading ? <Skeleton /> : filtered.length === 0 ? <Empty /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => <InvestigationCard key={r.id} record={r} />)}
        </div>
      )}
    </div>
  )
}
