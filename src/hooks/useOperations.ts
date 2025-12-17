/**
 * useOperations Hook
 * 
 * Fetches operations from The Graph subgraph with optional filters for:
 * - Status (PENDING, READY, EXECUTED, CANCELLED)
 * - Proposer address
 * - Target contract address
 * - Date range (scheduledAt)
 * 
 * Features:
 * - TanStack Query integration for caching and refetching
 * - Automatic refetch on new blocks
 * - Type-safe filters and responses
 * - Pagination support
 * 
 * Based on: tasks.md T030, data-model.md Operation entity, research.md Section 1
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useChainId, useBlockNumber } from 'wagmi'
import { type Address } from 'viem'
import {
  fetchOperations,
  fetchOperationById,
  getOperationsSummary,
  type OperationFilters,
} from '@/services/subgraph/operations'
import { type ChainId, type PaginationParams } from '@/services/subgraph/client'
import { type Operation, type OperationStatus } from '@/types/operation'
import { useEffect } from 'react'
import { useNetworkConfig } from './useNetworkConfig'

/**
 * Hook options for useOperations
 */
export interface UseOperationsOptions {
  /** Enable/disable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 30 seconds) */
  staleTime?: number
  /** Refetch interval in milliseconds (default: 30 seconds) */
  refetchInterval?: number
  /** Pagination parameters */
  pagination?: PaginationParams
}

/**
 * Fetch operations with filters from The Graph subgraph
 * 
 * @param filters - Operation filters (status, proposer, target, date range)
 * @param options - Query options (enabled, staleTime, pagination)
 * @returns Query result with operations array
 * 
 * @example
 * ```tsx
 * // Fetch all pending operations for a timelock
 * const { data: operations, isLoading } = useOperations({
 *   timelockController: '0x123...',
 *   status: 'PENDING'
 * });
 * 
 * // Fetch operations by proposer with pagination
 * const { data: operations } = useOperations(
 *   { proposer: '0xabc...' },
 *   { pagination: { first: 50, skip: 0 } }
 * );
 * ```
 */
export function useOperations(
  filters: OperationFilters = {},
  options: UseOperationsOptions = {}
) {
  const chainId = useChainId() as ChainId
  const { subgraphUrl } = useNetworkConfig()
  const queryClient = useQueryClient()
  const { data: blockNumber } = useBlockNumber({ watch: true })

  const {
    enabled = true,
    staleTime = 30_000, // 30 seconds
    refetchInterval = 30_000,
    pagination = {},
  } = options

  // T011: Use dynamic subgraphUrl from context in query key for proper cache invalidation
  const queryKey = ['operations', subgraphUrl ?? chainId, filters, pagination]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // T011: Pass subgraphUrl to fetch function when available, otherwise use chainId
      const urlOrChainId = subgraphUrl ?? chainId
      return await fetchOperations(filters, pagination, urlOrChainId as ChainId | string)
    },
    enabled: enabled && (!!subgraphUrl || !!chainId),
    staleTime,
    refetchInterval,
    retry: 2,
  })

  // Invalidate query when new block is mined (for status transitions)
  useEffect(() => {
    if (blockNumber) {
      queryClient.invalidateQueries({ queryKey: ['operations', subgraphUrl ?? chainId] })
    }
  }, [blockNumber, chainId, subgraphUrl, queryClient])

  return query
}

/**
 * Fetch a single operation by ID
 * 
 * @param operationId - Operation ID (bytes32 hash)
 * @param options - Query options
 * @returns Query result with single operation or null
 * 
 * @example
 * ```tsx
 * const { data: operation } = useOperation('0x123...');
 * 
 * if (operation) {
 *   console.log(`Status: ${operation.status}`);
 *   console.log(`Calls: ${operation.calls?.length}`);
 * }
 * ```
 */
export function useOperation(
  operationId: `0x${string}` | undefined,
  options: UseOperationsOptions = {}
) {
  const chainId = useChainId() as ChainId
  const { subgraphUrl } = useNetworkConfig()
  const {
    enabled = true,
    staleTime = 30_000,
    refetchInterval = 30_000,
  } = options

  return useQuery({
    queryKey: ['operation', subgraphUrl ?? chainId, operationId],
    queryFn: async () => {
      if (!operationId) return null
      const urlOrChainId = subgraphUrl ?? chainId
      return await fetchOperationById(operationId, urlOrChainId as ChainId | string)
    },
    enabled: enabled && (!!subgraphUrl || !!chainId) && !!operationId,
    staleTime,
    refetchInterval,
    retry: 2,
  })
}

/**
 * Fetch operations summary (counts by status) for dashboard
 * 
 * @param timelockController - TimelockController contract address
 * @param options - Query options
 * @returns Query result with operation counts
 * 
 * @example
 * ```tsx
 * const { data: summary } = useOperationsSummary('0x123...');
 * 
 * if (summary) {
 *   return (
 *     <div>
 *       <p>Pending: {summary.pending}</p>
 *       <p>Ready: {summary.ready}</p>
 *       <p>Executed: {summary.executed}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOperationsSummary(
  timelockController: Address | undefined,
  options: UseOperationsOptions = {}
) {
  const chainId = useChainId() as ChainId
  const { subgraphUrl } = useNetworkConfig()
  const {
    enabled = true,
    staleTime = 60_000, // 1 minute (summary changes less frequently)
    refetchInterval = 60_000,
  } = options

  return useQuery({
    queryKey: ['operations-summary', subgraphUrl ?? chainId, timelockController],
    queryFn: async () => {
      if (!timelockController) return null
      const urlOrChainId = subgraphUrl ?? chainId
      return await getOperationsSummary(timelockController, urlOrChainId as ChainId | string)
    },
    enabled: enabled && (!!subgraphUrl || !!chainId) && !!timelockController,
    staleTime,
    refetchInterval,
    retry: 2,
  })
}

/**
 * Filter operations client-side by status
 * Useful when you already have operations and want to filter without re-fetching
 * 
 * @param operations - Array of operations
 * @param status - Status to filter by
 * @returns Filtered operations array
 */
export function filterOperationsByStatus(
  operations: Operation[] | undefined,
  status: OperationStatus
): Operation[] {
  if (!operations) return []
  return operations.filter((op) => op.status === status)
}

/**
 * Group operations by status
 * Useful for dashboard views showing operations in different states
 * 
 * @param operations - Array of operations
 * @returns Operations grouped by status
 */
export function groupOperationsByStatus(operations: Operation[] | undefined): {
  pending: Operation[]
  ready: Operation[]
  executed: Operation[]
  cancelled: Operation[]
} {
  const pending: Operation[] = []
  const ready: Operation[] = []
  const executed: Operation[] = []
  const cancelled: Operation[] = []

  if (!operations) {
    return { pending, ready, executed, cancelled }
  }

  for (const operation of operations) {
    switch (operation.status) {
      case 'PENDING':
        pending.push(operation)
        break
      case 'READY':
        ready.push(operation)
        break
      case 'EXECUTED':
        executed.push(operation)
        break
      case 'CANCELLED':
        cancelled.push(operation)
        break
    }
  }

  return { pending, ready, executed, cancelled }
}

/**
 * Get latest operations (by scheduledAt)
 * 
 * @param operations - Array of operations
 * @param count - Number of operations to return
 * @returns Latest operations
 */
export function getLatestOperations(
  operations: Operation[] | undefined,
  count: number = 5
): Operation[] {
  if (!operations) return []
  
  return [...operations]
    .sort((a, b) => Number(b.scheduledAt - a.scheduledAt))
    .slice(0, count)
}

