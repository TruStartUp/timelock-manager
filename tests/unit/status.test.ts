/**
 * Unit tests for operation status calculation
 * Tests the status transition logic: PENDING → READY → EXECUTED/CANCELLED
 * Based on data-model.md status calculation logic
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import type { Operation, OperationStatus } from '@/types/operation'
import { OPERATION_STATUS } from '@/lib/constants'
import { calculateOperationStatus } from '@/lib/status'

/**
 * Helper to create a test operation with sensible defaults
 */
function createTestOperation(overrides?: Partial<Operation>): Operation {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const delay = BigInt(3600) // 1 hour default delay

  return {
    id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    index: BigInt(1000000),
    timelockController: '0xTimelock000000000000000000000000000000000',
    target: '0xTarget00000000000000000000000000000000000',
    value: BigInt(0),
    data: '0x',
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt: '0xsalt0000000000000000000000000000000000000000000000000000000000',
    delay,
    timestamp: now + delay, // ETA = scheduledAt + delay
    status: OPERATION_STATUS.PENDING,
    scheduledAt: now,
    scheduledTx: '0xscheduletx00000000000000000000000000000000000000000000000000',
    scheduledBy: '0xProposer000000000000000000000000000000000',
    executedAt: null,
    executedTx: null,
    executedBy: null,
    cancelledAt: null,
    cancelledTx: null,
    cancelledBy: null,
    ...overrides,
  }
}

describe('Operation Status Calculation', () => {
  describe('PENDING state', () => {
    it('should return PENDING when current timestamp is before ETA', () => {
      const operation = createTestOperation({
        timestamp: BigInt(1000000), // ETA in the future
      })
      const currentTimestamp = BigInt(900000) // Before ETA

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.PENDING)
    })

    it('should return PENDING when current timestamp equals scheduledAt', () => {
      const scheduledAt = BigInt(1000000)
      const delay = BigInt(3600)
      const operation = createTestOperation({
        scheduledAt,
        timestamp: scheduledAt + delay,
      })
      const currentTimestamp = scheduledAt // Exactly at schedule time

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.PENDING)
    })

    it('should return PENDING one second before ETA', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
      })
      const currentTimestamp = timestamp - BigInt(1) // One second before ready

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.PENDING)
    })
  })

  describe('READY state', () => {
    it('should return READY when current timestamp equals ETA', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
      })
      const currentTimestamp = timestamp // Exactly at ETA

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.READY)
    })

    it('should return READY when current timestamp is after ETA', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
      })
      const currentTimestamp = timestamp + BigInt(3600) // 1 hour after ETA

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.READY)
    })

    it('should return READY for operations with minimal delay (0 seconds)', () => {
      const scheduledAt = BigInt(1000000)
      const operation = createTestOperation({
        scheduledAt,
        delay: BigInt(0),
        timestamp: scheduledAt, // No delay
      })
      const currentTimestamp = scheduledAt

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.READY)
    })
  })

  describe('EXECUTED state (final)', () => {
    it('should return EXECUTED when operation has executedAt timestamp', () => {
      const timestamp = BigInt(1000000)
      const executedAt = timestamp + BigInt(100)
      const operation = createTestOperation({
        timestamp,
        executedAt,
        executedTx: '0xexecutetx000000000000000000000000000000000000000000000000',
        executedBy: '0xExecutor000000000000000000000000000000000',
      })
      const currentTimestamp = executedAt + BigInt(1000) // Well after execution

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.EXECUTED)
    })

    it('should return EXECUTED even if current time is before ETA (edge case)', () => {
      // This edge case shouldn't happen on-chain, but tests defensive logic
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
        executedAt: timestamp - BigInt(100), // Executed before ready (impossible but defensive)
      })
      const currentTimestamp = timestamp - BigInt(500) // Before ETA

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.EXECUTED)
    })

    it('should prioritize EXECUTED over READY when both conditions met', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
        executedAt: timestamp + BigInt(100),
        executedTx: '0xexecutetx000000000000000000000000000000000000000000000000',
        executedBy: '0xExecutor000000000000000000000000000000000',
      })
      const currentTimestamp = timestamp + BigInt(500) // After ETA and after execution

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.EXECUTED)
    })
  })

  describe('CANCELLED state (final)', () => {
    it('should return CANCELLED when operation has cancelledAt timestamp', () => {
      const timestamp = BigInt(1000000)
      const cancelledAt = BigInt(900000) // Cancelled before ETA
      const operation = createTestOperation({
        timestamp,
        cancelledAt,
        cancelledTx: '0xcanceltx0000000000000000000000000000000000000000000000000',
        cancelledBy: '0xCanceller000000000000000000000000000000000',
      })
      const currentTimestamp = cancelledAt + BigInt(100)

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.CANCELLED)
    })

    it('should return CANCELLED when cancelled while PENDING', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
        cancelledAt: BigInt(900000),
      })
      const currentTimestamp = BigInt(800000) // Before ETA, before cancel time

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.CANCELLED)
    })

    it('should return CANCELLED when cancelled while READY', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
        cancelledAt: timestamp + BigInt(500), // Cancelled after becoming ready
      })
      const currentTimestamp = timestamp + BigInt(1000) // After ETA

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.CANCELLED)
    })

    it('should prioritize CANCELLED over PENDING when cancelled', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
        cancelledAt: BigInt(900000),
      })
      const currentTimestamp = BigInt(800000) // Would be PENDING if not cancelled

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.CANCELLED)
    })

    it('should prioritize CANCELLED over READY when cancelled', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        timestamp,
        cancelledAt: timestamp + BigInt(100),
      })
      const currentTimestamp = timestamp + BigInt(500) // Would be READY if not cancelled

      const status = calculateOperationStatus(operation, currentTimestamp)

      expect(status).toBe(OPERATION_STATUS.CANCELLED)
    })
  })

  describe('State transition sequences', () => {
    it('should transition PENDING → READY as time progresses', () => {
      const scheduledAt = BigInt(1000000)
      const delay = BigInt(3600)
      const timestamp = scheduledAt + delay
      const operation = createTestOperation({
        scheduledAt,
        delay,
        timestamp,
      })

      // At schedule time
      expect(calculateOperationStatus(operation, scheduledAt)).toBe(
        OPERATION_STATUS.PENDING
      )

      // Halfway through delay
      expect(
        calculateOperationStatus(operation, scheduledAt + delay / BigInt(2))
      ).toBe(OPERATION_STATUS.PENDING)

      // At ETA
      expect(calculateOperationStatus(operation, timestamp)).toBe(
        OPERATION_STATUS.READY
      )

      // After ETA
      expect(calculateOperationStatus(operation, timestamp + BigInt(1000))).toBe(
        OPERATION_STATUS.READY
      )
    })

    it('should transition READY → EXECUTED when executed', () => {
      const timestamp = BigInt(1000000)
      const executedAt = timestamp + BigInt(100)
      const operation = createTestOperation({
        timestamp,
      })

      // Before ready
      expect(calculateOperationStatus(operation, timestamp - BigInt(1))).toBe(
        OPERATION_STATUS.PENDING
      )

      // At ready
      expect(calculateOperationStatus(operation, timestamp)).toBe(
        OPERATION_STATUS.READY
      )

      // After execution (mutate operation)
      const executedOperation: Operation = {
        ...operation,
        executedAt,
        executedTx: '0xexecutetx000000000000000000000000000000000000000000000000',
        executedBy: '0xExecutor000000000000000000000000000000000',
      }

      expect(calculateOperationStatus(executedOperation, executedAt)).toBe(
        OPERATION_STATUS.EXECUTED
      )
    })

    it('should transition PENDING → CANCELLED when cancelled before ready', () => {
      const timestamp = BigInt(1000000)
      const cancelledAt = BigInt(900000)
      const operation = createTestOperation({
        timestamp,
      })

      // Initially pending
      expect(calculateOperationStatus(operation, BigInt(800000))).toBe(
        OPERATION_STATUS.PENDING
      )

      // After cancellation (mutate operation)
      const cancelledOperation: Operation = {
        ...operation,
        cancelledAt,
        cancelledTx: '0xcanceltx0000000000000000000000000000000000000000000000000',
        cancelledBy: '0xCanceller000000000000000000000000000000000',
      }

      expect(calculateOperationStatus(cancelledOperation, cancelledAt)).toBe(
        OPERATION_STATUS.CANCELLED
      )

      // Remains cancelled even after ETA would have been reached
      expect(calculateOperationStatus(cancelledOperation, timestamp + BigInt(1000))).toBe(
        OPERATION_STATUS.CANCELLED
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle operations with very large delays', () => {
      const scheduledAt = BigInt(1000000)
      const delay = BigInt(365 * 24 * 60 * 60) // 1 year
      const timestamp = scheduledAt + delay
      const operation = createTestOperation({
        scheduledAt,
        delay,
        timestamp,
      })

      expect(calculateOperationStatus(operation, scheduledAt)).toBe(
        OPERATION_STATUS.PENDING
      )
      expect(calculateOperationStatus(operation, timestamp - BigInt(1))).toBe(
        OPERATION_STATUS.PENDING
      )
      expect(calculateOperationStatus(operation, timestamp)).toBe(
        OPERATION_STATUS.READY
      )
    })

    it('should handle operations scheduled far in the future', () => {
      const futureTime = BigInt(2000000000) // Year 2033
      const operation = createTestOperation({
        scheduledAt: futureTime,
        timestamp: futureTime + BigInt(3600),
      })
      const currentTimestamp = BigInt(1700000000) // Year 2023

      expect(calculateOperationStatus(operation, currentTimestamp)).toBe(
        OPERATION_STATUS.PENDING
      )
    })

    it('should handle batch operations (null target, value, data)', () => {
      const timestamp = BigInt(1000000)
      const operation = createTestOperation({
        target: null, // Batch operation
        value: null,
        data: null,
        timestamp,
      })

      expect(calculateOperationStatus(operation, timestamp - BigInt(1))).toBe(
        OPERATION_STATUS.PENDING
      )
      expect(calculateOperationStatus(operation, timestamp)).toBe(
        OPERATION_STATUS.READY
      )
    })

    it('should handle operations with zero predecessor (no dependency)', () => {
      const operation = createTestOperation({
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: BigInt(1000000),
      })

      expect(calculateOperationStatus(operation, BigInt(900000))).toBe(
        OPERATION_STATUS.PENDING
      )
      expect(calculateOperationStatus(operation, BigInt(1000000))).toBe(
        OPERATION_STATUS.READY
      )
    })
  })
})
