/**
 * Operation Queries for The Graph Subgraph
 *
 * Provides GraphQL queries to fetch operations and calls from TimelockController
 * contracts indexed by The Graph subgraph.
 *
 * Features:
 * - Fetch operations with filters (status, proposer, target, date range)
 * - Fetch single operation by ID with call details
 * - Pagination support for large result sets
 * - Type-safe responses matching data-model.md entities
 */

import { type Address } from 'viem'
import {
  executeGraphQLQuery,
  executeGraphQLQueryWithRetry,
  getSubgraphAvailability,
  type ChainId,
  type PaginationParams,
  DEFAULT_PAGE_SIZE,
  GraphQLError,
} from './client'
import { type Operation, type Call, type OperationStatus } from '@/types/operation'
import { fetchOperationsFromBlockscoutEvents } from '@/services/blockscout/events'

/**
 * Filters for querying operations
 */
export interface OperationFilters {
  /** Filter by operation status */
  status?: OperationStatus
  /** Filter by proposer address */
  proposer?: Address
  /** Filter by target address (matches any call in operation) */
  target?: Address
  /** Filter by operations scheduled after this timestamp */
  dateFrom?: bigint
  /** Filter by operations scheduled before this timestamp */
  dateTo?: bigint
  /** Filter by specific TimelockController contract */
  timelockController?: Address
}

/**
 * Response from operations query
 */
interface OperationsQueryResponse {
  operations: Array<{
    id: string
    index: string
    timelockController: string
    target: string | null
    value: string | null
    data: string | null
    predecessor: string
    salt: string
    delay: string
    timestamp: string
    status: OperationStatus
    scheduledAt: string
    scheduledTx: string
    scheduledBy: string
    executedAt: string | null
    executedTx: string | null
    executedBy: string | null
    cancelledAt: string | null
    cancelledTx: string | null
    cancelledBy: string | null
    calls: Array<{
      id: string
      index: number
      target: string
      value: string
      data: string
      signature: string | null
    }>
  }>
}

/**
 * Response from single operation query
 */
interface OperationQueryResponse {
  operation: OperationsQueryResponse['operations'][0] | null
}

/**
 * Build GraphQL where clause from filters
 */
function buildWhereClause(
  filters: OperationFilters,
  opts: { includeCallTargetFilter?: boolean } = {}
): string {
  const { includeCallTargetFilter = true } = opts
  const conditions: string[] = []

  if (filters.status) {
    conditions.push(`status: "${filters.status}"`)
  }

  if (filters.proposer) {
    conditions.push(`scheduledBy: "${filters.proposer.toLowerCase()}"`)
  }

  if (filters.target) {
    // Note: This requires the subgraph to support filtering by call target
    // May need to be implemented via post-filtering if not supported
    if (includeCallTargetFilter) {
      conditions.push(`calls_: { target: "${filters.target.toLowerCase()}" }`)
    }
  }

  if (filters.dateFrom) {
    conditions.push(`scheduledAt_gte: "${filters.dateFrom}"`)
  }

  if (filters.dateTo) {
    conditions.push(`scheduledAt_lte: "${filters.dateTo}"`)
  }

  if (filters.timelockController) {
    conditions.push(`timelockController: "${filters.timelockController.toLowerCase()}"`)
  }

  return conditions.length > 0 ? `where: { ${conditions.join(', ')} }` : ''
}

/**
 * Transform subgraph response to typed Operation
 */
function transformOperation(
  raw: OperationsQueryResponse['operations'][0]
): Operation {
  const base: Operation = {
    id: raw.id as `0x${string}`,
    index: BigInt(raw.index),
    timelockController: raw.timelockController as `0x${string}`,
    target: raw.target as `0x${string}` | null,
    value: raw.value ? BigInt(raw.value) : null,
    data: raw.data as `0x${string}` | null,
    predecessor: raw.predecessor as `0x${string}`,
    salt: raw.salt as `0x${string}`,
    delay: BigInt(raw.delay),
    timestamp: BigInt(raw.timestamp),
    status: raw.status,
    scheduledAt: BigInt(raw.scheduledAt),
    scheduledTx: raw.scheduledTx as `0x${string}`,
    scheduledBy: raw.scheduledBy as `0x${string}`,
    executedAt: raw.executedAt ? BigInt(raw.executedAt) : null,
    executedTx: raw.executedTx as `0x${string}` | null,
    executedBy: raw.executedBy as `0x${string}` | null,
    cancelledAt: raw.cancelledAt ? BigInt(raw.cancelledAt) : null,
    cancelledTx: raw.cancelledTx as `0x${string}` | null,
    cancelledBy: raw.cancelledBy as `0x${string}` | null,
  }

  // Include calls when the subgraph returns them (needed for batch ops + calldata decoding).
  const calls = (raw.calls || []).map((c) => transformCall(c, raw.id))
  return {
    ...base,
    calls,
  }
}

/**
 * Transform subgraph response to typed Call
 */
function transformCall(
  raw: OperationsQueryResponse['operations'][0]['calls'][0],
  operationId: string
): Call {
  return {
    id: raw.id,
    operation: operationId,
    index: raw.index,
    target: raw.target as `0x${string}`,
    value: BigInt(raw.value),
    data: raw.data as `0x${string}`,
    signature: raw.signature,
  }
}

/**
 * Fetch operations with optional filters
 *
 * @param filters - Operation filters
 * @param pagination - Pagination parameters
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Array of operations with their calls
 */
export async function fetchOperations(
  filters: OperationFilters = {},
  pagination: PaginationParams = {},
  chainIdOrSubgraphUrl: ChainId | string
): Promise<Operation[]> {
  const { first = DEFAULT_PAGE_SIZE, skip = 0 } = pagination
  const targetLower = filters.target?.toLowerCase()
  const canFallback = Boolean(filters.timelockController)

  // T107/T108: If the subgraph is unhealthy/unreachable, fall back to Blockscout events.
  // Only use fallback when using chainId (not custom subgraph URL)
  if (canFallback && typeof chainIdOrSubgraphUrl === 'number') {
    const availability = await getSubgraphAvailability(chainIdOrSubgraphUrl, {
      ttlMs: 30_000,
      timeoutMs: 4_000,
    })
    if (!availability.ok) {
      return await fetchOperationsFromBlockscoutEvents({
        chainId: chainIdOrSubgraphUrl,
        timelockController: filters.timelockController!,
        status: filters.status,
        target: filters.target,
        limit: first,
      })
    }
  }

  const runQuery = async (includeCallTargetFilter: boolean) => {
    const whereClause = buildWhereClause(filters, { includeCallTargetFilter })

    const query = `
      query GetOperations($first: Int!, $skip: Int!) {
        operations(
          first: $first
          skip: $skip
          ${whereClause}
          orderBy: scheduledAt
          orderDirection: desc
        ) {
          id
          index
          timelockController
          target
          value
          data
          predecessor
          salt
          delay
          timestamp
          status
          scheduledAt
          scheduledTx
          scheduledBy
          executedAt
          executedTx
          executedBy
          cancelledAt
          cancelledTx
          cancelledBy
          calls {
            id
            index
            target
            value
            data
            signature
          }
        }
      }
    `

    const variables = {
      first,
      skip,
    }

    return await executeGraphQLQueryWithRetry<OperationsQueryResponse>(
      query,
      variables,
      chainIdOrSubgraphUrl
    )
  }

  try {
    const response = await runQuery(true)
    return response.operations.map(transformOperation)
  } catch (err) {
    // T088: Safe fallback if the deployed subgraph doesn't support `calls_` filtering.
    const msg = err instanceof Error ? err.message : String(err)
    const looksLikeCallsFilterUnsupported =
      Boolean(filters.target) &&
      msg.toLowerCase().includes('calls_') &&
      (msg.toLowerCase().includes('unknown') ||
        msg.toLowerCase().includes('argument') ||
        msg.toLowerCase().includes('field'))

    if (looksLikeCallsFilterUnsupported) {
      const response = await runQuery(false)
      const filtered = targetLower
        ? response.operations.filter((op) => {
            const direct = (op.target || '').toLowerCase() === targetLower
            const viaCalls = (op.calls || []).some(
              (c) => (c.target || '').toLowerCase() === targetLower
            )
            return direct || viaCalls
          })
        : response.operations
      return filtered.map(transformOperation)
    }

    // Any other subgraph failure: best-effort Blockscout fallback (requires timelockController filter).
    // Only use fallback when using chainId (not custom subgraph URL)
    if (canFallback && typeof chainIdOrSubgraphUrl === 'number') {
      return await fetchOperationsFromBlockscoutEvents({
        chainId: chainIdOrSubgraphUrl,
        timelockController: filters.timelockController!,
        status: filters.status,
        target: filters.target,
        limit: first,
      })
    }

    if (err instanceof GraphQLError) throw err
    throw err
  }
}

/**
 * Fetch a single operation by ID
 *
 * @param operationId - Operation ID (bytes32 hash)
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Operation with calls, or null if not found
 */
export async function fetchOperationById(
  operationId: `0x${string}`,
  chainIdOrSubgraphUrl: ChainId | string
): Promise<Operation | null> {
  const query = `
    query GetOperation($id: Bytes!) {
      operation(id: $id) {
        id
        index
        timelockController
        target
        value
        data
        predecessor
        salt
        delay
        timestamp
        status
        scheduledAt
        scheduledTx
        scheduledBy
        executedAt
        executedTx
        executedBy
        cancelledAt
        cancelledTx
        cancelledBy
        calls {
          id
          index
          target
          value
          data
          signature
        }
      }
    }
  `

  const variables = {
    id: operationId.toLowerCase(),
  }

  const response = await executeGraphQLQueryWithRetry<OperationQueryResponse>(
    query,
    variables,
    chainIdOrSubgraphUrl
  )

  return response.operation ? transformOperation(response.operation) : null
}

/**
 * Fetch all calls for a specific operation
 *
 * @param operationId - Operation ID
 * @param chainId - Network chain ID
 * @returns Array of calls
 */
export async function fetchOperationCalls(
  operationId: `0x${string}`,
  chainId: ChainId
): Promise<Call[]> {
  const query = `
    query GetOperationCalls($operationId: Bytes!) {
      calls(
        where: { operation: $operationId }
        orderBy: index
        orderDirection: asc
      ) {
        id
        index
        target
        value
        data
        signature
      }
    }
  `

  const variables = {
    operationId: operationId.toLowerCase(),
  }

  const response = await executeGraphQLQueryWithRetry<{
    calls: OperationsQueryResponse['operations'][0]['calls']
  }>(query, variables, chainId)

  return response.calls.map((call) => transformCall(call, operationId))
}

/**
 * Get operation count for a TimelockController
 *
 * @param timelockController - TimelockController contract address
 * @param filters - Optional status filter
 * @param chainId - Network chain ID
 * @returns Count of operations
 */
export async function getOperationCount(
  timelockController: Address,
  filters: Pick<OperationFilters, 'status'> = {},
  chainId: ChainId
): Promise<number> {
  const whereConditions: string[] = [
    `timelockController: "${timelockController.toLowerCase()}"`,
  ]

  if (filters.status) {
    whereConditions.push(`status: "${filters.status}"`)
  }

  const query = `
    query GetOperationCount {
      operations(
        where: { ${whereConditions.join(', ')} }
      ) {
        id
      }
    }
  `

  const response = await executeGraphQLQueryWithRetry<OperationsQueryResponse>(
    query,
    {},
    chainId
  )

  return response.operations.length
}

/**
 * Get operations summary counts for dashboard
 *
 * @param timelockController - TimelockController contract address
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Count of operations by status
 */
export async function getOperationsSummary(
  timelockController: Address,
  chainIdOrSubgraphUrl: ChainId | string
): Promise<{
  pending: number
  ready: number
  executed: number
  cancelled: number
  total: number
}> {
  const query = `
    query GetOperationsSummary($timelockController: Bytes!) {
      pending: operations(where: { timelockController: $timelockController, status: "PENDING" }) {
        id
      }
      ready: operations(where: { timelockController: $timelockController, status: "READY" }) {
        id
      }
      executed: operations(where: { timelockController: $timelockController, status: "EXECUTED" }) {
        id
      }
      cancelled: operations(where: { timelockController: $timelockController, status: "CANCELLED" }) {
        id
      }
      all: operations(where: { timelockController: $timelockController }) {
        id
      }
    }
  `

  const variables = {
    timelockController: timelockController.toLowerCase(),
  }

  const response = await executeGraphQLQueryWithRetry<{
    pending: Array<{ id: string }>
    ready: Array<{ id: string }>
    executed: Array<{ id: string }>
    cancelled: Array<{ id: string }>
    all: Array<{ id: string }>
  }>(query, variables, chainIdOrSubgraphUrl)

  return {
    pending: response.pending.length,
    ready: response.ready.length,
    executed: response.executed.length,
    cancelled: response.cancelled.length,
    total: response.all.length,
  }
}
