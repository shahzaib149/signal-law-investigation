import type { ParsedScore } from '@/types/investigation'
import { bandAccent } from '@/lib/scoring'

interface ScoreTileProps {
  score: ParsedScore
}

export default function ScoreTile({ score }: ScoreTileProps) {
  const c = bandAccent(score.band)

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 bg-white"
      style={{
        border: `1px solid ${c.border}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {/* Tag + label */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: c.text }}
        >
          {score.key}
        </span>
        {score.band && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: c.text,
              backgroundColor: c.bg,
              border: `1px solid ${c.border}`,
            }}
          >
            {score.band}
          </span>
        )}
      </div>

      {/* Value */}
      <p
        className="text-2xl font-bold leading-none tabular-nums"
        style={{ color: c.text }}
      >
        {score.value}
      </p>

      {/* Full label */}
      <p className="text-[11px] text-gray-500 leading-tight">{score.label}</p>
    </div>
  )
}
