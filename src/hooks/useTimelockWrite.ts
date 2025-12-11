/**
 * useTimelockWrite Hook
 * Provides mutations for executing, canceling, and scheduling timelock operations
 * Based on User Story 2: Execute Ready Timelock Operations
 * Implements FR-042: Execute button integration with mutation
 */

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { TIMELOCK_ROLES } from '@/lib/constants'
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

export interface UseTimelockWriteResult {
  /**
   * Execute a ready operation (single or batch)
   * Automatically detects batch operations based on params
   * Blocked if account lacks EXECUTOR_ROLE
   */
  execute: (params: ExecuteOperationParams | ExecuteBatchParams) => void

  /**
   * Transaction hash if execution was submitted
   */
  txHash: `0x${string}` | undefined

  /**
   * Whether the transaction is pending
   */
  isPending: boolean

  /**
   * Whether the transaction was successful
   */
  isSuccess: boolean

  /**
   * Whether the transaction failed
   */
  isError: boolean

  /**
   * Error if transaction failed
   */
  error: Error | null

  /**
   * Whether the connected account has EXECUTOR_ROLE
   * Used for UI to enable/disable execute button
   */
  hasExecutorRole: boolean

  /**
   * Whether the role check is loading
   */
  isCheckingRole: boolean

  /**
   * Reset the mutation state
   */
  reset: () => void
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
 * Hook to execute, cancel, and schedule timelock operations
 *
 * Features:
 * - Automatic detection of single vs batch operations
 * - Transaction state management (pending/success/error)
 * - Type-safe with viem and wagmi
 * - Pre-flight permission checks using EXECUTOR_ROLE
 *
 * @example
 * ```tsx
 * const { execute, isPending, isSuccess, hasExecutorRole } = useTimelockWrite({
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
 * <button onClick={handleExecute} disabled={isPending || !hasExecutorRole}>
 *   {isPending ? 'Executing...' : 'Execute'}
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
    isLoading: isCheckingRole,
  } = useHasRole({
    timelockController,
    role: TIMELOCK_ROLES.EXECUTOR_ROLE,
    account,
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

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: txHash,
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

  return {
    execute,
    txHash,
    isPending: isWritePending || isConfirming,
    isSuccess: isWriteSuccess && isConfirmed,
    isError: isWriteError,
    error: writeError as Error | null,
    hasExecutorRole,
    isCheckingRole,
    reset,
  }
}
