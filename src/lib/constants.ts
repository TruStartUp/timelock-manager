/**
 * Application-wide constants
 * Based on spec.md FR-011 and data-model.md
 */

/**
 * TimelockController role hashes (keccak256 of role names)
 * These are immutable and defined in OpenZeppelin's TimelockController
 */
export const TIMELOCK_ROLES = {
  /** DEFAULT_ADMIN_ROLE - can manage all other roles */
  DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000' as const,

  /** PROPOSER_ROLE - can schedule operations */
  PROPOSER_ROLE: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1' as const,

  /** EXECUTOR_ROLE - can execute ready operations */
  EXECUTOR_ROLE: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63' as const,

  /** CANCELLER_ROLE - can cancel pending operations */
  CANCELLER_ROLE: '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b6223913e945f67199f' as const,
} as const

/**
 * Human-readable role names
 */
export const ROLE_NAMES: Record<string, string> = {
  [TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE]: 'Admin',
  [TIMELOCK_ROLES.PROPOSER_ROLE]: 'Proposer',
  [TIMELOCK_ROLES.EXECUTOR_ROLE]: 'Executor',
  [TIMELOCK_ROLES.CANCELLER_ROLE]: 'Canceller',
}

/**
 * Operation status values
 */
export const OPERATION_STATUS = {
  PENDING: 'PENDING',
  READY: 'READY',
  EXECUTED: 'EXECUTED',
  CANCELLED: 'CANCELLED',
} as const

/**
 * Rootstock network chain IDs
 */
export const ROOTSTOCK_CHAINS = {
  MAINNET: 30,
  TESTNET: 31,
} as const

/**
 * Cache TTLs in milliseconds
 */
export const CACHE_TTL = {
  /** ABI cache TTL (24 hours) */
  ABI: 24 * 60 * 60 * 1000,

  /** Role permission cache TTL (5 minutes) */
  ROLE: 5 * 60 * 1000,

  /** Operation status cache TTL (30 seconds) */
  OPERATION_STATUS: 30 * 1000,

  /** Subgraph query cache TTL (30 seconds) */
  SUBGRAPH: 30 * 1000,
} as const

/**
 * API rate limits
 */
export const RATE_LIMITS = {
  /** Blockscout API requests per second */
  BLOCKSCOUT_RPS: 10,

  /** Request interval to stay under Blockscout limit (150ms = ~6.6 RPS) */
  BLOCKSCOUT_REQUEST_INTERVAL: 150,
} as const

/**
 * Validation constraints
 */
export const VALIDATION = {
  /** Minimum delay for operations (enforced by contract) */
  MIN_DELAY_SECONDS: 0, // Contract-specific, will be fetched via getMinDelay()

  /** Maximum number of calls in a batch operation */
  MAX_BATCH_CALLS: 50,
} as const
