/**
 * useTimelockWrite Hook
 * Provides mutations for executing, canceling, and scheduling timelock operations
 * Based on User Story 2: Execute Ready Timelock Operations
 * Based on User Story 4: Schedule New Timelock Operations
 * Implements FR-042: Execute button integration with mutation
 * Implements T058: Schedule mutation (schedule/scheduleBatch)
 * Implements T059: PROPOSER_ROLE pre-flight permission check
 */

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { TIMELOCK_ROLES, CACHE_TTL } from '@/lib/constants'
import { useHasRole } from '@/hooks/useHasRole'
import { type Address } from 'viem'

export interface UseTimelockWriteParams {
  /**
   * TimelockController contract address
   */
  timelockController: Address

  /**
   * Connected wallet address (required for permission checks)
   * If undefined, execute operations will be blocked
   */
  account?: Address
}

export interface ExecuteOperationParams {
  /**
   * Target contract address (for single call)
   */
  target: Address

  /**
   * Value to send in wei (for single call)
   */
  value: bigint

  /**
   * Encoded calldata (for single call)
   */
  data: `0x${string}`

  /**
   * Predecessor operation ID (0x0 if none)
   */
  predecessor: `0x${string}`

  /**
   * Salt for operation uniqueness
   */
  salt: `0x${string}`
}

export interface ExecuteBatchParams {
  /**
   * Array of target contract addresses
   */
  targets: Address[]

  /**
   * Array of values to send in wei
   */
  values: bigint[]

  /**
   * Array of encoded calldata
   */
  payloads: `0x${string}`[]

  /**
   * Predecessor operation ID (0x0 if none)
   */
  predecessor: `0x${string}`

  /**
   * Salt for operation uniqueness
   */
  salt: `0x${string}`
}

export interface ScheduleOperationParams {
  /**
   * Target contract address (for single call)
   */
  target: Address

  /**
   * Value to send in wei (for single call)
   */
  value: bigint

  /**
   * Encoded calldata (for single call)
   */
  data: `0x${string}`

  /**
   * Predecessor operation ID (0x0 if none)
   */
  predecessor: `0x${string}`

  /**
   * Salt for operation uniqueness
   */
  salt: `0x${string}`

  /**
   * Delay in seconds before operation becomes executable
   */
  delay: bigint
}

export interface ScheduleBatchParams {
  /**
   * Array of target contract addresses
   */
  targets: Address[]

  /**
   * Array of values to send in wei
   */
  values: bigint[]

  /**
   * Array of encoded calldata
   */
  payloads: `0x${string}`[]

  /**
   * Predecessor operation ID (0x0 if none)
   */
  predecessor: `0x${string}`

  /**
   * Salt for operation uniqueness
   */
  salt: `0x${string}`

  /**
   * Delay in seconds before operation becomes executable
   */
  delay: bigint
}

export interface UseTimelockWriteResult {
  /**
   * Execute a ready operation (single or batch)
   * Automatically detects batch operations based on params
   * Blocked if account lacks EXECUTOR_ROLE
   */
  execute: (params: ExecuteOperationParams | ExecuteBatchParams) => void

  /**
   * Schedule a new operation (single or batch)
   * Automatically detects batch operations based on params
   * Blocked if account lacks PROPOSER_ROLE
   */
  schedule: (params: ScheduleOperationParams | ScheduleBatchParams) => void

  /**
   * Cancel a pending operation by ID (bytes32)
   * Blocked if account lacks CANCELLER_ROLE
   */
  cancel: (id: `0x${string}`) => void

  /**
   * Transaction hash if execution/scheduling was submitted
   */
  txHash: `0x${string}` | undefined

  /**
   * Transaction hash for cancel()
   */
  cancelTxHash: `0x${string}` | undefined

  /**
   * Whether the transaction is pending
   */
  isPending: boolean

  /**
   * Whether the cancel transaction is pending
   */
  isCancelPending: boolean

  /**
   * Whether the transaction was successful
   */
  isSuccess: boolean

  /**
   * Whether the cancel transaction was successful
   */
  isCancelSuccess: boolean

  /**
   * Whether the transaction failed
   */
  isError: boolean

  /**
   * Whether the cancel transaction failed
   */
  isCancelError: boolean

  /**
   * Error if transaction failed
   */
  error: Error | null

  /**
   * Error if cancel transaction failed
   */
  cancelError: Error | null

  /**
   * Whether the connected account has EXECUTOR_ROLE
   * Used for UI to enable/disable execute button
   */
  hasExecutorRole: boolean

  /**
   * Whether the connected account has PROPOSER_ROLE
   * Used for UI to enable/disable schedule button
   */
  hasProposerRole: boolean

  /**
   * Whether the connected account has CANCELLER_ROLE
   * Used for UI to enable/disable cancel button
   */
  hasCancellerRole: boolean

  /**
   * Whether the role check is loading
   */
  isCheckingRole: boolean

  /**
   * Minimum delay in seconds required by the contract
   * Used for delay validation before scheduling operations (T060)
   */
  minDelay: bigint | undefined

  /**
   * Reset the mutation state
   */
  reset: () => void

  /**
   * Reset the cancel mutation state
   */
  resetCancel: () => void
}

/**
 * Type guard to check if params are for batch execution
 */
function isBatchParams(
  params: ExecuteOperationParams | ExecuteBatchParams
): params is ExecuteBatchParams {
  return 'targets' in params && Array.isArray(params.targets)
}

/**
 * Type guard to check if params are for batch scheduling
 */
function isBatchScheduleParams(
  params: ScheduleOperationParams | ScheduleBatchParams
): params is ScheduleBatchParams {
  return 'targets' in params && Array.isArray(params.targets)
}

/**
 * Hook to execute, cancel, and schedule timelock operations
 *
 * Features:
 * - Automatic detection of single vs batch operations (execute & schedule)
 * - Transaction state management (pending/success/error)
 * - Type-safe with viem and wagmi
 * - Pre-flight permission checks using EXECUTOR_ROLE (execute) and PROPOSER_ROLE (schedule)
 *
 * @example
 * ```tsx
 * const {
 *   execute,
 *   schedule,
 *   isPending,
 *   isSuccess,
 *   hasExecutorRole,
 *   hasProposerRole,
 * } = useTimelockWrite({
 *   timelockController: '0x123...',
 *   account: address, // from useAccount
 * })
 *
 * const handleExecute = () => {
 *   // execute() will only proceed if hasExecutorRole is true
 *   execute({
 *     target: '0xTarget...',
 *     value: 0n,
 *     data: '0x...',
 *     predecessor: '0x0000...',
 *     salt: '0xsalt...',
 *   })
 * }
 *
 * const handleSchedule = () => {
 *   // schedule() will only proceed if hasProposerRole is true
 *   schedule({
 *     target: '0xTarget...',
 *     value: 0n,
 *     data: '0x...',
 *     predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000',
 *     salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
 *     delay: 172800n, // 2 days in seconds
 *   })
 * }
 *
 * <button onClick={handleExecute} disabled={isPending || !hasExecutorRole}>
 *   {isPending ? 'Executing...' : 'Execute'}
 * </button>
 *
 * <button onClick={handleSchedule} disabled={isPending || !hasProposerRole}>
 *   {isPending ? 'Scheduling...' : 'Schedule Operation'}
 * </button>
 * ```
 */
export function useTimelockWrite({
  timelockController,
  account,
}: UseTimelockWriteParams): UseTimelockWriteResult {
  // Check if account has EXECUTOR_ROLE for pre-flight permission check
  const {
    hasRole: hasExecutorRole,
    isLoading: isCheckingExecutorRole,
  } = useHasRole({
    timelockController,
    role: TIMELOCK_ROLES.EXECUTOR_ROLE,
    account,
  })

  // Check if account has PROPOSER_ROLE for schedule operations (T059)
  const {
    hasRole: hasProposerRole,
    isLoading: isCheckingProposerRole,
  } = useHasRole({
    timelockController,
    role: TIMELOCK_ROLES.PROPOSER_ROLE,
    account,
  })

  // Check if account has CANCELLER_ROLE for cancel operations (T080)
  const {
    hasRole: hasCancellerRole,
    isLoading: isCheckingCancellerRole,
  } = useHasRole({
    timelockController,
    role: TIMELOCK_ROLES.CANCELLER_ROLE,
    account,
  })

  // Fetch minimum delay for delay validation (T060)
  const { data: minDelay } = useReadContract({
    address: timelockController,
    abi: TimelockControllerABI,
    functionName: 'getMinDelay',
    query: {
      staleTime: CACHE_TTL.ROLE, // 5 minutes cache
      enabled: !!timelockController,
    },
  })

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    isSuccess: isWriteSuccess,
    isError: isWriteError,
    error: writeError,
    reset,
  } = useWriteContract()

  // Separate writer for cancel() so cancel state doesn't collide with execute/schedule state (T084)
  const {
    writeContract: writeCancel,
    data: cancelTxHash,
    isPending: isCancelWritePending,
    isSuccess: isCancelWriteSuccess,
    isError: isCancelWriteError,
    error: cancelWriteError,
    reset: resetCancel,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const {
    isLoading: isCancelConfirming,
    isSuccess: isCancelConfirmed,
  } = useWaitForTransactionReceipt({
    hash: cancelTxHash,
  })

  /**
   * Execute a ready operation
   * Automatically detects single vs batch based on parameters
   * Pre-flight check: blocks execution if account lacks EXECUTOR_ROLE
   */
  const execute = (params: ExecuteOperationParams | ExecuteBatchParams) => {
    // Pre-flight permission check (FR-040)
    if (!hasExecutorRole) {
      console.warn('Execute blocked: Account lacks EXECUTOR_ROLE')
      return
    }
    if (isBatchParams(params)) {
      // Execute batch operation
      writeContract({
        address: timelockController,
        abi: TimelockControllerABI,
        functionName: 'executeBatch',
        args: [
          params.targets,
          params.values,
          params.payloads,
          params.predecessor,
          params.salt,
        ],
      })
    } else {
      // Execute single operation
      writeContract({
        address: timelockController,
        abi: TimelockControllerABI,
        functionName: 'execute',
        args: [
          params.target,
          params.value,
          params.data,
          params.predecessor,
          params.salt,
        ],
        value: params.value, // Send value with transaction
      })
    }
  }

  /**
   * Schedule a new operation
   * Automatically detects single vs batch based on parameters
   * Pre-flight check: blocks scheduling if account lacks PROPOSER_ROLE
   * Pre-flight check: blocks scheduling if delay < minDelay (T060)
   */
  const schedule = (params: ScheduleOperationParams | ScheduleBatchParams) => {
    // Pre-flight permission check (T059)
    if (!hasProposerRole) {
      console.warn('Schedule blocked: Account lacks PROPOSER_ROLE')
      return
    }

    // Pre-flight delay validation (T060)
    const userDelay = params.delay
    if (
      minDelay !== undefined &&
      minDelay !== null &&
      typeof minDelay === 'bigint' &&
      userDelay < minDelay
    ) {
      console.error(
        `Schedule blocked: Delay ${userDelay.toString()}s is less than contract minimum ${minDelay.toString()}s`
      )
      return
    }

    if (isBatchScheduleParams(params)) {
      // Schedule batch operation
      writeContract({
        address: timelockController,
        abi: TimelockControllerABI,
        functionName: 'scheduleBatch',
        args: [
          params.targets,
          params.values,
          params.payloads,
          params.predecessor,
          params.salt,
          params.delay,
        ],
      })
    } else {
      // Schedule single operation
      writeContract({
        address: timelockController,
        abi: TimelockControllerABI,
        functionName: 'schedule',
        args: [
          params.target,
          params.value,
          params.data,
          params.predecessor,
          params.salt,
          params.delay,
        ],
      })
    }
  }

  /**
   * Cancel a pending operation
   * Pre-flight check: blocks cancel if account lacks CANCELLER_ROLE (T080)
   */
  const cancel = (id: `0x${string}`) => {
    if (!hasCancellerRole) {
      console.warn('Cancel blocked: Account lacks CANCELLER_ROLE')
      return
    }

    // Basic bytes32 validation (0x + 64 hex chars)
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
      console.error('Cancel blocked: Invalid operation id (expected bytes32)')
      return
    }

    writeCancel({
      address: timelockController,
      abi: TimelockControllerABI,
      functionName: 'cancel',
      args: [id],
    })
  }

  return {
    execute,
    schedule,
    cancel,
    txHash,
    cancelTxHash,
    isPending: isWritePending || isConfirming,
    isCancelPending: isCancelWritePending || isCancelConfirming,
    isSuccess: isWriteSuccess && isConfirmed,
    isCancelSuccess: isCancelWriteSuccess && isCancelConfirmed,
    isError: isWriteError,
    isCancelError: isCancelWriteError,
    error: writeError as Error | null,
    cancelError: cancelWriteError as Error | null,
    hasExecutorRole,
    hasProposerRole,
    hasCancellerRole,
    isCheckingRole:
      isCheckingExecutorRole || isCheckingProposerRole || isCheckingCancellerRole,
    minDelay: typeof minDelay === 'bigint' ? minDelay : undefined,
    reset,
    resetCancel,
  }
}
