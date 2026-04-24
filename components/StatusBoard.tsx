import type { StatusItem } from '@/types/investigation'
import StatusBadge from './StatusBadge'

interface StatusBoardProps {
  items: StatusItem[]
}

export default function StatusBoard({ items }: StatusBoardProps) {
  if (items.length === 0) return null

  return (
    <section className="mt-10 sm:mt-12">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-5 rounded-full shrink-0" style={{ backgroundColor: '#e31837' }} aria-hidden="true" />
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-[0.18em]">
            In Progress &amp; Completed
          </h2>
        </div>
        <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
            style={{ animation: 'signal-pulse 2s ease-in-out infinite' }}
          />
          auto-refreshes every 15s
        </span>
      </div>

      <div className="h-px mb-4 bg-gray-100" />

      {/* Rows */}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl px-4 py-3 bg-gray-50 transition-colors hover:bg-gray-100"
            style={{ border: '1px solid #f3f4f6' }}
          >
            {/* Top row: name + status badge */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-gray-900 text-sm font-semibold truncate">{item.company_name}</p>
                <p className="text-gray-400 text-xs mt-0.5 truncate">{item.investigation_category}</p>
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <StatusBadge status={item.investigation_status} variant="status" />
                {/* Date — visible on sm+ */}
                {item.submitted_at && (
                  <span className="hidden sm:inline text-gray-300 text-xs tabular-nums shrink-0">
                    {new Date(item.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom row on mobile: view link + date */}
            {item.wordpress_url && (
              <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
                <a
                  href={item.wordpress_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold transition-colors"
                  style={{ color: '#e31837' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#b01228')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#e31837')}
                >
                  View Draft →
                </a>
                {/* Date on mobile only */}
                {item.submitted_at && (
                  <span className="sm:hidden text-gray-300 text-xs tabular-nums">
                    {new Date(item.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
