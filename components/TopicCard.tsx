import type { Investigation } from '@/types/investigation'

function categoryStyle(cat: string) {
  if (cat.includes('Securities')) return { bg: 'rgba(99,102,241,.18)',  text: '#818cf8', border: 'rgba(99,102,241,.35)' }
  if (cat.includes('Consumer'))   return { bg: 'rgba(168,85,247,.18)',  text: '#c084fc', border: 'rgba(168,85,247,.35)' }
  if (cat.includes('Platform'))   return { bg: 'rgba(239,68,68,.18)',   text: '#f87171', border: 'rgba(239,68,68,.35)'  }
  if (cat.includes('Regulatory')) return { bg: 'rgba(20,184,166,.18)',  text: '#2dd4bf', border: 'rgba(20,184,166,.35)' }
  if (cat.includes('Insurance'))  return { bg: 'rgba(251,146,60,.18)',  text: '#fb923c', border: 'rgba(251,146,60,.35)' }
  return                                 { bg: 'rgba(100,116,139,.18)', text: '#94a3b8', border: 'rgba(100,116,139,.35)' }
}

interface TopicCardProps {
  topic: Investigation
  onLaunch: () => void
  isLaunching?: boolean
}

export default function TopicCard({ topic, onLaunch, isLaunching }: TopicCardProps) {
  const cs = categoryStyle(topic.investigation_category)

  return (
    <article
      className="flex flex-col rounded-xl overflow-hidden"
      style={{ backgroundColor: '#111c30', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex-1 flex flex-col p-5">

        {/* Top: category badge + pending pill */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '4px',
            backgroundColor: cs.bg, color: cs.text, border: `1px solid ${cs.border}`,
          }}>
            {topic.investigation_category || 'Uncategorized'}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
            backgroundColor: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.25)',
          }}>
            Pending Review
          </span>
        </div>

        {/* Company name */}
        <h3 style={{ color: '#f1f5f9', fontSize: '17px', fontWeight: 700, lineHeight: 1.25, marginBottom: '4px' }}>
          {topic.company_name}
        </h3>

        {/* Ticker */}
        {topic.ticker_symbol && (
          <p style={{ color: '#4b6a9b', fontSize: '12px', fontFamily: 'monospace', marginBottom: '12px' }}>
            {topic.ticker_symbol}
          </p>
        )}

        {/* Brief topic */}
        <p className="line-clamp-3 flex-1" style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, marginBottom: '12px' }}>
          {topic.brief_topic}
        </p>

        {/* Why it matters */}
        {topic.why_it_matters && (
          <div className="rounded-lg px-3 py-2.5 mb-3" style={{
            backgroundColor: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.18)',
          }}>
            <p style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Why It Matters
            </p>
            <p className="line-clamp-2" style={{ color: '#c8a84b', fontSize: '12px', lineHeight: 1.5 }}>
              {topic.why_it_matters}
            </p>
          </div>
        )}

        {/* Signal date */}
        {topic.suggested_date && (
          <p style={{ color: '#334d6e', fontSize: '11px', marginBottom: '4px' }}>
            Signal Date: {topic.suggested_date}
          </p>
        )}
      </div>

      {/* Footer: launch button */}
      <div className="px-5 pb-5">
        {isLaunching ? (
          <div
            className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 badge-generating"
            style={{ backgroundColor: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />
            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>Generating...</span>
          </div>
        ) : (
          <button
            onClick={onLaunch}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 focus:outline-none"
            style={{ backgroundColor: '#e31837' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b01228')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e31837')}
          >
            Launch Investigation ▶
          </button>
        )}
      </div>
    </article>
  )
}
