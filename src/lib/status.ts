/**
 * Operation status calculation utilities
 * Based on data-model.md status calculation logic
 * 
 * Status transition: PENDING → READY → EXECUTED | CANCELLED
 */

import { type Operation, type OperationStatus } from '@/types/operation'

/**
 * Calculate operation status from operation data and current timestamp
 * 
 * Priority order (checked from top to bottom):
 * 1. EXECUTED - if executedAt is set
 * 2. CANCELLED - if cancelledAt is set
 * 3. READY - if current timestamp >= operation.timestamp
 * 4. PENDING - default
 * 
 * @param operation - Operation entity
 * @param currentTimestamp - Current timestamp in seconds (Unix epoch)
 * @returns Current operation status
 * 
 * @example
 * ```ts
 * const operation = { ... } // Operation from subgraph
 * const now = BigInt(Math.floor(Date.now() / 1000))
 * const status = calculateOperationStatus(operation, now)
 * // Returns: 'PENDING' | 'READY' | 'EXECUTED' | 'CANCELLED'
 * ```
 */
export function calculateOperationStatus(
  operation: Operation,
  currentTimestamp: bigint
): OperationStatus {
  // Check final states first (immutable)
  if (operation.executedAt !== null) {
    return 'EXECUTED'
  }

  if (operation.cancelledAt !== null) {
    return 'CANCELLED'
  }

  // Check time-based states (mutable)
  if (currentTimestamp >= operation.timestamp) {
    return 'READY'
  }

  return 'PENDING'
}

/**
 * Check if operation is in a final state (EXECUTED or CANCELLED)
 * 
 * @param operation - Operation entity
 * @returns True if operation is final
 */
export function isOperationFinal(operation: Operation): boolean {
  return operation.executedAt !== null || operation.cancelledAt !== null
}

/**
 * Check if operation is executable (READY state)
 * 
 * @param operation - Operation entity
 * @param currentTimestamp - Current timestamp in seconds
 * @returns True if operation is ready to execute
 */
export function isOperationExecutable(
  operation: Operation,
  currentTimestamp: bigint
): boolean {
  const status = calculateOperationStatus(operation, currentTimestamp)
  return status === 'READY'
}

/**
 * Get seconds remaining until operation is ready
 * 
 * @param operation - Operation entity
 * @param currentTimestamp - Current timestamp in seconds
 * @returns Seconds remaining (0 if ready or final), null if final state
 */
export function getSecondsUntilReady(
  operation: Operation,
  currentTimestamp: bigint
): number | null {
  // Operation is final, no countdown
  if (isOperationFinal(operation)) {
    return null
  }

  const remaining = operation.timestamp - currentTimestamp

  // Already ready
  if (remaining <= BigInt(0)) {
    return 0
  }

  return Number(remaining)
}

/**
 * Calculate progress percentage (0-100) from scheduled to ready
 * 
 * @param operation - Operation entity
 * @param currentTimestamp - Current timestamp in seconds
 * @returns Progress percentage (0-100)
 */
export function getOperationProgress(
  operation: Operation,
  currentTimestamp: bigint
): number {
  // Final states are 100%
  if (isOperationFinal(operation)) {
    return 100
  }

  const totalDelay = operation.timestamp - operation.scheduledAt
  const elapsed = currentTimestamp - operation.scheduledAt

  // Prevent division by zero for instant operations
  if (totalDelay === BigInt(0)) {
    return 100
  }

  const progress = Number((elapsed * BigInt(100)) / totalDelay)

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, progress))
}

/**
 * Format seconds into human-readable time string
 * 
 * @param seconds - Seconds to format
 * @returns Formatted string (e.g., "2d 5h 30m 15s")
 * 
 * @example
 * ```ts
 * formatSecondsToTime(90) // "1m 30s"
 * formatSecondsToTime(3661) // "1h 1m 1s"
 * formatSecondsToTime(172800) // "2d 0h 0m"
 * ```
 */
export function formatSecondsToTime(seconds: number): string {
  if (seconds <= 0) return 'Ready now'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`)
  if (days === 0) parts.push(`${secs}s`) // Only show seconds if less than a day

  return parts.join(' ')
}

/**
 * Format timestamp to relative time (e.g., "in 2 hours", "3 days ago")
 * 
 * @param timestamp - Unix timestamp in seconds
 * @param currentTime - Current time in seconds (defaults to now)
 * @returns Relative time string
 */
export function formatRelativeTime(
  timestamp: bigint,
  currentTime: number = Math.floor(Date.now() / 1000)
): string {
  const timestampSeconds = Number(timestamp)
  const diffSeconds = timestampSeconds - currentTime

  if (diffSeconds > 0) {
    // Future time
    return `in ${formatSecondsToTime(diffSeconds)}`
  } else {
    // Past time
    return `${formatSecondsToTime(Math.abs(diffSeconds))} ago`
  }
}

/**
 * Format timestamp to human-readable date string
 * 
 * @param timestamp - Unix timestamp in seconds
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatTimestampToDate(
  timestamp: bigint,
  locale: string = 'en-US'
): string {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Get status badge color for UI display
 * 
 * @param status - Operation status
 * @returns Tailwind color class
 */
export function getStatusColor(status: OperationStatus): string {
  switch (status) {
    case 'PENDING':
      return 'yellow'
    case 'READY':
      return 'green'
    case 'EXECUTED':
      return 'blue'
    case 'CANCELLED':
      return 'red'
    default:
      return 'gray'
  }
}

/**
 * Get status icon for UI display
 * 
 * @param status - Operation status
 * @returns Icon character
 */
export function getStatusIcon(status: OperationStatus): string {
  switch (status) {
    case 'PENDING':
      return '⏳'
    case 'READY':
      return '✓'
    case 'EXECUTED':
      return '✓✓'
    case 'CANCELLED':
      return '✗'
    default:
      return '○'
  }
}

