/**
 * OperationRow Component
 *
 * Displays a single operation row in the operations table with real-time status updates.
 * Uses useOperationStatus hook for live countdown timer and contract state synchronization.
 */

import React from 'react'
import { type Address } from 'viem'
import { useOperationStatus } from '@/hooks/useOperationStatus'

interface Operation {
  id: string
  fullId: `0x${string}`
  status: 'Pending' | 'Ready' | 'Executed' | 'Canceled'
  calls: number
  targets: string[]
  proposer: string
  timelockAddress: Address
  cancelledAt: bigint | null
  executedAt: bigint | null
  details?: {
    fullId: string
    fullProposer: string
    scheduled: string
    callsDetails: Array<{
      target: string
      value: string
    }>
  }
}

interface OperationRowProps {
  operation: Operation
  isExpanded: boolean
  onRowClick: (id: string) => void
  onExecute: (id: string) => void
  onCancel: (id: string) => void
  hasExecutorRole: boolean
  isCheckingExecutorRole: boolean
  getStatusColor: (status: string) => string
  getStatusTextColor: (status: string) => string
  formatTargets: (targets: string[]) => string
  formatAbsoluteTime: (timestamp: bigint) => string
}

export const OperationRow: React.FC<OperationRowProps> = ({
  operation,
  isExpanded,
  onRowClick,
  onExecute,
  onCancel,
  hasExecutorRole,
  isCheckingExecutorRole,
  getStatusColor,
  getStatusTextColor,
  formatTargets,
  formatAbsoluteTime,
}) => {
  // Get live operation status with countdown timer
  const {
    status: liveStatus,
    timeUntilReady,
    timestamp,
  } = useOperationStatus(
    operation.timelockAddress,
    operation.fullId,
    {
      cancelledAt: operation.cancelledAt,
      executedAt: operation.executedAt,
    }
  )

  // Map live status to UI status
  const statusMap: Record<string, 'Pending' | 'Ready' | 'Executed' | 'Canceled'> = {
    'PENDING': 'Pending',
    'READY': 'Ready',
    'EXECUTED': 'Executed',
    'CANCELLED': 'Canceled',
  }
  const displayStatus = statusMap[liveStatus] || operation.status

  // Calculate ETA display
  const getETADisplay = () => {
    if (displayStatus === 'Executed' || displayStatus === 'Canceled') {
      return { relative: '-', absolute: formatAbsoluteTime(timestamp) }
    }

    if (displayStatus === 'Pending' && timeUntilReady) {
      return {
        relative: `in ${timeUntilReady}`,
        absolute: formatAbsoluteTime(timestamp),
      }
    }

    if (displayStatus === 'Ready') {
      return {
        relative: 'Ready now',
        absolute: formatAbsoluteTime(timestamp),
      }
    }

    // Fallback
    return {
      relative: '-',
      absolute: formatAbsoluteTime(timestamp),
    }
  }

  const eta = getETADisplay()

  return (
    <React.Fragment>
      {/* Main Row */}
      <tr
        className={`border-b border-border-dark transition-colors cursor-pointer ${
          isExpanded
            ? 'bg-primary/10 hover:bg-primary/20'
            : 'hover:bg-white/5'
        }`}
        onClick={() => onRowClick(operation.id)}
      >
        <td className="px-6 py-4 font-mono text-text-dark-primary">
          {operation.id}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${getStatusColor(displayStatus)}`}
            ></div>
            <span
              className={`font-medium ${getStatusTextColor(displayStatus)}`}
            >
              {displayStatus}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-center font-medium text-text-dark-primary">
          {operation.calls}
        </td>
        <td className="px-6 py-4 font-mono text-text-dark-secondary">
          {formatTargets(operation.targets)}
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="font-medium text-text-dark-primary">
              {eta.relative}
            </span>
            <span className="text-xs text-text-dark-secondary">
              {eta.absolute}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 font-mono text-text-dark-secondary">
          {operation.proposer}
        </td>
        <td
          className="px-6 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end gap-2">
            {displayStatus === 'Ready' && (
              <>
                <button
                  className={`flex items-center justify-center rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                    hasExecutorRole
                      ? 'bg-status-ready/20 text-status-ready hover:bg-status-ready/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                  }`}
                  onClick={() => hasExecutorRole && onExecute(operation.id)}
                  disabled={!hasExecutorRole || isCheckingExecutorRole}
                  title={
                    isCheckingExecutorRole
                      ? 'Checking permissions...'
                      : !hasExecutorRole
                      ? 'Your wallet does not have the EXECUTOR_ROLE'
                      : 'Execute this operation'
                  }
                >
                  {isCheckingExecutorRole ? 'CHECKING...' : 'EXECUTE'}
                </button>
                <button
                  className="flex items-center justify-center rounded-md h-9 px-3 bg-status-canceled/20 text-status-canceled text-xs font-bold hover:bg-status-canceled/30 transition-colors"
                  onClick={() => onCancel(operation.id)}
                >
                  CANCEL
                </button>
              </>
            )}
            {displayStatus === 'Pending' && (
              <button
                className="flex items-center justify-center rounded-md h-9 px-3 bg-status-canceled/20 text-status-canceled text-xs font-bold hover:bg-status-canceled/30 transition-colors"
                onClick={() => onCancel(operation.id)}
              >
                CANCEL
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && operation.details && (
        <tr className="bg-primary/5">
          <td className="p-0" colSpan={7}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-border-dark">
              <div>
                <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                  Operation Details
                </h4>
                <div className="flex flex-col gap-1 text-sm font-mono">
                  <p>
                    <span className="text-text-dark-secondary">
                      ID:
                    </span>{' '}
                    <span className="text-text-dark-primary">
                      {operation.details.fullId}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-dark-secondary">
                      Proposer:
                    </span>{' '}
                    <span className="text-text-dark-primary">
                      {operation.details.fullProposer}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-dark-secondary">
                      Scheduled:
                    </span>{' '}
                    <span className="text-text-dark-primary">
                      {operation.details.scheduled}
                    </span>
                  </p>
                </div>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                  Calls ({operation.details.callsDetails.length})
                </h4>
                <div className="flex flex-col gap-2 text-sm font-mono bg-background-dark p-3 rounded-md">
                  {operation.details.callsDetails.map(
                    (call, index) => (
                      <p key={index}>
                        <span className="text-primary">
                          {index + 1}.
                        </span>{' '}
                        <span className="text-text-dark-secondary">
                          Target:
                        </span>{' '}
                        <span className="text-text-dark-primary">
                          {call.target}
                        </span>{' '}
                        <span className="text-text-dark-secondary">
                          Value:
                        </span>{' '}
                        <span className="text-text-dark-primary">
                          {call.value}
                        </span>
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  )
}
