/**
 * useRoles Hook
 * 
 * Fetches roles and role assignments from The Graph subgraph with event-sourcing
 * logic to compute current role members from RoleGranted/RoleRevoked events.
 * 
 * Features:
 * - TanStack Query integration for caching and refetching
 * - Event-sourcing to compute current members from grant/revoke history
 * - Support for all 4 standard roles: PROPOSER, EXECUTOR, CANCELLER, DEFAULT_ADMIN
 * - Role history with grant/revoke events
 * - 5-minute cache TTL for role permission checks
 * 
 * Based on: tasks.md T047, data-model.md Role entity, research.md Section 6
 */

import { useQuery } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { type Address } from 'viem'
import {
  getRolesSummary,
  fetchRoleAssignments,
} from '@/services/subgraph/roles'
import { type ChainId } from '@/services/subgraph/client'
import { type RoleAssignment } from '@/types/role'
import { TIMELOCK_ROLES, ROLE_NAMES, CACHE_TTL } from '@/lib/constants'
import { useNetworkConfig } from './useNetworkConfig'

/**
 * Extended role information with current members
 */
export interface RoleWithMembers {
  /** Role hash (bytes32) */
  roleHash: `0x${string}`
  
  /** Human-readable role name */
  roleName: string
  
  /** Current addresses holding this role (computed via event-sourcing) */
  currentMembers: Address[]
  
  /** Number of current members */
  memberCount: number
}

/**
 * Extended role assignment with blockTimestamp for UI display
 */
export interface RoleAssignmentWithTimestamp extends Omit<RoleAssignment, 'timestamp' | 'txHash'> {
  /** Block timestamp (alias for timestamp) */
  blockTimestamp: bigint
  
  /** Transaction hash (alias for txHash) */
  transactionHash: `0x${string}`
}

/**
 * Hook options for useRoles
 */
export interface UseRolesOptions {
  /** Enable/disable the query */
  enabled?: boolean
  
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number
  
  /** Refetch interval in milliseconds (default: 5 minutes) */
  refetchInterval?: number
}

/**
 * Hook return type
 */
export interface UseRolesResult {
  /** Array of roles with current members */
  roles: RoleWithMembers[] | undefined
  
  /** Complete role history (all grant/revoke events) */
  roleHistory: RoleAssignmentWithTimestamp[] | undefined
  
  /** Loading state */
  isLoading: boolean
  
  /** Error state */
  isError: boolean
  
  /** Error object if query failed */
  error: Error | null
  
  /** Refetch function */
  refetch: () => Promise<void>
}

/**
 * Fetch roles and role assignments from The Graph subgraph
 * 
 * @param options - Hook options (timelockController, enabled, staleTime, etc.)
 * @returns Query result with roles and role history
 * 
 * @example
 * ```tsx
 * // Fetch all roles for a timelock
 * const { roles, roleHistory, isLoading } = useRoles({
 *   timelockController: '0x123...'
 * });
 * 
 * // Get PROPOSER role members
 * const proposerRole = roles?.find(
 *   r => r.roleHash === TIMELOCK_ROLES.PROPOSER_ROLE
 * );
 * console.log(`Proposers: ${proposerRole?.currentMembers.length}`);
 * ```
 */
export function useRoles(
  options: {
    timelockController: Address | undefined
  } & UseRolesOptions = { timelockController: undefined }
): UseRolesResult {
  const chainId = useChainId() as ChainId
  const { subgraphUrl } = useNetworkConfig()
  const {
    timelockController,
    enabled = true,
    staleTime = CACHE_TTL.ROLE, // 5 minutes
    refetchInterval = CACHE_TTL.ROLE,
  } = options

  // T011: Use dynamic subgraphUrl from context
  const urlOrChainId = subgraphUrl ?? chainId

  // Fetch roles summary (includes current members via event-sourcing)
  const rolesQuery = useQuery({
    queryKey: ['roles', subgraphUrl ?? chainId, timelockController],
    queryFn: async () => {
      if (!timelockController) return null
      return await getRolesSummary(timelockController, urlOrChainId as ChainId | string)
    },
    enabled: enabled && (!!subgraphUrl || !!chainId) && !!timelockController,
    staleTime,
    refetchInterval,
    retry: false, // Don't retry - fail fast for tests
  })

  // Fetch role history for all standard roles
  const historyQuery = useQuery({
    queryKey: ['role-history', subgraphUrl ?? chainId, timelockController],
    queryFn: async () => {
      if (!timelockController) return []

      // Fetch history for all 4 standard roles
      const roleHashes: `0x${string}`[] = [
        TIMELOCK_ROLES.PROPOSER_ROLE,
        TIMELOCK_ROLES.EXECUTOR_ROLE,
        TIMELOCK_ROLES.CANCELLER_ROLE,
        TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE,
      ]

      const allHistory: RoleAssignment[] = []

      // Fetch assignments for each role
      for (const roleHash of roleHashes) {
        try {
          const assignments = await fetchRoleAssignments(
            roleHash,
            timelockController,
            { first: 1000 }, // Get up to 1000 events per role
            urlOrChainId as ChainId | string
          )
          allHistory.push(...assignments)
        } catch (error) {
          // Log but continue with other roles - don't fail entire query
          // This allows partial history to be returned
          if (process.env.NODE_ENV !== 'test') {
            console.warn(`Failed to fetch history for role ${roleHash}:`, error)
          }
        }
      }

      // Sort by timestamp descending (most recent first)
      return allHistory.sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1
        if (a.timestamp < b.timestamp) return 1
        return 0
      })
    },
    enabled: enabled && (!!subgraphUrl || !!chainId) && !!timelockController,
    staleTime,
    refetchInterval,
    retry: false, // Don't retry - fail fast for tests
  })

  // Transform roles summary to RoleWithMembers format
  const roles: RoleWithMembers[] | undefined = rolesQuery.data?.map((role) => ({
    roleHash: role.roleHash,
    roleName: role.roleName,
    currentMembers: role.members,
    memberCount: role.memberCount,
  }))

  // Transform role history to include blockTimestamp and transactionHash aliases
  const roleHistory: RoleAssignmentWithTimestamp[] | undefined = historyQuery.data?.map(
    (assignment) => ({
      ...assignment,
      blockTimestamp: assignment.timestamp,
      transactionHash: assignment.txHash,
    })
  )

  // Combine loading and error states
  const isLoading = rolesQuery.isLoading || historyQuery.isLoading
  const isError = rolesQuery.isError || historyQuery.isError
  const error = rolesQuery.error || historyQuery.error || null

  // Combined refetch function
  const refetch = async () => {
    await Promise.all([rolesQuery.refetch(), historyQuery.refetch()])
  }

  return {
    roles,
    roleHistory,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}

