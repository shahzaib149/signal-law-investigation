'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { Investigation, InvestigationStatus } from '@/types/investigation'

/* ─── Status badge config ──────────────────────────────────────── */

const STATUS_CONFIG: Record<InvestigationStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  Pending:           { label: 'Pending',         dot: '#9ca3af', bg: 'rgba(243,244,246,0.95)',  text: '#4b5563', border: 'rgba(209,213,219,0.7)' },
  Intake:            { label: 'Intake',           dot: '#3b82f6', bg: 'rgba(239,246,255,0.95)',  text: '#1d4ed8', border: 'rgba(147,197,253,0.7)' },
  Generating:        { label: 'Generating',       dot: '#f59e0b', bg: 'rgba(255,251,235,0.95)',  text: '#b45309', border: 'rgba(252,211,77,0.7)'  },
  'Active Research': { label: 'Active Research',  dot: '#f59e0b', bg: 'rgba(255,251,235,0.95)',  text: '#b45309', border: 'rgba(252,211,77,0.7)'  },
  Approved:          { label: 'Approved',         dot: '#10b981', bg: 'rgba(236,253,245,0.95)',  text: '#065f46', border: 'rgba(110,231,183,0.7)' },
  Published:         { label: 'Published',        dot: '#22c55e', bg: 'rgba(240,253,244,0.95)',  text: '#166534', border: 'rgba(134,239,172,0.7)' },
  Rejected:          { label: 'Rejected',         dot: '#ef4444', bg: 'rgba(254,242,242,0.95)',  text: '#b91c1c', border: 'rgba(252,165,165,0.7)' },
}

/* ─── Category placeholder ─────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, { from: string; to: string; letter: string }> = {
  'Consumer Protection': { from: '#f9e4e7', to: '#f0c8cf', letter: '#c47a87' },
  'Securities':          { from: '#e4e7f9', to: '#c8cff0', letter: '#7a87c4' },
  'Antitrust':           { from: '#e4f9e7', to: '#c8f0cf', letter: '#7ac487' },
  'Privacy & Data':      { from: '#f9f4e4', to: '#f0e6c8', letter: '#c4a87a' },
  'Healthcare':          { from: '#e4f4f9', to: '#c8e6f0', letter: '#7aa8c4' },
  'Financial':           { from: '#f4e4f9', to: '#e6c8f0', letter: '#a87ac4' },
  'Technology':          { from: '#e4f9f4', to: '#c8f0e6', letter: '#7ac4a8' },
}

function Placeholder({ category }: { category: string }) {
  const c = CATEGORY_COLORS[category] ?? { from: '#edf0f5', to: '#dde3ee', letter: '#8a96a8' }
  const letter = (category || 'I').charAt(0).toUpperCase()
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)` }}
    >
      <span style={{ fontSize: '80px', fontWeight: 900, color: c.letter, lineHeight: 1, userSelect: 'none', opacity: 0.6 }}>
        {letter}
      </span>
    </div>
  )
}

/* ─── Card ─────────────────────────────────────────────────────── */

export default function InvestigationCard({ record }: { record: Investigation }) {
  const statusCfg = STATUS_CONFIG[record.investigation_status as InvestigationStatus] ?? STATUS_CONFIG['Active Research']

  return (
    <Link
      href={`/investigations/${record.id}`}
      className="group flex flex-col bg-white overflow-hidden"
      style={{
        borderRadius: '10px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        textDecoration: 'none',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)'
        el.style.transform  = 'translateY(-2px)'
        el.style.borderColor = '#d1d5db'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.boxShadow  = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
        el.style.transform   = 'translateY(0)'
        el.style.borderColor = '#e5e7eb'
      }}
    >
      {/* ── Image section ── */}
      <div className="relative w-full overflow-hidden shrink-0" style={{ height: 'clamp(160px, 22vw, 200px)' }}>

        {record.featured_media_url ? (
          <Image
            src={record.featured_media_url}
            alt={record.company_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            style={{ objectFit: 'cover', transition: 'transform 0.3s ease' }}
            className="group-hover:scale-105"
            unoptimized
          />
        ) : (
          <Placeholder category={record.investigation_category} />
        )}

        {/* Gradient overlay for readability */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.28) 100%)' }}
        />

        {/* Status badge — top right */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: statusCfg.bg,
            border: `1px solid ${statusCfg.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: statusCfg.dot }}
          />
          <span style={{ fontSize: '10px', fontWeight: 700, color: statusCfg.text, letterSpacing: '0.04em', lineHeight: 1 }}>
            {statusCfg.label}
          </span>
        </div>

      </div>

      {/* ── Text section ── */}
      <div className="px-4 pt-3.5 pb-4 flex flex-col gap-1.5">

        <p
          className="font-bold text-gray-900 leading-snug"
          style={{ fontSize: '13.5px' }}
        >
          {record.company_name}
        </p>

        {record.investigation_category && (
          <p
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '0.09em' }}
          >
            {record.investigation_category}
          </p>
        )}

        {/* Divider + "View Profile" hint */}
        <div
          className="flex items-center justify-between mt-1.5 pt-2.5"
          style={{ borderTop: '1px solid #f3f4f6' }}
        >
          <span style={{ fontSize: '11px', color: '#d1d5db', fontWeight: 500 }}>
            Research Profile
          </span>
          <span
            className="flex items-center gap-0.5 font-semibold transition-colors"
            style={{ fontSize: '11px', color: '#e31837' }}
          >
            View
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>

      </div>
    </Link>
  )
}
