/**
 * Operation and Call type definitions for TimelockController
 * Based on data-model.md specification
 */

export type OperationStatus = 'PENDING' | 'READY' | 'EXECUTED' | 'CANCELLED'

/**
 * Represents a scheduled governance action in a TimelockController contract.
 * Can be either a single call (via schedule()) or multiple calls (via scheduleBatch()).
 */
export interface Operation {
  /** Unique operation identifier computed by hashOperation() */
  id: `0x${string}`

  /** Sequential index for sorting (blockNumber * 1000000 + logIndex) */
  index: bigint

  /** TimelockController contract that owns this operation */
  timelockController: `0x${string}`

  /** Single target for schedule(), null for scheduleBatch() */
  target: `0x${string}` | null

  /** Single value in wei for schedule(), null for batch */
  value: bigint | null

  /** Single encoded calldata for schedule(), null for batch */
  data: `0x${string}` | null

  /** Predecessor operation that must execute first (0x0...0 if none) */
  predecessor: `0x${string}`

  /** Salt for operation ID uniqueness */
  salt: `0x${string}`

  /** Delay in seconds before operation becomes executable */
  delay: bigint

  /** Ready timestamp (scheduledAt + delay) */
  timestamp: bigint

  /** Current status */
  status: OperationStatus

  /** When the operation was scheduled (block timestamp) */
  scheduledAt: bigint

  /** Transaction hash that scheduled this operation */
  scheduledTx: `0x${string}`

  /** Proposer who scheduled (must have PROPOSER_ROLE) */
  scheduledBy: `0x${string}`

  /** When executed (null if not executed) */
  executedAt: bigint | null

  /** Transaction hash that executed (null if not executed) */
  executedTx: `0x${string}` | null

  /** Executor who executed (null if not executed) */
  executedBy: `0x${string}` | null

  /** When cancelled (null if not cancelled) */
  cancelledAt: bigint | null

  /** Transaction hash that cancelled (null if not cancelled) */
  cancelledTx: `0x${string}` | null

  /** Canceller who cancelled (null if not cancelled) */
  cancelledBy: `0x${string}` | null

  /**
   * Calls associated with this operation (especially for scheduleBatch()).
   * When present, each call includes the target + calldata needed for decoding.
   */
  calls?: Call[]
}

/**
 * An individual function call within an operation.
 * For single-call operations, data is often stored in the Operation entity.
 * For batch operations, each call is a separate entity.
 */
export interface Call {
  /** Composite key: operationId-index (e.g., 0x123...abc-0) */
  id: string

  /** Parent operation this call belongs to */
  operation: Operation | string

  /** Index within batch (from CallScheduled event) */
  index: number

  /** Target contract to call */
  target: `0x${string}`

  /** Value to send in wei (can be 0) */
  value: bigint

  /** Encoded function calldata */
  data: `0x${string}`

  /** Decoded function signature (if ABI available) */
  signature: string | null
}
