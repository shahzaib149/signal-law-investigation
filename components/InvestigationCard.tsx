import Link from 'next/link'
import Image from 'next/image'
import type { Investigation } from '@/types/investigation'

interface InvestigationCardProps {
  record: Investigation
}

const CATEGORY_COLORS: Record<string, { bg: string; letter: string }> = {
  'Consumer Protection': { bg: '#f8e8ea', letter: '#d1a0a8' },
  'Securities':          { bg: '#e8eaf8', letter: '#a0a8d1' },
  'Antitrust':           { bg: '#e8f8ec', letter: '#a0d1a8' },
  'Privacy & Data':      { bg: '#f8f4e8', letter: '#d1c4a0' },
  'Healthcare':          { bg: '#e8f4f8', letter: '#a0c4d1' },
  'Financial':           { bg: '#f0e8f8', letter: '#c4a0d1' },
  'Technology':          { bg: '#e8f8f4', letter: '#a0d1c4' },
}

function Placeholder({ category }: { category: string }) {
  const c = CATEGORY_COLORS[category] ?? { bg: '#edf0f5', letter: '#b0b8c8' }
  const letter = (category || 'I').charAt(0).toUpperCase()
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: c.bg }}>
      <span style={{ fontSize: '72px', fontWeight: 900, color: c.letter, lineHeight: 1, userSelect: 'none' }}>
        {letter}
      </span>
    </div>
  )
}

export default function InvestigationCard({ record }: InvestigationCardProps) {
  return (
    <Link
      href={`/investigations/${record.id}`}
      className="topic-card group flex flex-col bg-white overflow-hidden"
      style={{
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        borderRadius: '6px',
        textDecoration: 'none',
      }}
    >
      {/* Image */}
      <div className="relative w-full overflow-hidden shrink-0" style={{ height: '180px' }}>
        {record.featured_media_url ? (
          <Image
            src={record.featured_media_url}
            alt={record.company_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        ) : (
          <Placeholder category={record.investigation_category} />
        )}
      </div>

      {/* Title only */}
      <div className="px-4 py-4 flex flex-col gap-1">
        <p className="font-bold text-gray-900 text-sm leading-snug">
          {record.company_name}
        </p>
        {record.investigation_category && (
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            {record.investigation_category}
          </p>
        )}
      </div>
    </Link>
  )
}
