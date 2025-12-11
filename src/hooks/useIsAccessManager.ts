/**
 * useIsAccessManager Hook
 * 
 * Detects if an address implements the IAccessManager interface by attempting
 * to call the canCall function. If the call succeeds with the expected return
 * type (bool, uint32), the address is an AccessManager contract.
 * 
 * Based on: tasks.md T051, spec.md FR-014
 */

import { useReadContract } from 'wagmi'
import { type Address, zeroAddress } from 'viem'
import IAccessManagerABI from '@/lib/abis/IAccessManager.json'

export interface UseIsAccessManagerParams {
  /**
   * Address to check (contract address)
   */
  address: Address | undefined

  /**
   * Whether the query is enabled
   * Default: true if address is defined
   */
  enabled?: boolean
}

export interface UseIsAccessManagerResult {
  /**
   * Whether the address implements IAccessManager
   * Returns false if address is undefined, call fails, or data is not loaded
   */
  isAccessManager: boolean

  /**
   * Whether the check is in progress
   */
  isLoading: boolean

  /**
   * Error if the check failed
   */
  error: Error | null

  /**
   * Refetch the check
   */
  refetch: () => void
}

/**
 * Hook to detect if an address implements IAccessManager interface
 * 
 * Detection strategy:
 * - Attempts to call canCall(address,address,bytes4) with dummy parameters
 * - If call succeeds and returns (bool, uint32), it's an AccessManager
 * - If call fails (reverts or not a contract), returns false
 * 
 * @example
 * ```tsx
 * const { isAccessManager, isLoading } = useIsAccessManager({
 *   address: adminRoleHolder,
 * })
 * 
 * {isAccessManager && (
 *   <a href={`https://blockscout.com/address/${adminRoleHolder}`}>
 *     Managed by AccessManager
 *   </a>
 * )}
 * ```
 */
export function useIsAccessManager({
  address,
  enabled = true,
}: UseIsAccessManagerParams): UseIsAccessManagerResult {
  // Try calling canCall with dummy parameters
  // If it succeeds, the contract implements IAccessManager
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: address ?? zeroAddress,
    abi: IAccessManagerABI,
    functionName: 'canCall',
    args: [
      zeroAddress, // caller
      zeroAddress, // target
      '0x00000000' as `0x${string}`, // selector
    ],
    query: {
      enabled: enabled && !!address, // Only run if address is defined
      retry: false, // Don't retry - if it fails, it's not an AccessManager
    },
  })

  // If data is returned (tuple of [bool, uint32]), it's an AccessManager
  // If error occurs, it's not an AccessManager (or not a contract)
  const isAccessManager = data !== undefined && data !== null && !error

  return {
    isAccessManager,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

