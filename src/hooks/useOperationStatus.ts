/**
 * useOperationStatus Hook
 * 
 * Provides real-time operation status with countdown timer and contract state checks.
 * Uses TimelockController view functions: getTimestamp, isOperationReady, isOperationDone
 * 
 * Features:
 * - Real-time countdown timer (updates every second)
 * - Contract state validation (getTimestamp, isOperationReady, isOperationDone)
 * - Status calculation: PENDING → READY → EXECUTED | CANCELLED
 * - Automatic cache invalidation on status changes
 * - Client-side timestamp comparison for accuracy
 * 
 * Based on: tasks.md T031, research.md Section 7, data-model.md Operation Status
 */

import { useEffect, useState } from 'react'
import { useReadContracts } from 'wagmi'
import { type Address } from 'viem'
import { type OperationStatus } from '@/types/operation'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { formatSecondsToTime } from '@/lib/status'

const TIMELOCK_CONTROLLER_ABI = TimelockControllerABI as any

// Re-export utility functions from lib/status for consistency
export {
  formatSecondsToTime,
  formatRelativeTime,
  formatTimestampToDate,
  getStatusColor,
  getStatusIcon,
} from '@/lib/status'

// OpenZeppelin uses timestamp=1 for done operations
const _DONE_TIMESTAMP = BigInt(1)

/**
 * Operation status information
 */
export interface OperationStatusInfo {
  /** Current operation status */
  status: OperationStatus
  /** Ready timestamp from contract (0 for UNSET, 1 for DONE) */
  timestamp: bigint
  /** Whether operation is ready to execute (from contract) */
  isReady: boolean
  /** Whether operation is done (from contract) */
  isDone: boolean
  /** Whether operation is pending (from contract) */
  isPending: boolean
  /** Seconds until ready (null if not pending, 0 if ready now) */
  secondsUntilReady: number | null
  /** Human-readable time until ready (e.g., "2d 5h 30m") */
  timeUntilReady: string | null
  /** Whether the query is loading */
  isLoading: boolean
  /** Error if query failed */
  error: Error | null
  /** Refetch function to manually refresh status */
  refetch: () => void
}

/**
 * Hook options for useOperationStatus
 */
export interface UseOperationStatusOptions {
  /** Enable/disable the query */
  enabled?: boolean
  /** Override for cancelled status (from subgraph events) */
  cancelledAt?: bigint | null
  /** Override for executed status (from subgraph events) */
  executedAt?: bigint | null
}

/**
 * Get comprehensive operation status from TimelockController with real-time countdown
 * 
 * @param timelockAddress - TimelockController contract address
 * @param operationId - Operation ID (bytes32 hash)
 * @param options - Hook options
 * @returns Operation status information with countdown timer
 * 
 * @example
 * ```tsx
 * const { status, secondsUntilReady, timeUntilReady, isReady } = useOperationStatus(
 *   '0x123...', // timelock address
 *   '0xabc...'  // operation ID
 * );
 * 
 * if (status === 'PENDING' && timeUntilReady) {
 *   return <p>Ready in: {timeUntilReady}</p>;
 * }
 * 
 * if (isReady) {
 *   return <button>Execute Now</button>;
 * }
 * ```
 */
export function useOperationStatus(
  timelockAddress: Address | undefined,
  operationId: `0x${string}` | undefined,
  options: UseOperationStatusOptions = {}
): OperationStatusInfo {
  const { enabled = true, cancelledAt, executedAt } = options

  // Track current time for countdown (updates every second)
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))

  // Update current time every second for countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Batch fetch all status data from contract
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useReadContracts({
    contracts: timelockAddress && operationId ? [
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'getTimestamp',
        args: [operationId],
      },
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'isOperationReady',
        args: [operationId],
      },
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'isOperationDone',
        args: [operationId],
      },
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'isOperationPending',
        args: [operationId],
      },
    ] : [],
    query: {
      enabled: enabled && !!timelockAddress && !!operationId,
      staleTime: 30_000, // 30 seconds
      refetchInterval: 30_000, // Refetch every 30 seconds to catch transitions
    },
  })

  // Return default values while loading or if disabled
  if (isLoading || !data || !enabled || !timelockAddress || !operationId) {
    return {
      status: 'PENDING',
      timestamp: BigInt(0),
      isReady: false,
      isDone: false,
      isPending: false,
      secondsUntilReady: null,
      timeUntilReady: null,
      isLoading: isLoading,
      error: error as Error | null,
      refetch,
    }
  }

  // Extract contract data
  const timestamp = (data[0]?.result as bigint | undefined) ?? BigInt(0)
  const isReady = (data[1]?.result as boolean | undefined) ?? false
  const isDone = (data[2]?.result as boolean | undefined) ?? false
  const isPending = (data[3]?.result as boolean | undefined) ?? false

  // Determine status from contract state and events
  let status: OperationStatus

  // Check if cancelled (from subgraph events)
  if (cancelledAt !== undefined && cancelledAt !== null) {
    status = 'CANCELLED'
  }
  // Check if executed (from subgraph events or contract state)
  else if (executedAt !== undefined && executedAt !== null) {
    status = 'EXECUTED'
  }
  // Check contract isDone state
  else if (isDone) {
    // Contract shows done, but we don't have event data
    // Assume executed (most common case)
    status = 'EXECUTED'
  }
  // Check if ready to execute
  else if (isReady) {
    status = 'READY'
  }
  // Check if pending
  else if (isPending) {
    status = 'PENDING'
  }
  // Operation doesn't exist yet
  else if (timestamp === BigInt(0)) {
    status = 'PENDING' // Default to pending for unset operations
  }
  // Fallback
  else {
    status = 'PENDING'
  }

  // Calculate seconds until ready (for pending operations)
  let secondsUntilReady: number | null = null
  let timeUntilReady: string | null = null

  if (status === 'PENDING' && timestamp > BigInt(0)) {
    const timestampSeconds = Number(timestamp)
    secondsUntilReady = Math.max(0, timestampSeconds - currentTime)

    // If countdown reached zero but contract not yet updated, mark as ready
    if (secondsUntilReady === 0 && !isReady) {
      status = 'READY'
    }

    // Format time until ready
    if (secondsUntilReady > 0) {
      timeUntilReady = formatSecondsToTime(secondsUntilReady)
    }
  }

  return {
    status,
    timestamp,
    isReady,
    isDone,
    isPending,
    secondsUntilReady,
    timeUntilReady,
    isLoading: false,
    error: null,
    refetch,
  }
}

// Note: Utility functions are now imported and re-exported from @/lib/status above
// This eliminates code duplication while maintaining the same API

