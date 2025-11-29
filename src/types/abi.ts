/**
 * ABI-related type definitions and enums
 * Based on data-model.md specification
 */

/**
 * Source of contract ABI
 */
export enum ABISource {
  /** User-provided ABI */
  MANUAL = 'MANUAL',

  /** Fetched from Blockscout verified contract */
  BLOCKSCOUT = 'BLOCKSCOUT',

  /** Pre-configured known contract (e.g., TimelockController, ERC20) */
  KNOWN_REGISTRY = 'KNOWN_REGISTRY',

  /** Looked up from 4byte directory */
  FOURBYTE = 'FOURBYTE',
}

/**
 * Confidence level of ABI accuracy
 */
export enum ABIConfidence {
  /** Manual input, Blockscout verified, or known registry */
  HIGH = 'HIGH',

  /** Blockscout unverified but implementation found */
  MEDIUM = 'MEDIUM',

  /** 4byte directory guess */
  LOW = 'LOW',
}

/**
 * Cached ABI for contract interaction and calldata decoding.
 * Stored in sessionStorage (not blockchain/subgraph).
 */
export interface ContractABI {
  /** Contract address */
  address: `0x${string}`

  /** OpenZeppelin ABI format */
  abi: any[]

  /** Source of this ABI */
  source: ABISource

  /** Confidence level */
  confidence: ABIConfidence

  /** Whether this is a proxy contract */
  isProxy: boolean

  /** Implementation address for proxies */
  implementationAddress: `0x${string}` | null

  /** When ABI was fetched (ISO 8601) */
  fetchedAt: string

  /** Time to live in seconds */
  ttl: number
}

/**
 * ABI cache schema for sessionStorage
 */
export interface ABICache {
  [address: string]: {
    abi: any[]
    source: ABISource
    confidence: ABIConfidence
    isProxy: boolean
    implementationAddress: string | null
    fetchedAt: string
    ttl: number
  }
}
