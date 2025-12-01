/**
 * useHasRole Hook
 * Checks if an account has a specific role in a TimelockController
 * Based on User Story 2: Execute Ready Timelock Operations
 * Implements FR-040: Pre-flight permission check before execute
 */

import { useReadContract } from 'wagmi'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { CACHE_TTL } from '@/lib/constants'
import { type Address } from 'viem'

export interface UseHasRoleParams {
  /**
   * TimelockController contract address
   */
  timelockController: Address

  /**
   * Role hash to check (e.g., EXECUTOR_ROLE, PROPOSER_ROLE)
   */
  role: `0x${string}`

  /**
   * Account address to check
   * If undefined, hook will return false
   */
  account: Address | undefined
}

export interface UseHasRoleResult {
  /**
   * Whether the account has the role
   * Returns false if account is undefined or data is not loaded
   */
  hasRole: boolean

  /**
   * Whether the role check is currently loading
   */
  isLoading: boolean

  /**
   * Error if the role check failed
   */
  error: Error | null

  /**
   * Refetch the role check
   */
  refetch: () => void
}

/**
 * Hook to check if an account has a specific role in a TimelockController
 *
 * Features:
 * - 5-minute cache TTL for performance (from research.md Section 6)
 * - Returns false when account is undefined (wallet not connected)
 * - Type-safe with viem and wagmi
 *
 * @example
 * ```tsx
 * const { hasRole, isLoading } = useHasRole({
 *   timelockController: '0x123...',
 *   role: TIMELOCK_ROLES.EXECUTOR_ROLE,
 *   account: address, // from useAccount
 * })
 *
 * <button disabled={!hasRole || isLoading}>
 *   Execute
 * </button>
 * ```
 */
export function useHasRole({
  timelockController,
  role,
  account,
}: UseHasRoleParams): UseHasRoleResult {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: timelockController,
    abi: TimelockControllerABI,
    functionName: 'hasRole',
    args: [role, account ?? '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: !!account, // Only run query if account is defined
      staleTime: CACHE_TTL.ROLE, // 5 minutes cache from constants
      gcTime: CACHE_TTL.ROLE, // Keep in cache for 5 minutes
    },
  })

  return {
    hasRole: data === true, // Explicit boolean check
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
