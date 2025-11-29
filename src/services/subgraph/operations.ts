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
  type ChainId,
  type PaginationParams,
  DEFAULT_PAGE_SIZE,
} from './client'
import { type Operation, type Call, type OperationStatus } from '@/types/operation'

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
function buildWhereClause(filters: OperationFilters): string {
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
    conditions.push(`calls_: { target: "${filters.target.toLowerCase()}" }`)
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
  return {
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
 * @param chainId - Network chain ID
 * @returns Array of operations with their calls
 */
export async function fetchOperations(
  filters: OperationFilters = {},
  pagination: PaginationParams = {},
  chainId: ChainId
): Promise<Operation[]> {
  const { first = DEFAULT_PAGE_SIZE, skip = 0 } = pagination
  const whereClause = buildWhereClause(filters)

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

  const response = await executeGraphQLQueryWithRetry<OperationsQueryResponse>(
    query,
    variables,
    chainId
  )

  return response.operations.map(transformOperation)
}

/**
 * Fetch a single operation by ID
 *
 * @param operationId - Operation ID (bytes32 hash)
 * @param chainId - Network chain ID
 * @returns Operation with calls, or null if not found
 */
export async function fetchOperationById(
  operationId: `0x${string}`,
  chainId: ChainId
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
    chainId
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
 * @param chainId - Network chain ID
 * @returns Count of operations by status
 */
export async function getOperationsSummary(
  timelockController: Address,
  chainId: ChainId
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
  }>(query, variables, chainId)

  return {
    pending: response.pending.length,
    ready: response.ready.length,
    executed: response.executed.length,
    cancelled: response.cancelled.length,
    total: response.all.length,
  }
}
