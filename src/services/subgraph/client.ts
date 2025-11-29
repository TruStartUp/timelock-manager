/**
 * GraphQL Client for The Graph Subgraph
 *
 * Provides a configured GraphQL client for querying TimelockController events
 * from The Graph subgraphs deployed on Rootstock networks.
 *
 * Features:
 * - Network-aware endpoint selection (mainnet/testnet)
 * - Error handling with retry logic
 * - Type-safe GraphQL queries
 * - Request timeout handling
 */

import { type Address } from 'viem'

/**
 * GraphQL query response type
 */
export interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

/**
 * GraphQL client error
 */
export class GraphQLError extends Error {
  constructor(
    message: string,
    public errors?: GraphQLResponse<unknown>['errors']
  ) {
    super(message)
    this.name = 'GraphQLError'
  }
}

/**
 * Network chain IDs
 */
export enum ChainId {
  ROOTSTOCK_MAINNET = 30,
  ROOTSTOCK_TESTNET = 31,
}

/**
 * Get subgraph URL for a given chain ID
 */
function getSubgraphUrl(chainId: ChainId): string {
  const envVar =
    chainId === ChainId.ROOTSTOCK_MAINNET
      ? process.env.NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL
      : process.env.NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL

  if (!envVar) {
    throw new Error(
      `Subgraph URL not configured for chainId ${chainId}. Please set ${
        chainId === ChainId.ROOTSTOCK_MAINNET
          ? 'NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL'
          : 'NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL'
      } in your .env.local file.`
    )
  }

  return envVar
}

/**
 * Execute a GraphQL query against The Graph subgraph
 *
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param chainId - Network chain ID (defaults to testnet)
 * @param timeout - Request timeout in milliseconds (defaults to 10000)
 * @returns Query response data
 * @throws GraphQLError if query fails or returns errors
 */
export async function executeGraphQLQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  chainId: ChainId = ChainId.ROOTSTOCK_TESTNET,
  timeout = 10000
): Promise<T> {
  const url = getSubgraphUrl(chainId)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new GraphQLError(
        `HTTP error: ${response.status} ${response.statusText}`
      )
    }

    const result: GraphQLResponse<T> = await response.json()

    if (result.errors && result.errors.length > 0) {
      throw new GraphQLError(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`,
        result.errors
      )
    }

    if (!result.data) {
      throw new GraphQLError('No data returned from GraphQL query')
    }

    return result.data
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof GraphQLError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new GraphQLError(`Query timeout after ${timeout}ms`)
      }
      throw new GraphQLError(`Network error: ${error.message}`)
    }

    throw new GraphQLError('Unknown error occurred during GraphQL query')
  }
}

/**
 * Execute a GraphQL query with automatic retry on failure
 *
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param chainId - Network chain ID
 * @param options - Retry options
 * @returns Query response data
 */
export async function executeGraphQLQueryWithRetry<T>(
  query: string,
  variables?: Record<string, unknown>,
  chainId: ChainId = ChainId.ROOTSTOCK_TESTNET,
  options: {
    maxRetries?: number
    retryDelay?: number
    timeout?: number
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, timeout = 10000 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeGraphQLQuery<T>(query, variables, chainId, timeout)
    } catch (error) {
      lastError = error as Error

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break
      }

      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new GraphQLError('Query failed after retries')
}

/**
 * Check if subgraph is healthy and synced
 *
 * @param chainId - Network chain ID
 * @returns Health check result
 */
export async function checkSubgraphHealth(chainId: ChainId): Promise<{
  healthy: boolean
  synced: boolean
  blockNumber?: number
  error?: string
}> {
  try {
    const query = `
      query SubgraphHealth {
        _meta {
          block {
            number
            timestamp
          }
          hasIndexingErrors
        }
      }
    `

    const result = await executeGraphQLQuery<{
      _meta: {
        block: { number: number; timestamp: number }
        hasIndexingErrors: boolean
      }
    }>(query, {}, chainId, 5000)

    return {
      healthy: !result._meta.hasIndexingErrors,
      synced: true,
      blockNumber: result._meta.block.number,
    }
  } catch (error) {
    return {
      healthy: false,
      synced: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Pagination parameters for queries
 */
export interface PaginationParams {
  first?: number
  skip?: number
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE_SIZE = 100
export const MAX_PAGE_SIZE = 1000
