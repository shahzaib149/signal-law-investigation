'use client'

import Link from 'next/link'

type Tab = 'topics' | 'investigations'

interface DashboardHeaderProps {
  onRefresh: () => void
  loading?: boolean
  tab?: Tab
  onTabChange?: (t: Tab) => void
  topicCount?: number
}

function SignalLogoMark() {
  const H = 60, W = 91
  const bars = [
    { x: 0,  h: 22, fill: '#cbd5e1' },
    { x: 13, h: 36, fill: '#94a3b8' },
    { x: 26, h: 44, fill: '#cbd5e1' },
    { x: 39, h: 28, fill: '#94a3b8' },
    { x: 52, h: 58, fill: '#e31837' },
    { x: 65, h: 40, fill: '#cbd5e1' },
    { x: 78, h: 24, fill: '#94a3b8' },
  ]
  return (
    <svg width={W * 0.5} height={H * 0.5} viewBox={`0 0 ${W} ${H}`} fill="none">
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={H - b.h} width={10} height={b.h} rx={2} fill={b.fill} />
      ))}
    </svg>
  )
}

export default function DashboardHeader({
  onRefresh,
  loading = false,
  tab,
  onTabChange,
  topicCount,
}: DashboardHeaderProps) {
  return (
    <header style={{ backgroundColor: '#000000', borderBottom: '1px solid #1a1a1a' }}>
      <div className="flex items-center h-14 px-5">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0" style={{ textDecoration: 'none' }}>
          <SignalLogoMark />
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-base font-black tracking-tight text-white uppercase">SIGNAL</span>
            <span className="text-sm font-light text-white">Law Group</span>
          </div>
        </Link>

        {/* Separator */}
        <span className="mx-5 h-6 w-px shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />

        {/* Nav: active tabs on main dashboard, nav links on detail pages */}
        {onTabChange ? (
          <nav className="flex items-center gap-1 flex-1">
            <TabBtn
              label="Today's Topics"
              count={topicCount}
              active={tab === 'topics'}
              onClick={() => onTabChange('topics')}
            />
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px', margin: '0 2px' }}>|</span>
            <TabBtn
              label="Investigations"
              active={tab === 'investigations'}
              onClick={() => onTabChange('investigations')}
            />
          </nav>
        ) : (
          <nav className="flex items-center gap-1 flex-1">
            <Link
              href="/?tab=topics"
              className="relative flex items-center gap-1.5 px-3 py-1 text-sm font-semibold transition-colors focus:outline-none"
              style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              Today&apos;s Topics
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px', margin: '0 2px' }}>|</span>
            <Link
              href="/?tab=investigations"
              className="relative flex items-center gap-1.5 px-3 py-1 text-sm font-semibold transition-colors focus:outline-none"
              style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              Investigations
            </Link>
          </nav>
        )}

        {/* Right: CIRCLE + social icons + refresh */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white tracking-wider"
            style={{ backgroundColor: '#e31837' }}
          >
            CIRCLE
          </button>

          <SocialIcon aria-label="Twitter">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.256 5.636L18.244 2.25z" />
            </svg>
          </SocialIcon>

          <SocialIcon aria-label="LinkedIn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </SocialIcon>

          <SocialIcon aria-label="YouTube">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </SocialIcon>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="w-7 h-7 flex items-center justify-center rounded transition-all disabled:opacity-40 focus:outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.18)', color: loading ? '#e31837' : 'rgba(255,255,255,0.55)' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#e31837')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              className={loading ? 'animate-spin' : ''}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

function TabBtn({
  label, count, active, onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-1 text-sm font-semibold transition-colors focus:outline-none"
      style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.5)' }}
    >
      {label}
      {typeof count === 'number' && (
        <span className="text-xs tabular-nums" style={{ color: active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}>
          {count}
        </span>
      )}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ backgroundColor: '#e31837' }}
        />
      )}
    </button>
  )
}

function SocialIcon({ children, 'aria-label': label }: { children: React.ReactNode; 'aria-label': string }) {
  return (
    <button
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center rounded transition-colors"
      style={{ border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </button>
  )
}
