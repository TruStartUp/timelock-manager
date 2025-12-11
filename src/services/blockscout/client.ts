/**
 * Blockscout API Client
 *
 * Provides a rate-limited client for interacting with Rootstock Blockscout API v2.
 *
 * Features:
 * - IP-based rate limiting (10 RPS, conservative 6.6 RPS implementation)
 * - Request queue for managing concurrent requests
 * - Exponential backoff retry logic
 * - localStorage caching with TTL (24 hours)
 * - Support for both mainnet and testnet
 */

import { type Address } from 'viem'

/**
 * Network types
 */
export type BlockscoutNetwork = 'mainnet' | 'testnet'

/**
 * Chain ID mapping
 */
export const CHAIN_TO_NETWORK: Record<number, BlockscoutNetwork> = {
  30: 'mainnet',
  31: 'testnet',
}

/**
 * Blockscout v2 API base URLs
 */
const BLOCKSCOUT_V2_API_BASE = {
  mainnet: 'https://rootstock.blockscout.com/api/v2',
  testnet: 'https://rootstock-testnet.blockscout.com/api/v2',
} as const

/**
 * Get Blockscout API base URL (v2)
 */
function getBlockscoutApiUrl(network: BlockscoutNetwork): string {
  // Allow environment variable override, but default to v2 API
  const envVar =
    network === 'mainnet'
      ? process.env.NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL
      : process.env.NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL

  return envVar || BLOCKSCOUT_V2_API_BASE[network]
}

/**
 * Blockscout API error
 */
export class BlockscoutError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRateLimited = false
  ) {
    super(message)
    this.name = 'BlockscoutError'
  }
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Cache manager for localStorage
 */
class CacheManager {
  private readonly cachePrefix = 'blockscout_cache_'

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null

    try {
      const item = localStorage.getItem(this.cachePrefix + key)
      if (!item) return null

      const entry: CacheEntry<T> = JSON.parse(item)
      const now = Date.now()

      if (now - entry.timestamp > entry.ttl) {
        this.delete(key)
        return null
      }

      return entry.data
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, ttl: number): void {
    if (typeof window === 'undefined') return

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      }
      localStorage.setItem(this.cachePrefix + key, JSON.stringify(entry))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Delete item from cache
   */
  delete(key: string): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.cachePrefix + key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (typeof window === 'undefined') return

    try {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith(this.cachePrefix)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }
}

/**
 * Blockscout API Client (v2)
 */
export class BlockscoutClient {
  private baseUrl: string
  private network: BlockscoutNetwork
  private requestQueue: Array<() => Promise<void>> = []
  private processing = false
  private lastRequestTime = 0
  private cache = new CacheManager()

  // Rate limiting: 10 RPS max, we use 150ms = ~6.6 RPS (conservative)
  private readonly REQUEST_INTERVAL = 150

  // Cache TTL: 24 hours for contract data
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000

  constructor(network: BlockscoutNetwork) {
    this.network = network
    this.baseUrl = getBlockscoutApiUrl(network)
  }

  /**
   * Execute a rate-limited request
   */
  private async rateLimitedRequest<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Enforce rate limiting
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < this.REQUEST_INTERVAL) {
            await new Promise((r) =>
              setTimeout(r, this.REQUEST_INTERVAL - timeSinceLastRequest)
            )
          }

          const url = `${this.baseUrl}${endpoint}`
          const response = await fetch(url, {
            ...options,
            headers: {
              Accept: 'application/json',
              ...options?.headers,
            },
          })

          this.lastRequestTime = Date.now()

          if (!response.ok) {
            if (response.status === 429) {
              throw new BlockscoutError('Rate limit exceeded', 429, true)
            }
            throw new BlockscoutError(
              `HTTP ${response.status}: ${response.statusText}`,
              response.status
            )
          }

          const data = await response.json()
          resolve(data)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    this.processing = true
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        await request()
      }
    }
    this.processing = false
  }

  /**
   * Execute a request with exponential backoff retry
   */
  private async requestWithRetry<T>(
    endpoint: string,
    maxRetries = 3,
    options?: RequestInit
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.rateLimitedRequest<T>(endpoint, options)
      } catch (error) {
        lastError = error as Error

        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break
        }

        // Check if it's a rate limit error
        const isRateLimited =
          error instanceof BlockscoutError && error.isRateLimited

        if (isRateLimited) {
          // For rate limits, use longer backoff
          const delay = 2000 * Math.pow(2, attempt)
          console.warn(
            `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          // For other errors, use exponential backoff
          const delay = 1000 * Math.pow(2, attempt)
          console.warn(
            `Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new BlockscoutError('Request failed after retries')
  }

  /**
   * Get smart contract information from Blockscout v2 API
   */
  async getContract(address: Address): Promise<{
    isVerified: boolean
    name?: string
    compilerVersion?: string
    optimization?: boolean
    abi?: unknown[]
  }> {
    const cacheKey = `contract_${this.network}_${address.toLowerCase()}`
    const cached = this.cache.get<{
      isVerified: boolean
      name?: string
      compilerVersion?: string
      optimization?: boolean
      abi?: unknown[]
    }>(cacheKey)

    if (cached) {
      return cached
    }

    try {
      // Blockscout v2 endpoint: /api/v2/smart-contracts/{address}
      const data = await this.requestWithRetry<{
        is_verified: boolean
        name?: string
        compiler_version?: string
        optimization_enabled?: boolean
        abi?: unknown[]
      }>(`/smart-contracts/${address}`, 3)

      const result = {
        isVerified: data.is_verified || false,
        name: data.name,
        compilerVersion: data.compiler_version,
        optimization: data.optimization_enabled,
        abi: data.abi,
      }

      this.cache.set(cacheKey, result, this.CACHE_TTL)
      return result
    } catch (error) {
      // If contract not found or error, return unverified
      const result = { isVerified: false }
      this.cache.set(cacheKey, result, this.CACHE_TTL)
      return result
    }
  }

  /**
   * Get contract ABI
   */
  async getContractABI(address: Address): Promise<{
    abi: unknown[]
    verified: boolean
  }> {
    const contract = await this.getContract(address)

    if (!contract.isVerified || !contract.abi) {
      return { abi: [], verified: false }
    }

    return {
      abi: contract.abi,
      verified: true,
    }
  }

  /**
   * Check if contract is verified
   */
  async isVerified(address: Address): Promise<boolean> {
    const contract = await this.getContract(address)
    return contract.isVerified
  }

  /**
   * Clear cache for a specific address or all cache
   */
  clearCache(address?: Address): void {
    if (address) {
      const cacheKey = `contract_${this.network}_${address.toLowerCase()}`
      this.cache.delete(cacheKey)
    } else {
      this.cache.clear()
    }
  }
}

/**
 * Create a Blockscout client for a specific network
 */
export function createBlockscoutClient(
  network: BlockscoutNetwork
): BlockscoutClient {
  return new BlockscoutClient(network)
}

/**
 * Get Blockscout client for a specific chain ID
 */
export function getBlockscoutClientByChainId(
  chainId: number
): BlockscoutClient {
  const network = CHAIN_TO_NETWORK[chainId]
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return createBlockscoutClient(network)
}

/**
 * Blockscout explorer base URLs (for UI links, not API)
 */
const BLOCKSCOUT_EXPLORER_BASE = {
  mainnet: 'https://rootstock.blockscout.com',
  testnet: 'https://rootstock-testnet.blockscout.com',
} as const

/**
 * Get Blockscout explorer URL for a specific chain ID
 * Used for building links to addresses, transactions, etc.
 */
export function getBlockscoutExplorerUrl(chainId: number): string {
  const network = CHAIN_TO_NETWORK[chainId]
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return BLOCKSCOUT_EXPLORER_BASE[network]
}
