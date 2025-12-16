import React, { useState, useMemo, useEffect, useRef } from 'react'
import { type Address, formatEther, isAddress } from 'viem'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useOperations } from '@/hooks/useOperations'
import { useHasRole } from '@/hooks/useHasRole'
import { useTimelockWrite } from '@/hooks/useTimelockWrite'
import { TIMELOCK_ROLES } from '@/lib/constants'
import { formatTxError } from '@/lib/txErrors'
import { type Operation as SubgraphOperation, type OperationStatus as SubgraphOperationStatus } from '@/types/operation'
import { Skeleton } from '@/components/common/Skeleton'
import { OperationRow } from './OperationRow'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'

type OperationStatus = 'All' | 'Pending' | 'Ready' | 'Executed' | 'Canceled'

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

interface Operation {
  id: string
  fullId: `0x${string}`
  status: Exclude<OperationStatus, 'All'>
  calls: number
  targets: string[]
  proposer: string
  timelockAddress: Address
  cancelledAt: bigint | null
  executedAt: bigint | null
  // Execution parameters (from subgraph)
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

type SimulationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'error'; message: string }

const OperationsExplorerView: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<OperationStatus>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  // T116: pagination state
  const [pageSize, setPageSize] = useState<number>(50)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const [confirmCancelOperation, setConfirmCancelOperation] =
    useState<Operation | null>(null)
  const [activeCancelOperationId, setActiveCancelOperationId] = useState<
    `0x${string}` | null
  >(null)

  // T111: Simulation previews
  const publicClient = usePublicClient()
  const [confirmExecuteOperation, setConfirmExecuteOperation] =
    useState<Operation | null>(null)
  const [executeSimulation, setExecuteSimulation] =
    useState<SimulationState>({ status: 'idle' })
  const [cancelSimulation, setCancelSimulation] =
    useState<SimulationState>({ status: 'idle' })

  // T113: focus management for dialogs
  const lastFocusedElRef = useRef<HTMLElement | null>(null)
  const executeDialogCloseRef = useRef<HTMLButtonElement | null>(null)
  const cancelDialogCloseRef = useRef<HTMLButtonElement | null>(null)

  // State for selected timelock contract address
  // Using the actual deployed TimelockController on Rootstock Testnet
  const [timelockAddress] = useState<Address | undefined>(
    '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as Address // Real testnet contract
  )

  // Get connected wallet address
  const { address: connectedAccount } = useAccount()

  // Get current chain ID for query invalidation
  const chainId = useChainId()

  // Get query client for invalidating queries after execution
  const queryClient = useQueryClient()

  // Check if connected wallet has EXECUTOR_ROLE (only if timelockAddress is set)
  const { hasRole: hasExecutorRole, isLoading: isCheckingExecutorRole } = useHasRole({
    timelockController: timelockAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
    role: TIMELOCK_ROLES.EXECUTOR_ROLE,
    account: connectedAccount,
  })

  // T081: Check if connected wallet has CANCELLER_ROLE
  const { hasRole: hasCancellerRole, isLoading: isCheckingCancellerRole } = useHasRole({
    timelockController:
      timelockAddress ??
      ('0x0000000000000000000000000000000000000000' as Address),
    role: TIMELOCK_ROLES.CANCELLER_ROLE,
    account: connectedAccount,
  })

  // Initialize useTimelockWrite for executing operations
  const {
    execute,
    cancel,
    isPending: isExecuting,
    isSuccess: isExecuteSuccess,
    isError: isExecuteError,
    error: executeError,
    txHash: executeTxHash,
    isCancelPending: isCancelling,
    isCancelSuccess,
    isCancelError,
    cancelError,
    cancelTxHash,
    resetCancel,
  } = useTimelockWrite({
    timelockController: timelockAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
    account: connectedAccount,
  })

  // T111: simulate execute() when the confirm modal opens
  useEffect(() => {
    const run = async () => {
      if (
        !publicClient ||
        !timelockAddress ||
        !confirmExecuteOperation ||
        !confirmExecuteOperation.target ||
        confirmExecuteOperation.value === null ||
        !confirmExecuteOperation.data
      ) {
        setExecuteSimulation({ status: 'idle' })
        return
      }

      setExecuteSimulation({ status: 'pending' })
      try {
        await publicClient.simulateContract({
          address: timelockAddress,
          abi: TimelockControllerABI as any,
          functionName: 'execute',
          args: [
            confirmExecuteOperation.target,
            confirmExecuteOperation.value,
            confirmExecuteOperation.data,
            confirmExecuteOperation.predecessor,
            confirmExecuteOperation.salt,
          ],
          value: confirmExecuteOperation.value,
          account: connectedAccount,
        } as any)

        setExecuteSimulation({ status: 'success' })
      } catch (err) {
        setExecuteSimulation({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
    run()
  }, [confirmExecuteOperation, connectedAccount, publicClient, timelockAddress])

  // T113: focus trap-lite for execute dialog
  useEffect(() => {
    if (confirmExecuteOperation) {
      lastFocusedElRef.current = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => executeDialogCloseRef.current?.focus())
      return
    }
    lastFocusedElRef.current?.focus?.()
  }, [confirmExecuteOperation])

  // T111: simulate cancel(id) when cancel confirmation dialog opens
  useEffect(() => {
    const run = async () => {
      if (!publicClient || !timelockAddress || !confirmCancelOperation) {
        setCancelSimulation({ status: 'idle' })
        return
      }

      setCancelSimulation({ status: 'pending' })
      try {
        await publicClient.simulateContract({
          address: timelockAddress,
          abi: TimelockControllerABI as any,
          functionName: 'cancel',
          args: [confirmCancelOperation.fullId],
          account: connectedAccount,
        } as any)
        setCancelSimulation({ status: 'success' })
      } catch (err) {
        setCancelSimulation({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
    run()
  }, [confirmCancelOperation, connectedAccount, publicClient, timelockAddress])

  // T113: focus trap-lite for cancel dialog
  useEffect(() => {
    if (confirmCancelOperation) {
      lastFocusedElRef.current = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => cancelDialogCloseRef.current?.focus())
      return
    }
    lastFocusedElRef.current?.focus?.()
  }, [confirmCancelOperation])

  // Map UI filter to subgraph status filter
  const statusFilter: SubgraphOperationStatus | undefined = useMemo(() => {
    if (selectedFilter === 'All') return undefined
    // Map UI status to subgraph status
    const statusMap: Record<Exclude<OperationStatus, 'All'>, SubgraphOperationStatus> = {
      'Pending': 'PENDING',
      'Ready': 'READY',
      'Executed': 'EXECUTED',
      'Canceled': 'CANCELLED',
    }
    return statusMap[selectedFilter]
  }, [selectedFilter])

  // T091: If search input is an address, apply to BOTH proposer + target filters.
  const normalizedAddressQuery = useMemo((): Address | null => {
    const trimmed = searchQuery.trim().replace(/^0X/, '0x')
    if (!trimmed) return null
    if (
      isAddress(trimmed, {
        strict: false,
      })
    ) {
      return trimmed.toLowerCase() as Address
    }
    return null
  }, [searchQuery])

  const textSearch = useMemo(() => {
    if (normalizedAddressQuery) return ''
    return searchQuery.trim().toLowerCase()
  }, [normalizedAddressQuery, searchQuery])

  const dateFromTs = useMemo((): bigint | undefined => {
    if (!dateFrom) return undefined
    const ms = Date.parse(`${dateFrom}T00:00:00Z`)
    if (Number.isNaN(ms)) return undefined
    return BigInt(Math.floor(ms / 1000))
  }, [dateFrom])

  const dateToTs = useMemo((): bigint | undefined => {
    if (!dateTo) return undefined
    const ms = Date.parse(`${dateTo}T23:59:59Z`)
    if (Number.isNaN(ms)) return undefined
    return BigInt(Math.floor(ms / 1000))
  }, [dateTo])

  const dateRangeError = useMemo(() => {
    if (dateFromTs !== undefined && dateToTs !== undefined && dateFromTs > dateToTs) {
      return 'Invalid date range: “From” must be earlier than “To”.'
    }
    return null
  }, [dateFromTs, dateToTs])

  // T116: reset pagination when filters change
  useEffect(() => {
    setPageIndex(0)
  }, [
    selectedFilter,
    normalizedAddressQuery,
    textSearch,
    dateFromTs,
    dateToTs,
    timelockAddress,
  ])

  // Fetch operations from subgraph with filters
  const { data: subgraphOperations, isLoading, isError, refetch } = useOperations(
    {
      timelockController: timelockAddress,
      status: statusFilter,
      proposer: normalizedAddressQuery ?? undefined,
      target: normalizedAddressQuery ?? undefined,
      dateFrom: dateFromTs,
      dateTo: dateToTs,
    },
    {
      enabled: !dateRangeError,
      pagination: {
        first: pageSize,
        skip: pageIndex * pageSize,
      },
    }
  )

  // Automatically refresh operations list after successful execution (T044)
  useEffect(() => {
    if (isExecuteSuccess) {
      // Invalidate all operations queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['operations', chainId] })

      // Also invalidate operations summary for dashboard updates
      queryClient.invalidateQueries({ queryKey: ['operations-summary', chainId] })
    }
  }, [isExecuteSuccess, chainId, queryClient])

  // T085: Automatically refresh operations list after successful cancellation
  useEffect(() => {
    if (isCancelSuccess) {
      queryClient.invalidateQueries({ queryKey: ['operations', chainId] })
      queryClient.invalidateQueries({ queryKey: ['operations-summary', chainId] })
    }
  }, [isCancelSuccess, chainId, queryClient])

  // Helper functions for formatting
  const shortenAddress = (address: string): string => {
    if (address.length < 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatAbsoluteTime = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    })
  }

  const mapSubgraphStatus = (status: SubgraphOperationStatus): Exclude<OperationStatus, 'All'> => {
    const statusMap: Record<SubgraphOperationStatus, Exclude<OperationStatus, 'All'>> = {
      'PENDING': 'Pending',
      'READY': 'Ready',
      'EXECUTED': 'Executed',
      'CANCELLED': 'Canceled',
    }
    return statusMap[status]
  }

  // Transform subgraph operations to UI operations format
  const operations: Operation[] = useMemo(() => {
    if (!subgraphOperations) return []

    return subgraphOperations.map((op: SubgraphOperation) => {
      // Determine targets - either from calls array or single target
      const targets: string[] = op.target ? [op.target] : []
      const callsCount = op.target ? 1 : 0 // Will be updated when calls relationship is available

      // Format operation for UI
      const uiOperation: Operation = {
        id: shortenAddress(op.id),
        fullId: op.id,
        status: mapSubgraphStatus(op.status),
        calls: callsCount,
        targets: targets.map(shortenAddress),
        proposer: shortenAddress(op.scheduledBy),
        timelockAddress: timelockAddress!,
        cancelledAt: op.cancelledAt,
        executedAt: op.executedAt,
        // Execution parameters for useTimelockWrite
        target: op.target ?? null,
        value: op.value ?? null,
        data: op.data ?? null,
        predecessor: op.predecessor ?? ZERO_BYTES32,
        salt: op.salt ?? ZERO_BYTES32,
        details: {
          fullId: op.id,
          fullProposer: op.scheduledBy,
          scheduled: formatAbsoluteTime(op.scheduledAt),
          callsDetails: op.target && op.value !== null ? [{
            target: op.target,
            value: op.value > BigInt(0) ? `${formatEther(op.value)} RBTC` : '0',
          }] : [],
        },
      }

      return uiOperation
    })
  }, [subgraphOperations, timelockAddress])

  // Filter operations by search query (client-side)
  const clientFilteredOperations = useMemo(() => {
    if (!textSearch) return operations
    return operations.filter((op) =>
      op.id.toLowerCase().includes(textSearch) ||
      op.proposer.toLowerCase().includes(textSearch) ||
      op.details?.fullId.toLowerCase().includes(textSearch) ||
      op.details?.fullProposer.toLowerCase().includes(textSearch)
    )
  }, [operations, textSearch])

  const resultsCount = useMemo(() => {
    const skip = pageIndex * pageSize
    const showing = clientFilteredOperations.length
    const from = showing === 0 ? 0 : skip + 1
    const to = skip + showing
    return {
      showing,
      total: operations.length,
      from,
      to,
    }
  }, [clientFilteredOperations.length, operations.length, pageIndex, pageSize])

  const canPrevPage = pageIndex > 0
  const canNextPage = Boolean(subgraphOperations && subgraphOperations.length === pageSize)

  const activeFilters = useMemo(() => {
    const items: Array<{ key: string; label: string; onClear: () => void }> = []
    if (selectedFilter !== 'All') {
      items.push({
        key: 'status',
        label: `Status: ${selectedFilter}`,
        onClear: () => setSelectedFilter('All'),
      })
    }
    if (normalizedAddressQuery) {
      items.push({
        key: 'address',
        label: `Address: ${shortenAddress(normalizedAddressQuery)}`,
        onClear: () => setSearchQuery(''),
      })
    } else if (textSearch) {
      items.push({
        key: 'search',
        label: `Search: ${searchQuery.trim()}`,
        onClear: () => setSearchQuery(''),
      })
    }
    if (dateFrom || dateTo) {
      const label = `Date: ${dateFrom || '…'} → ${dateTo || '…'}`
      items.push({
        key: 'date',
        label,
        onClear: () => {
          setDateFrom('')
          setDateTo('')
        },
      })
    }
    return items
  }, [dateFrom, dateTo, normalizedAddressQuery, searchQuery, selectedFilter, textSearch])

  const clearAllFilters = () => {
    setSelectedFilter('All')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'bg-status-ready'
      case 'Pending':
        return 'bg-status-pending'
      case 'Executed':
        return 'bg-status-executed'
      case 'Canceled':
        return 'bg-status-canceled'
      default:
        return 'bg-border-dark'
    }
  }

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'text-status-ready'
      case 'Pending':
        return 'text-status-pending'
      case 'Executed':
        return 'text-status-executed'
      case 'Canceled':
        return 'text-status-canceled'
      default:
        return 'text-text-dark-secondary'
    }
  }

  const handleRowClick = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id)
  }

  const handleExecute = (id: string) => {
    // Find the operation by shortened ID
    const operation = operations.find((op) => op.id === id)
    if (!operation) {
      console.error('Operation not found:', id)
      return
    }

    // Validate operation has required parameters
    if (!operation.target || operation.value === null || !operation.data) {
      console.error('Operation missing required parameters for execution:', operation)
      return
    }

    // T111: Open simulation preview first
    setConfirmExecuteOperation(operation)
  }

  const handleCancel = (operation: Operation) => {
    // T082: Show confirmation dialog with operation details before submission
    setConfirmCancelOperation(operation)
  }

  const confirmCancel = () => {
    if (!confirmCancelOperation) return
    // Ensure previous cancel mutation state doesn't bleed into the next one.
    resetCancel()
    setActiveCancelOperationId(confirmCancelOperation.fullId)
    cancel(confirmCancelOperation.fullId)
    setConfirmCancelOperation(null)
  }

  const confirmExecute = () => {
    if (!confirmExecuteOperation) return
    // Execute the operation using useTimelockWrite
    execute({
      target: confirmExecuteOperation.target!,
      value: confirmExecuteOperation.value!,
      data: confirmExecuteOperation.data!,
      predecessor: confirmExecuteOperation.predecessor,
      salt: confirmExecuteOperation.salt,
    })
    setConfirmExecuteOperation(null)
  }

  const formatTargets = (targets: string[]) => {
    if (targets.length <= 1) return targets[0] || ''
    return `${targets[0]}, +${targets.length - 1} more`
  }

  return (
    <>
      {/* T111: Execute simulation preview dialog */}
      {confirmExecuteOperation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="execute-dialog-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmExecuteOperation(null)
          }}
        >
          <div className="w-full max-w-xl rounded-lg border border-border-dark bg-surface-dark p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="execute-dialog-title"
                  className="text-xl font-bold text-text-dark-primary"
                >
                  Confirm execution
                </h3>
                <p className="mt-1 text-sm text-text-dark-secondary">
                  We’ll run a simulation (eth_call) first to preview whether the
                  transaction is likely to succeed.
                </p>
              </div>
              <button
                className="text-text-dark-secondary hover:text-text-dark-primary"
                onClick={() => setConfirmExecuteOperation(null)}
                aria-label="Close execute confirmation dialog"
                ref={executeDialogCloseRef}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-md bg-background-dark p-4 font-mono text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Operation ID</span>
                <span className="text-text-dark-primary break-all">
                  {confirmExecuteOperation.details?.fullId ??
                    confirmExecuteOperation.fullId}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Target</span>
                <span className="text-text-dark-primary break-all">
                  {confirmExecuteOperation.target ?? '—'}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded border border-border-dark bg-background-dark p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-text-dark-primary">
                  Simulation
                </span>
                {executeSimulation.status === 'pending' ? (
                  <span className="text-text-dark-secondary">Running…</span>
                ) : executeSimulation.status === 'success' ? (
                  <span className="text-green-300">Likely succeeds</span>
                ) : executeSimulation.status === 'error' ? (
                  <span className="text-red-300">May fail</span>
                ) : (
                  <span className="text-text-dark-secondary">—</span>
                )}
              </div>
              {executeSimulation.status === 'error' ? (
                <p className="mt-2 text-red-300 wrap-break-word">
                  {executeSimulation.message}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-md border border-border-dark bg-transparent px-4 py-2 text-sm font-semibold text-text-dark-secondary hover:bg-white/5"
                onClick={() => setConfirmExecuteOperation(null)}
                disabled={isExecuting}
              >
                Close
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  isExecuting
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : hasExecutorRole
                      ? 'bg-status-ready/20 text-status-ready hover:bg-status-ready/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                }`}
                onClick={confirmExecute}
                disabled={!hasExecutorRole || isCheckingExecutorRole || isExecuting}
                title={
                  isExecuting
                    ? 'Transaction pending...'
                    : isCheckingExecutorRole
                      ? 'Checking permissions...'
                      : !hasExecutorRole
                        ? 'Your wallet does not have the EXECUTOR_ROLE'
                        : executeSimulation.status === 'pending'
                          ? 'Waiting for simulation...'
                          : 'Execute this operation'
                }
              >
                {isExecuting ? 'Executing…' : 'Execute operation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* T082: Cancel confirmation dialog */}
      {confirmCancelOperation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmCancelOperation(null)
          }}
        >
          <div className="w-full max-w-xl rounded-lg border border-border-dark bg-surface-dark p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="cancel-dialog-title"
                  className="text-xl font-bold text-text-dark-primary"
                >
                  Confirm cancellation
                </h3>
                <p className="mt-1 text-sm text-text-dark-secondary">
                  This will submit a transaction calling <code>cancel(id)</code> on the timelock.
                </p>
              </div>
              <button
                className="text-text-dark-secondary hover:text-text-dark-primary"
                onClick={() => setConfirmCancelOperation(null)}
                aria-label="Close cancel confirmation dialog"
                ref={cancelDialogCloseRef}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-md bg-background-dark p-4 font-mono text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Operation ID</span>
                <span className="text-text-dark-primary break-all">
                  {confirmCancelOperation.details?.fullId ??
                    confirmCancelOperation.fullId}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Proposer</span>
                <span className="text-text-dark-primary break-all">
                  {confirmCancelOperation.details?.fullProposer ??
                    confirmCancelOperation.proposer}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Status</span>
                <span className="text-text-dark-primary">
                  {confirmCancelOperation.status}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Targets</span>
                <span className="text-text-dark-primary break-all">
                  {confirmCancelOperation.targets.join(', ') || '—'}
                </span>
              </div>
            </div>

            {/* T111: cancel simulation */}
            <div className="mt-4 rounded border border-border-dark bg-background-dark p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-text-dark-primary">
                  Simulation
                </span>
                {cancelSimulation.status === 'pending' ? (
                  <span className="text-text-dark-secondary">Running…</span>
                ) : cancelSimulation.status === 'success' ? (
                  <span className="text-green-300">Likely succeeds</span>
                ) : cancelSimulation.status === 'error' ? (
                  <span className="text-red-300">May fail</span>
                ) : (
                  <span className="text-text-dark-secondary">—</span>
                )}
              </div>
              {cancelSimulation.status === 'error' ? (
                <p className="mt-2 text-red-300 wrap-break-word">
                  {cancelSimulation.message}
                </p>
              ) : null}
            </div>

            {isCancelError && cancelError ? (
              <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {formatTxError(cancelError)}
              </div>
            ) : null}

            {isCancelSuccess && cancelTxHash ? (
              <div className="mt-4 rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
                Cancelled successfully. Tx:{' '}
                <span className="font-mono break-all">{cancelTxHash}</span>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-md border border-border-dark bg-transparent px-4 py-2 text-sm font-semibold text-text-dark-secondary hover:bg-white/5"
                onClick={() => setConfirmCancelOperation(null)}
                disabled={isCancelling}
              >
                Close
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  isCancelling
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : hasCancellerRole
                      ? 'bg-status-canceled/20 text-status-canceled hover:bg-status-canceled/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                }`}
                onClick={confirmCancel}
                disabled={!hasCancellerRole || isCheckingCancellerRole || isCancelling}
                title={
                  isCancelling
                    ? 'Transaction pending...'
                    : isCheckingCancellerRole
                      ? 'Checking permissions...'
                      : !hasCancellerRole
                        ? 'Your wallet does not have the CANCELLER_ROLE'
                        : 'Cancel this operation'
                }
              >
                {isCancelling ? 'Cancelling…' : 'Cancel operation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark px-6 py-4 mb-4">
        <div className="flex items-center gap-4 text-text-dark-primary">
          <div className="size-6 text-primary">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <h1 className="text-text-dark-primary text-lg font-bold leading-tight tracking-[-0.015em]">
            Timelock Management
          </h1>
        </div>
        <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full h-10 px-4 bg-primary text-background-dark text-sm font-bold leading-normal tracking-[0.015em] hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-xl!">add</span>
          <span className="truncate">Schedule Operation</span>
        </button>
      </header>

      <main className="flex flex-col gap-4 p-4 md:p-6">
        {/* Page Heading */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-text-dark-primary text-4xl font-black leading-tight tracking-[-0.033em]">
            Timelock Operations
          </h2>
        </div>

        {/* Toolbar / Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-lg bg-surface-dark p-3">
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                'All',
                'Pending',
                'Ready',
                'Executed',
                'Canceled',
              ] as OperationStatus[]
            ).map((filter) => (
              <button
                key={filter}
                className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 text-sm font-medium leading-normal transition-colors ${
                  selectedFilter === filter
                    ? 'bg-primary text-background-dark'
                    : 'bg-border-dark text-text-dark-primary hover:bg-white/10'
                }`}
                onClick={() => setSelectedFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Search Bar & Advanced Filter */}
          <div className="flex items-center gap-2">
            <div className="grow">
              <label className="flex flex-col min-w-40 h-11 w-full">
                <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                  <div className="text-text-dark-secondary flex items-center justify-center rounded-l-lg border-r-0 border-none bg-border-dark pl-3">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border-l-0 border-none bg-border-dark text-base font-normal leading-normal text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-0 h-full px-3"
                    placeholder="Search by ID, or paste an address…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </label>
            </div>
            {/* T092: Date range */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 rounded-lg bg-border-dark px-3 text-sm text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-0"
              aria-label="Date from"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 rounded-lg bg-border-dark px-3 text-sm text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-0"
              aria-label="Date to"
            />
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-border-dark text-text-dark-secondary hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        {/* T092: Date range validation error */}
        {dateRangeError ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
            {dateRangeError}
          </div>
        ) : null}

        {/* T093: Active filter badges */}
        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-2 rounded-full bg-border-dark px-3 py-1 text-sm text-text-dark-primary"
              >
                {f.label}
                <button
                  className="text-text-dark-secondary hover:text-text-dark-primary"
                  onClick={f.onClear}
                  aria-label={`Clear ${f.key} filter`}
                >
                  <span className="material-symbols-outlined text-base!">close</span>
                </button>
              </span>
            ))}
            <button
              className="text-sm font-semibold text-text-dark-secondary hover:text-text-dark-primary underline underline-offset-4"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}

        {/* T094: Results count */}
        {!isLoading && !isError ? (
          <div className="text-sm text-text-dark-secondary">
            Showing {resultsCount.from}–{resultsCount.to} ({resultsCount.showing}{' '}
            on this page)
          </div>
        ) : null}

        {/* T116: Pagination controls */}
        {!isLoading && !isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-dark p-3">
            <div className="flex items-center gap-2 text-sm text-text-dark-secondary">
              <span>Rows per page</span>
              <select
                className="h-9 rounded-lg bg-border-dark px-3 text-sm text-text-dark-primary focus:outline-0 focus:ring-0"
                value={pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setPageSize(next)
                  setPageIndex(0)
                }}
                aria-label="Rows per page"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="ml-2">
                Page {pageIndex + 1}
                {canNextPage ? '+' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold transition-colors ${
                  canPrevPage
                    ? 'bg-border-dark text-text-dark-primary hover:bg-white/10'
                    : 'bg-border-dark text-text-dark-secondary opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canPrevPage && setPageIndex((p) => Math.max(0, p - 1))}
                disabled={!canPrevPage}
                aria-label="Previous page"
              >
                Prev
              </button>
              <button
                className={`flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold transition-colors ${
                  canNextPage
                    ? 'bg-border-dark text-text-dark-primary hover:bg-white/10'
                    : 'bg-border-dark text-text-dark-secondary opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canNextPage && setPageIndex((p) => p + 1)}
                disabled={!canNextPage}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {/* Error State - Execute Transaction Failed */}
        {isExecuteError && executeError && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <span className="material-symbols-outlined text-red-500 text-3xl">
                  error
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-red-500 font-bold text-lg mb-2">
                  Execution Failed
                </h3>
                <p className="text-text-dark-primary text-sm mb-2">
                  The operation execution transaction failed. This could be due to:
                </p>
                <ul className="text-text-dark-secondary text-sm list-disc list-inside mb-4 space-y-1">
                  <li>Insufficient permissions (missing EXECUTOR_ROLE)</li>
                  <li>Operation not yet ready (ETA not reached)</li>
                  <li>Network congestion or gas issues</li>
                  <li>Contract state changed since operation was scheduled</li>
                </ul>
                <details className="text-text-dark-secondary text-xs font-mono bg-background-dark p-3 rounded">
                  <summary className="cursor-pointer font-bold mb-2">Error Details</summary>
                  <pre className="whitespace-pre-wrap wrap-break-word">
                    {formatTxError(executeError)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Success State - Execute Transaction Succeeded */}
        {isExecuteSuccess && executeTxHash && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <span className="material-symbols-outlined text-green-500 text-3xl">
                  check_circle
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-green-500 font-bold text-lg mb-2">
                  Execution Successful!
                </h3>
                <p className="text-text-dark-primary text-sm mb-4">
                  The operation has been executed successfully. The transaction has been confirmed on the blockchain.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`https://explorer.testnet.rsk.co/tx/${executeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-green-500/20 text-green-500 text-sm font-medium hover:bg-green-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      open_in_new
                    </span>
                    View Transaction
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State - Subgraph Unavailable */}
        {isError && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <span className="material-symbols-outlined text-yellow-500 text-3xl">
                  warning
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-yellow-500 font-bold text-lg mb-2">
                  Subgraph Unavailable
                </h3>
                <p className="text-text-dark-primary text-sm mb-4">
                  The Graph subgraph is currently unavailable. This may be due to network issues,
                  subgraph indexing delays, or maintenance.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => refetch()}
                    className="flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-yellow-500/20 text-yellow-500 text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      refresh
                    </span>
                    Try Again
                  </button>
                  <a
                    href="https://thegraph.com/studio/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-border-dark text-text-dark-secondary text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      open_in_new
                    </span>
                    The Graph Studio
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-lg bg-surface-dark p-6">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-28" />
            </div>
            <div className="mt-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`op-skel-${i}`}
                  className="min-w-[1024px] border-b border-border-dark px-6 py-4"
                >
                  <div className="grid grid-cols-7 items-center gap-6">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-10 justify-self-center" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && clientFilteredOperations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-text-dark-primary text-lg font-medium">No operations found</p>
            <p className="text-text-dark-secondary text-sm mt-2">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'No operations have been scheduled yet'}
            </p>
          </div>
        )}

        {/* Operations Table */}
        {!isLoading && !isError && clientFilteredOperations.length > 0 && (
          <VirtualizedOperationsList
            operations={clientFilteredOperations}
            expandedRowId={expandedRowId}
            onRowClick={handleRowClick}
            onExecute={handleExecute}
            onCancel={handleCancel}
            hasExecutorRole={hasExecutorRole}
            isCheckingExecutorRole={isCheckingExecutorRole}
            isExecuting={isExecuting}
            isExecuteSuccess={isExecuteSuccess}
            isExecuteError={isExecuteError}
            hasCancellerRole={hasCancellerRole}
            isCheckingCancellerRole={isCheckingCancellerRole}
            isCancelling={isCancelling}
            isCancelSuccess={isCancelSuccess}
            isCancelError={isCancelError}
            activeCancelOperationId={activeCancelOperationId}
            getStatusColor={getStatusColor}
            getStatusTextColor={getStatusTextColor}
            formatTargets={formatTargets}
            formatAbsoluteTime={formatAbsoluteTime}
          />
        )}
      </main>
    </>
  )
}

function VirtualizedOperationsList(props: {
  operations: Operation[]
  expandedRowId: string | null
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
  activeCancelOperationId: `0x${string}` | null
  getStatusColor: (status: string) => string
  getStatusTextColor: (status: string) => string
  formatTargets: (targets: string[]) => string
  formatAbsoluteTime: (timestamp: bigint) => string
}) {
  const parentRef = React.useRef<HTMLDivElement | null>(null)
  const shouldVirtualize = process.env.NODE_ENV !== 'test'

  const rowVirtualizer = useVirtualizer({
    count: props.operations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div className="w-full overflow-x-auto rounded-lg bg-surface-dark">
      <div role="table" aria-label="Timelock operations" className="w-full">
        {/* Header */}
        <div
          role="rowgroup"
          className="min-w-[1024px] border-b border-border-dark text-xs uppercase text-text-dark-secondary"
        >
          <div role="row" className="grid grid-cols-7 px-6 py-4">
            <div role="columnheader" className="flex items-center gap-1">
              ID <span className="material-symbols-outlined text-base!">swap_vert</span>
            </div>
            <div role="columnheader" className="flex items-center gap-1">
              Status{' '}
              <span className="material-symbols-outlined text-base!">swap_vert</span>
            </div>
            <div role="columnheader" className="text-center">
              Calls
            </div>
            <div role="columnheader">Targets</div>
            <div role="columnheader" className="flex items-center gap-1">
              ETA <span className="material-symbols-outlined text-base!">swap_vert</span>
            </div>
            <div role="columnheader" className="flex items-center gap-1">
              Proposer{' '}
              <span className="material-symbols-outlined text-base!">swap_vert</span>
            </div>
            <div role="columnheader" className="text-right">
              Actions
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          ref={parentRef}
          className="max-h-[70vh] overflow-auto"
          role="rowgroup"
        >
          {shouldVirtualize ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const operation = props.operations[virtualRow.index]
                return (
                  <div
                    key={operation.fullId}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <OperationRow
                      operation={operation}
                      isExpanded={props.expandedRowId === operation.id}
                      onRowClick={props.onRowClick}
                      onExecute={props.onExecute}
                      onCancel={props.onCancel}
                      hasExecutorRole={props.hasExecutorRole}
                      isCheckingExecutorRole={props.isCheckingExecutorRole}
                      isExecuting={props.isExecuting}
                      isExecuteSuccess={props.isExecuteSuccess}
                      isExecuteError={props.isExecuteError}
                      hasCancellerRole={props.hasCancellerRole}
                      isCheckingCancellerRole={props.isCheckingCancellerRole}
                      isCancelling={
                        props.isCancelling &&
                        props.activeCancelOperationId !== null &&
                        props.activeCancelOperationId === operation.fullId
                      }
                      isCancelSuccess={
                        props.isCancelSuccess &&
                        props.activeCancelOperationId !== null &&
                        props.activeCancelOperationId === operation.fullId
                      }
                      isCancelError={
                        props.isCancelError &&
                        props.activeCancelOperationId !== null &&
                        props.activeCancelOperationId === operation.fullId
                      }
                      getStatusColor={props.getStatusColor}
                      getStatusTextColor={props.getStatusTextColor}
                      formatTargets={props.formatTargets}
                      formatAbsoluteTime={props.formatAbsoluteTime}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="w-full">
              {props.operations.map((operation) => (
                <OperationRow
                  key={operation.fullId}
                  operation={operation}
                  isExpanded={props.expandedRowId === operation.id}
                  onRowClick={props.onRowClick}
                  onExecute={props.onExecute}
                  onCancel={props.onCancel}
                  hasExecutorRole={props.hasExecutorRole}
                  isCheckingExecutorRole={props.isCheckingExecutorRole}
                  isExecuting={props.isExecuting}
                  isExecuteSuccess={props.isExecuteSuccess}
                  isExecuteError={props.isExecuteError}
                  hasCancellerRole={props.hasCancellerRole}
                  isCheckingCancellerRole={props.isCheckingCancellerRole}
                  isCancelling={
                    props.isCancelling &&
                    props.activeCancelOperationId !== null &&
                    props.activeCancelOperationId === operation.fullId
                  }
                  isCancelSuccess={
                    props.isCancelSuccess &&
                    props.activeCancelOperationId !== null &&
                    props.activeCancelOperationId === operation.fullId
                  }
                  isCancelError={
                    props.isCancelError &&
                    props.activeCancelOperationId !== null &&
                    props.activeCancelOperationId === operation.fullId
                  }
                  getStatusColor={props.getStatusColor}
                  getStatusTextColor={props.getStatusTextColor}
                  formatTargets={props.formatTargets}
                  formatAbsoluteTime={props.formatAbsoluteTime}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OperationsExplorerView
