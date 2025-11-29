/**
 * Role and RoleAssignment type definitions for AccessControl
 * Based on data-model.md specification
 */

/**
 * An AccessControl role in the TimelockController contract.
 * Standard roles are PROPOSER, EXECUTOR, CANCELLER, and DEFAULT_ADMIN.
 */
export interface Role {
  /** Keccak256 hash of role name (bytes32) */
  id: `0x${string}`

  /** Role hash (redundant for convenience) */
  roleHash: `0x${string}`

  /** TimelockController this role belongs to */
  timelockController: `0x${string}`

  /** Admin role that can grant/revoke this role */
  adminRole: Role | string | null

  /** Current number of members (updated on grant/revoke) */
  memberCount: number
}

/**
 * Event-sourced record of role grants and revokes.
 * Each RoleGranted or RoleRevoked event creates an immutable RoleAssignment entity.
 */
export interface RoleAssignment {
  /** Composite: roleHash-account-txHash */
  id: string

  /** Role being granted or revoked */
  role: Role | string

  /** Account receiving or losing the role */
  account: `0x${string}`

  /** true = RoleGranted, false = RoleRevoked */
  granted: boolean

  /** When the event occurred (block timestamp) */
  timestamp: bigint

  /** Block number of the event */
  blockNumber: bigint

  /** Transaction that emitted the event */
  txHash: `0x${string}`

  /** Address that called grantRole/revokeRole */
  sender: `0x${string}`
}

/**
 * Standard TimelockController role hashes
 */
export const TIMELOCK_ROLES = {
  /** DEFAULT_ADMIN_ROLE - can manage all other roles */
  ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000' as const,

  /** PROPOSER_ROLE - can schedule operations */
  PROPOSER: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1' as const,

  /** EXECUTOR_ROLE - can execute ready operations */
  EXECUTOR: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63' as const,

  /** CANCELLER_ROLE - can cancel pending operations */
  CANCELLER: '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b6223913e945f67199f' as const,
} as const

export type TimelockRoleName = keyof typeof TIMELOCK_ROLES
