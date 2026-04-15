import type { InvestigationStatus } from '@/types/investigation'

/** Full lifecycle: Pending → Intake → Generating → Active Research → Approved → Published | Rejected */
const statusStyles: Record<InvestigationStatus, string> = {
  Pending:           'bg-gray-100    text-gray-600    border border-gray-200',
  Intake:            'bg-blue-50     text-blue-700    border border-blue-200',
  Generating:        'bg-amber-50    text-amber-700   border border-amber-200 badge-generating',
  'Active Research': 'bg-purple-50   text-purple-700  border border-purple-200',
  Approved:          'bg-emerald-50  text-emerald-700 border border-emerald-200',
  Published:         'bg-green-100   text-green-800   border border-green-300',
  Rejected:          'bg-red-50      text-red-700     border border-red-200',
}

interface StatusBadgeProps {
  status: string
  variant?: 'status'  // risk tier removed (field doesn't exist in Airtable)
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const base =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap'

  const style =
    statusStyles[status as InvestigationStatus] ?? statusStyles.Pending

  return <span className={`${base} ${style} ${className}`}>{status}</span>
}
