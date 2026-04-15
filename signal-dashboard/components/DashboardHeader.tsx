'use client'

interface DashboardHeaderProps {
  topicCount: number
  onRefresh: () => void
  loading?: boolean
}

/** Faithful SVG recreation of the Signal Law Group logo mark */
function SignalLogoMark() {
  // Bars: [x, height] pairs – mimic the audio-bar / signal waveform
  // Center-left bar is the red Signal bar
  const bars: Array<{ x: number; h: number; color: string }> = [
    { x: 0,  h: 18, color: '#9ca3af' },
    { x: 10, h: 28, color: '#d1d5db' },
    { x: 20, h: 14, color: '#6b7280' },
    { x: 30, h: 36, color: '#e31837' }, // ← Signal Red bar
    { x: 40, h: 22, color: '#9ca3af' },
    { x: 50, h: 12, color: '#6b7280' },
    { x: 60, h: 26, color: '#d1d5db' },
  ]
  const totalH = 40

  return (
    <svg
      width="76"
      height={totalH}
      viewBox={`0 0 76 ${totalH}`}
      aria-hidden="true"
    >
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={totalH - b.h}
          width={7}
          height={b.h}
          rx={1.5}
          fill={b.color}
        />
      ))}
    </svg>
  )
}

export default function DashboardHeader({
  topicCount,
  onRefresh,
  loading = false,
}: DashboardHeaderProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header
      className="flex items-center justify-between px-6 py-3"
      style={{
        backgroundColor: '#000000',
        borderBottom: '1px solid #1a1a1a',
      }}
    >
      {/* ── Logo + word-mark ── */}
      <div className="flex items-center gap-4">
        <SignalLogoMark />
        <div>
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-xl font-black tracking-tight text-white uppercase">
              Signal
            </span>
            <span className="text-base font-light text-white">Law Group</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#e31837' }}
            >
              Vigilant Dashboard
            </span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500">{today}</span>
          </div>
        </div>
      </div>

      {/* ── Topic count + refresh ── */}
      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className="text-3xl font-bold text-white tabular-nums leading-none">
            {topicCount}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {topicCount === 1 ? 'topic' : 'topics'} available
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all disabled:opacity-40 focus:outline-none"
          style={{
            backgroundColor: '#111111',
            border: '1px solid #2d2d2d',
            color: loading ? '#e31837' : '#a0a0a0',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = '#e31837')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = '#2d2d2d')
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={loading ? 'animate-spin' : ''}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>
    </header>
  )
}
