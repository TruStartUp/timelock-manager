/**
 * useContractABI Hook
 * Fetches contract ABI with priority-based resolution and proxy detection
 * Based on User Story 4: Schedule New Timelock Operations
 * Implements FR-035, FR-036, FR-037: ABI fetching with proxy detection
 */

import { useQuery } from '@tanstack/react-query'
import { usePublicClient, useChainId } from 'wagmi'
import { type Address } from 'viem'
import {
  getContractABI,
  type ABIResolution,
  ABISource,
  ABIConfidence,
} from '@/services/blockscout/abi'
import { CHAIN_TO_NETWORK } from '@/services/blockscout/client'
import { getABIManagerUpdatedAtMs, getCustomABIFromSessionStorage } from '@/hooks/useABIManager'

export interface UseContractABIOptions {
  /**
   * Whether the query is enabled
   * Default: true (enabled when address is provided)
   */
  enabled?: boolean

  /**
   * How long data is considered fresh (in milliseconds)
   * Default: 5 minutes
   */
  staleTime?: number
}

export interface UseContractABIResult {
  /**
   * Contract ABI array (empty if not found)
   */
  abi: unknown[]

  /**
   * Source of the ABI (MANUAL, BLOCKSCOUT, KNOWN_REGISTRY, FOURBYTE)
   */
  source: ABISource

  /**
   * Confidence level (HIGH, MEDIUM, LOW)
   */
  confidence: ABIConfidence

  /**
   * Whether the contract is a proxy
   */
  isProxy: boolean

  /**
   * Implementation address if proxy was detected
   */
  implementationAddress?: Address

  /**
   * Error message if ABI resolution failed
   */
  error?: string

  /**
   * Whether the ABI is currently loading
   */
  isLoading: boolean

  /**
   * Whether an error occurred
   */
  isError: boolean

  /**
   * Refetch the ABI
   */
  refetch: () => void
}

/**
 * Hook to fetch contract ABI with priority-based resolution
 *
 * Resolution Priority:
 * 1. Manual ABI (sessionStorage) → HIGH confidence
 * 2. Session cache (5-minute TTL) → confidence from original source
 * 3. Blockscout verified with proxy resolution → HIGH confidence
 * 4. Known registry (TimelockController, AccessControl, etc.) → HIGH confidence
 * 5. 4byte directory → LOW confidence (future enhancement)
 *
 * Features:
 * - Automatic proxy detection (EIP-1967, EIP-1822, EIP-1167)
 * - TanStack Query caching with configurable staleTime
 * - SSR-safe (checks for window/sessionStorage)
 * - Integrates with wagmi public client and chain ID
 *
 * @example
 * ```tsx
 * const { abi, isLoading, confidence, isProxy } = useContractABI(
 *   '0x123...',
 *   { staleTime: 10 * 60 * 1000 } // 10 minutes
 * )
 *
 * {isLoading && <div>Loading ABI...</div>}
 * {confidence === ABIConfidence.HIGH && <div>Verified contract</div>}
 * {isProxy && <div>Proxy detected</div>}
 * ```
 */
export function useContractABI(
  address: Address | undefined,
  options: UseContractABIOptions = {}
): UseContractABIResult {
  const chainId = useChainId()
  const publicClient = usePublicClient()

  const network = CHAIN_TO_NETWORK[chainId]
  const abiManagerUpdatedAt = typeof window !== 'undefined' ? getABIManagerUpdatedAtMs() : 0

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'contractABI',
      address,
      network,
      Boolean(publicClient),
      abiManagerUpdatedAt,
    ],
    queryFn: async (): Promise<ABIResolution> => {
      if (!address) {
        throw new Error('Address is required')
      }
      if (!network) {
        throw new Error(`Unsupported chain ID: ${chainId}`)
      }
      if (!publicClient) {
        throw new Error('Public client is not available')
      }

      // T103: Prefer custom ABI manager storage before Blockscout lookup.
      const custom = getCustomABIFromSessionStorage(address)
      if (custom?.abi && custom.abi.length > 0) {
        return {
          abi: custom.abi,
          source: ABISource.MANUAL,
          confidence: ABIConfidence.HIGH,
          isProxy: false,
        }
      }
      return getContractABI(address, network, publicClient)
    },
    enabled:
      !!address && !!network && !!publicClient && options.enabled !== false,
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes default
    retry: 1,
  })

  return {
    abi: data?.abi || [],
    source: data?.source || ABISource.BLOCKSCOUT,
    confidence: data?.confidence || ABIConfidence.LOW,
    isProxy: data?.isProxy || false,
    implementationAddress: data?.implementationAddress,
    error: data?.error || (error as Error)?.message,
    isLoading,
    isError,
    refetch,
  }
}
