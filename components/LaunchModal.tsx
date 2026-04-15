'use client'

import type { Investigation } from '@/types/investigation'
import StatusBadge from './StatusBadge'

interface LaunchModalProps {
  topic: Investigation
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export default function LaunchModal({ topic, onConfirm, onCancel, loading }: LaunchModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(6px)' }}
      role="dialog" aria-modal="true" aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white"
        style={{ border: '1px solid #e5e7eb', boxShadow: '0 30px 70px rgba(0,0,0,0.25)' }}>

        {/* Red top strip */}
        <div className="h-1 w-full" style={{ backgroundColor: '#e31837' }} />

        <div className="p-6">
          <h2 id="modal-title" className="text-lg font-bold text-gray-900 mb-1">
            Launch Investigation?
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            This triggers Make.com to generate the full research profile and publish a WordPress draft. This cannot be undone.
          </p>

          {/* Topic preview */}
          <div className="rounded-xl p-4 mb-5 space-y-2.5 bg-gray-50"
            style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-gray-900 font-bold text-base leading-tight">{topic.company_name}</p>
                {topic.ticker_symbol && (
                  <p className="text-gray-400 font-mono text-xs mt-0.5">{topic.ticker_symbol}</p>
                )}
              </div>
              <StatusBadge status={topic.investigation_status} />
            </div>

            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
              {topic.investigation_category}
            </p>

            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{topic.brief_topic}</p>

            {topic.why_it_matters && (
              <div className="rounded-lg px-3 py-2 bg-red-50" style={{ border: '1px solid #fecaca' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-0.5">
                  Why It Matters
                </p>
                <p className="text-xs text-red-800 leading-relaxed line-clamp-2">{topic.why_it_matters}</p>
              </div>
            )}

            {topic.suggested_date && (
              <p className="text-xs text-gray-400">Signal Date: {topic.suggested_date}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-40 focus:outline-none"
              style={{ border: '1px solid #e5e7eb' }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-600"
              style={{ backgroundColor: loading ? '#b01228' : '#e31837' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg"
                    fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Launching…
                </span>
              ) : 'Confirm Launch ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
