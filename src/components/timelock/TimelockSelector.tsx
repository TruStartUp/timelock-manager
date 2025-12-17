// src/components/timelock/TimelockSelector.tsx
import React from 'react'
import Link from 'next/link'
import { useTimelocks } from '@/hooks/useTimelocks'

/**
 * TimelockSelector Component
 *
 * Dropdown selector for switching between configured TimelockController instances.
 * Uses the TimelockContext to get available configurations and update the selected timelock.
 */
export const TimelockSelector: React.FC = () => {
  const { configurations, selected, select } = useTimelocks()

  // Show empty state if no configurations exist
  if (configurations.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded border border-border-color bg-surface px-3 py-2">
        <span className="material-symbols-outlined text-text-secondary">
          playlist_add
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-text-secondary text-xs">
            No timelocks configured
          </span>
          <Link
            href="/settings"
            className="text-primary text-sm font-semibold hover:underline underline-offset-4"
            aria-label="Go to Settings to configure timelocks"
          >
            Configure in Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative w-64">
      <select
        className="form-select flex w-full min-w-0 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface h-12 px-4 pr-12 text-base font-normal leading-normal appearance-none"
        value={selected?.id ?? ''}
        onChange={(e) => select(e.target.value || null)}
        aria-label="Select Timelock Configuration"
      >
        {!selected && <option value="">Select timelock...</option>}
        {configurations.map((config) => (
          <option key={config.id} value={config.id}>
            {config.name} ({config.network === 'rsk_mainnet' ? 'Mainnet' : 'Testnet'})
          </option>
        ))}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
        unfold_more
      </span>
      </div>

      {/* Constitution note: show full address of selected timelock for transparency */}
      {selected?.address ? (
        <div className="max-w-64 text-[11px] text-text-secondary font-mono break-all text-right">
          {selected.address}
        </div>
      ) : null}
    </div>
  )
}
