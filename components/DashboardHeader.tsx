'use client'

interface DashboardHeaderProps {
  topicCount: number
  onRefresh: () => void
  loading?: boolean
}

/**
 * Signal Law Group logo mark — transparent background, bars only.
 * 8 bottom-aligned bars matching the actual logo image exactly.
 *
 *  pos:  1    2    3    4    5(R) 6    7    8
 *  h:    22   36   44   28   58   40   24   18
 *  col:  lt   md   lt   md   RED  lt   md   lt
 */
function SignalLogoMark({ size = 1 }: { size?: number }) {
  const H = 60
  const W = 91
  const bars: Array<{ x: number; h: number; fill: string }> = [
    { x: 0,  h: 22, fill: '#cbd5e1' }, // 1 light
    { x: 13, h: 36, fill: '#94a3b8' }, // 2 mid
    { x: 26, h: 44, fill: '#cbd5e1' }, // 3 light-tall
    { x: 39, h: 28, fill: '#94a3b8' }, // 4 mid-short
    { x: 52, h: 58, fill: '#e31837' }, // 5 ← Signal Red (tallest)
    { x: 65, h: 40, fill: '#cbd5e1' }, // 6 light
    { x: 78, h: 24, fill: '#94a3b8' }, // 7 mid-short
  ]

  return (
    <svg
      width={W * size}
      height={H * size}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      aria-label="Signal Law Group"
    >
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={H - b.h}
          width={10}
          height={b.h}
          rx={2}
          fill={b.fill}
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
