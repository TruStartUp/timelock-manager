/**
 * OperationRow Component
 *
 * Displays a single operation row in the operations table with real-time status updates.
 * Uses useOperationStatus hook for live countdown timer and contract state synchronization.
 */

import React from 'react'
import { type Address } from 'viem'
import { useOperationStatus } from '@/hooks/useOperationStatus'
import { getDangerousCallFromCalldata } from '@/lib/dangerous'

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
  // Execution parameters (from subgraph) - included for type compatibility with parent view
  target: `0x${string}` | null
  value: bigint | null
  data: `0x${string}` | null
  predecessor: `0x${string}`
  salt: `0x${string}`
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
  onCancel: (operation: Operation) => void
  hasExecutorRole: boolean
  isCheckingExecutorRole: boolean
  isExecuting: boolean
  isExecuteSuccess: boolean
  isExecuteError: boolean
  hasCancellerRole: boolean
  isCheckingCancellerRole: boolean
  isCancelling: boolean
  isCancelSuccess: boolean
  isCancelError: boolean
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
  isExecuting,
  isExecuteSuccess,
  isExecuteError,
  hasCancellerRole,
  isCheckingCancellerRole,
  isCancelling,
  isCancelSuccess,
  isCancelError,
  getStatusColor,
  getStatusTextColor,
  formatTargets,
  formatAbsoluteTime,
}) => {
  const dangerous = React.useMemo(() => {
    return getDangerousCallFromCalldata(operation.data)
  }, [operation.data])

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(operation.id)
    }
  }

  return (
    <React.Fragment>
      {/* Main Row (div-based for virtualization) */}
      <div
        role="row"
        tabIndex={0}
        aria-expanded={isExpanded}
        className={`grid min-w-[1024px] grid-cols-7 items-center border-b border-border-dark px-6 py-4 transition-colors cursor-pointer outline-none ${
          isExpanded ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-white/5'
        }`}
        onClick={() => onRowClick(operation.id)}
        onKeyDown={handleKeyDown}
      >
        <div role="cell" className="font-mono text-text-dark-primary">
          {operation.id}
        </div>
        <div role="cell">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${getStatusColor(displayStatus)}`}
            ></div>
            <span className={`font-medium ${getStatusTextColor(displayStatus)}`}>
              {displayStatus}
            </span>
            {dangerous ? (
              <span
                className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300"
                title={`Dangerous function detected: ${dangerous.functionName}`}
              >
                <span className="material-symbols-outlined mr-1 text-[14px] leading-none">
                  warning
                </span>
                {dangerous.functionName}
              </span>
            ) : null}
          </div>
        </div>
        <div
          role="cell"
          className="text-center font-medium text-text-dark-primary"
        >
          {operation.calls}
        </div>
        <div role="cell" className="font-mono text-text-dark-secondary">
          {formatTargets(operation.targets)}
        </div>
        <div role="cell">
          <div className="flex flex-col">
            <span className="font-medium text-text-dark-primary">
              {eta.relative}
            </span>
            <span className="text-xs text-text-dark-secondary">{eta.absolute}</span>
          </div>
        </div>
        <div role="cell" className="font-mono text-text-dark-secondary">
          {operation.proposer}
        </div>
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-2">
            {displayStatus === 'Ready' && (
              <>
                <button
                  className={`flex items-center justify-center gap-2 rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                    isExecuting
                      ? 'bg-primary/20 text-primary cursor-wait'
                      : isExecuteSuccess
                      ? 'bg-green-500/20 text-green-500'
                      : isExecuteError
                      ? 'bg-red-500/20 text-red-500'
                      : hasExecutorRole
                      ? 'bg-status-ready/20 text-status-ready hover:bg-status-ready/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                  }`}
                  onClick={() => hasExecutorRole && !isExecuting && onExecute(operation.id)}
                  disabled={!hasExecutorRole || isCheckingExecutorRole || isExecuting}
                  title={
                    isExecuting
                      ? 'Transaction pending...'
                      : isExecuteSuccess
                      ? 'Execution successful!'
                      : isExecuteError
                      ? 'Execution failed'
                      : isCheckingExecutorRole
                      ? 'Checking permissions...'
                      : !hasExecutorRole
                      ? 'Your wallet does not have the EXECUTOR_ROLE'
                      : 'Execute this operation'
                  }
                >
                  {isExecuting && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  )}
                  {isExecuteSuccess && (
                    <span className="material-symbols-outlined text-base!">check_circle</span>
                  )}
                  {isExecuteError && (
                    <span className="material-symbols-outlined text-base!">error</span>
                  )}
                  {isExecuting
                    ? 'EXECUTING...'
                    : isExecuteSuccess
                    ? 'SUCCESS'
                    : isExecuteError
                    ? 'FAILED'
                    : isCheckingExecutorRole
                    ? 'CHECKING...'
                    : 'EXECUTE'}
                </button>
                <button
                  className={`flex items-center justify-center gap-2 rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                    isCancelling
                      ? 'bg-primary/20 text-primary cursor-wait'
                      : isCancelSuccess
                      ? 'bg-green-500/20 text-green-500'
                      : isCancelError
                      ? 'bg-red-500/20 text-red-500'
                      : hasCancellerRole
                      ? 'bg-status-canceled/20 text-status-canceled hover:bg-status-canceled/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                  }`}
                  onClick={() =>
                    hasCancellerRole && !isCancelling && onCancel(operation)
                  }
                  disabled={!hasCancellerRole || isCheckingCancellerRole || isCancelling}
                  title={
                    isCancelling
                      ? 'Transaction pending...'
                      : isCancelSuccess
                      ? 'Cancellation successful!'
                      : isCancelError
                      ? 'Cancellation failed'
                      : isCheckingCancellerRole
                      ? 'Checking permissions...'
                      : !hasCancellerRole
                      ? 'Your wallet does not have the CANCELLER_ROLE'
                      : 'Cancel this operation'
                  }
                >
                  {isCancelling && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  )}
                  {isCancelSuccess && (
                    <span className="material-symbols-outlined text-base!">check_circle</span>
                  )}
                  {isCancelError && (
                    <span className="material-symbols-outlined text-base!">error</span>
                  )}
                  {isCancelling
                    ? 'CANCELLING...'
                    : isCancelSuccess
                    ? 'SUCCESS'
                    : isCancelError
                    ? 'FAILED'
                    : isCheckingCancellerRole
                    ? 'CHECKING...'
                    : 'CANCEL'}
                </button>
              </>
            )}
            {displayStatus === 'Pending' && (
              <button
                className={`flex items-center justify-center gap-2 rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                  isCancelling
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : isCancelSuccess
                    ? 'bg-green-500/20 text-green-500'
                    : isCancelError
                    ? 'bg-red-500/20 text-red-500'
                    : hasCancellerRole
                    ? 'bg-status-canceled/20 text-status-canceled hover:bg-status-canceled/30'
                    : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                }`}
                onClick={() =>
                  hasCancellerRole && !isCancelling && onCancel(operation)
                }
                disabled={!hasCancellerRole || isCheckingCancellerRole || isCancelling}
                title={
                  isCancelling
                    ? 'Transaction pending...'
                    : isCancelSuccess
                    ? 'Cancellation successful!'
                    : isCancelError
                    ? 'Cancellation failed'
                    : isCheckingCancellerRole
                    ? 'Checking permissions...'
                    : !hasCancellerRole
                    ? 'Your wallet does not have the CANCELLER_ROLE'
                    : 'Cancel this operation'
                }
              >
                {isCancelling && (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                )}
                {isCancelSuccess && (
                  <span className="material-symbols-outlined text-base!">check_circle</span>
                )}
                {isCancelError && (
                  <span className="material-symbols-outlined text-base!">error</span>
                )}
                {isCancelling
                  ? 'CANCELLING...'
                  : isCancelSuccess
                  ? 'SUCCESS'
                  : isCancelError
                  ? 'FAILED'
                  : isCheckingCancellerRole
                  ? 'CHECKING...'
                  : 'CANCEL'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details Row */}
      {isExpanded && operation.details && (
        <div className="min-w-[1024px] bg-primary/5">
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3 border-b border-border-dark">
            <div>
              <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                Operation Details
              </h4>
              <div className="flex flex-col gap-1 text-sm font-mono">
                <p>
                  <span className="text-text-dark-secondary">ID:</span>{' '}
                  <span className="text-text-dark-primary">
                    {operation.details.fullId}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Proposer:</span>{' '}
                  <span className="text-text-dark-primary">
                    {operation.details.fullProposer}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Scheduled:</span>{' '}
                  <span className="text-text-dark-primary">
                    {operation.details.scheduled}
                  </span>
                </p>
              </div>
              {dangerous ? (
                <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  <div className="font-semibold">Dangerous function detected</div>
                  <div className="mt-1 text-red-200/80">
                    This operation appears to call{' '}
                    <span className="font-mono">{dangerous.functionName}</span>.
                    Double-check the target and calldata before executing.
                  </div>
                </div>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                Calls ({operation.details.callsDetails.length})
              </h4>
              <div className="flex flex-col gap-2 text-sm font-mono bg-background-dark p-3 rounded-md">
                {operation.details.callsDetails.map((call, index) => (
                  <p key={index}>
                    <span className="text-primary">{index + 1}.</span>{' '}
                    <span className="text-text-dark-secondary">Target:</span>{' '}
                    <span className="text-text-dark-primary">{call.target}</span>{' '}
                    <span className="text-text-dark-secondary">Value:</span>{' '}
                    <span className="text-text-dark-primary">{call.value}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  )
}
