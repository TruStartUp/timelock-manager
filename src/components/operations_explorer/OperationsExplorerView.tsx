import React, { useState, useMemo, useEffect } from 'react'
import { type Address, formatEther } from 'viem'
import { useAccount, useChainId } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useOperations } from '@/hooks/useOperations'
import { useHasRole } from '@/hooks/useHasRole'
import { useTimelockWrite } from '@/hooks/useTimelockWrite'
import { TIMELOCK_ROLES } from '@/lib/constants'
import { type Operation as SubgraphOperation, type OperationStatus as SubgraphOperationStatus } from '@/types/operation'
import { OperationRow } from './OperationRow'

type OperationStatus = 'All' | 'Pending' | 'Ready' | 'Executed' | 'Canceled'

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

const OperationsExplorerView: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<OperationStatus>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

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

  // Initialize useTimelockWrite for executing operations
  const {
    execute,
    isPending: isExecuting,
    isSuccess: isExecuteSuccess,
    isError: isExecuteError,
    error: executeError,
    txHash: executeTxHash,
  } = useTimelockWrite({
    timelockController: timelockAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
    account: connectedAccount,
  })

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

  // Fetch operations from subgraph with filters
  const { data: subgraphOperations, isLoading, isError, refetch } = useOperations({
    timelockController: timelockAddress,
    status: statusFilter,
  })

  // Automatically refresh operations list after successful execution (T044)
  useEffect(() => {
    if (isExecuteSuccess) {
      // Invalidate all operations queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['operations', chainId] })

      // Also invalidate operations summary for dashboard updates
      queryClient.invalidateQueries({ queryKey: ['operations-summary', chainId] })
    }
  }, [isExecuteSuccess, chainId, queryClient])

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
        target: op.target,
        value: op.value,
        data: op.data,
        predecessor: op.predecessor,
        salt: op.salt,
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
  const filteredOperations = useMemo(() => {
    if (!searchQuery.trim()) return operations

    const query = searchQuery.toLowerCase()
    return operations.filter((op) =>
      op.id.toLowerCase().includes(query) ||
      op.proposer.toLowerCase().includes(query) ||
      op.details?.fullId.toLowerCase().includes(query) ||
      op.details?.fullProposer.toLowerCase().includes(query)
    )
  }, [operations, searchQuery])

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

    // Execute the operation using useTimelockWrite
    execute({
      target: operation.target,
      value: operation.value,
      data: operation.data,
      predecessor: operation.predecessor,
      salt: operation.salt,
    })
  }

  const handleCancel = (id: string) => {
    // TODO: Implement cancel logic with data hooks/services
    console.log('Cancel operation:', id)
  }

  const formatTargets = (targets: string[]) => {
    if (targets.length <= 1) return targets[0] || ''
    return `${targets[0]}, +${targets.length - 1} more`
  }

  return (
    <>
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
          <span className="material-symbols-outlined !text-xl">add</span>
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
            <div className="flex-grow">
              <label className="flex flex-col min-w-40 h-11 w-full">
                <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                  <div className="text-text-dark-secondary flex items-center justify-center rounded-l-lg border-r-0 border-none bg-border-dark pl-3">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border-l-0 border-none bg-border-dark text-base font-normal leading-normal text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-0 h-full px-3"
                    placeholder="Search by ID, proposer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </label>
            </div>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-border-dark text-text-dark-secondary hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        {/* Error State - Execute Transaction Failed */}
        {isExecuteError && executeError && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
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
                  <pre className="whitespace-pre-wrap break-words">{executeError.message}</pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Success State - Execute Transaction Succeeded */}
        {isExecuteSuccess && executeTxHash && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
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
              <div className="flex-shrink-0">
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
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-border-dark border-t-primary"></div>
              <p className="text-text-dark-secondary">Loading operations...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredOperations.length === 0 && (
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
        {!isLoading && !isError && filteredOperations.length > 0 && (
          <div className="w-full overflow-x-auto rounded-lg bg-surface-dark">
            <table className="w-full min-w-[1024px] text-left text-sm">
            <thead className="border-b border-border-dark text-xs uppercase text-text-dark-secondary">
              <tr>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    ID{' '}
                    <span className="material-symbols-outlined !text-base">
                      swap_vert
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    Status{' '}
                    <span className="material-symbols-outlined !text-base">
                      swap_vert
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center" scope="col">
                  Calls
                </th>
                <th className="px-6 py-4" scope="col">
                  Targets
                </th>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    ETA{' '}
                    <span className="material-symbols-outlined !text-base">
                      swap_vert
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    Proposer{' '}
                    <span className="material-symbols-outlined !text-base">
                      swap_vert
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-right" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map((operation) => (
                <OperationRow
                  key={operation.id}
                  operation={operation}
                  isExpanded={expandedRowId === operation.id}
                  onRowClick={handleRowClick}
                  onExecute={handleExecute}
                  onCancel={handleCancel}
                  hasExecutorRole={hasExecutorRole}
                  isCheckingExecutorRole={isCheckingExecutorRole}
                  isExecuting={isExecuting}
                  isExecuteSuccess={isExecuteSuccess}
                  isExecuteError={isExecuteError}
                  getStatusColor={getStatusColor}
                  getStatusTextColor={getStatusTextColor}
                  formatTargets={formatTargets}
                  formatAbsoluteTime={formatAbsoluteTime}
                />
              ))}
            </tbody>
          </table>
        </div>
        )}
      </main>
    </>
  )
}

export default OperationsExplorerView
