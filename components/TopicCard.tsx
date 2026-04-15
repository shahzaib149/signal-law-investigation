import type { Investigation } from '@/types/investigation'
import StatusBadge from './StatusBadge'

interface TopicCardProps {
  topic: Investigation
  onLaunch: () => void
}

export default function TopicCard({ topic, onLaunch }: TopicCardProps) {
  return (
    <article
      className="topic-card flex flex-col gap-3 rounded-xl p-4 bg-white"
      style={{
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        borderTop: '3px solid #e31837',
      }}
    >
      {/* ── Company + ticker ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight">
            {topic.company_name}
          </p>
          {topic.ticker_symbol && (
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              {topic.ticker_symbol}
            </p>
          )}
        </div>

        {/* Status badge top-right */}
        <StatusBadge status={topic.investigation_status} variant="status" />
      </div>

      {/* ── Category ── */}
      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
        {topic.investigation_category}
      </p>

      {/* ── Brief topic ── */}
      <p className="text-xs text-gray-600 leading-relaxed flex-1 line-clamp-4">
        {topic.brief_topic}
      </p>

      {/* ── Why it matters (if present) ── */}
      {topic.why_it_matters && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-600 mb-1">
            Why It Matters
          </p>
          <p className="text-xs text-red-800 leading-relaxed line-clamp-2">
            {topic.why_it_matters}
          </p>
        </div>
      )}

      {/* ── Suggested date ── */}
      {topic.suggested_date && (
        <p className="text-[11px] text-gray-400">
          Signal Date: {topic.suggested_date}
        </p>
      )}

      {/* ── Launch button ── */}
      <button
        onClick={onLaunch}
        className="mt-auto w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        style={{ backgroundColor: '#e31837' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b01228')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e31837')}
      >
        Launch Investigation ▶
      </button>
    </article>
  )
}
