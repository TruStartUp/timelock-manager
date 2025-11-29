/**
 * Integration tests for useOperations hook
 * Tests fetching operations from subgraph with various filters
 * Based on User Story 1: View Pending Timelock Operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOperations } from '@/hooks/useOperations'
import type { Operation } from '@/types/operation'
import { OPERATION_STATUS } from '@/lib/constants'

/**
 * Create a test QueryClient with disabled retries for faster tests
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

/**
 * Wrapper component that provides QueryClientProvider
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

/**
 * Mock operation factory
 */
function createMockOperation(overrides?: Partial<Operation>): Operation {
  const now = BigInt(Math.floor(Date.now() / 1000))
  return {
    id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    index: BigInt(1000000),
    timelockController: '0xTimelock000000000000000000000000000000000',
    target: '0xTarget00000000000000000000000000000000000',
    value: BigInt(0),
    data: '0x',
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt: '0xsalt0000000000000000000000000000000000000000000000000000000000',
    delay: BigInt(3600),
    timestamp: now + BigInt(3600),
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

describe('useOperations Hook', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
  })

  describe('Basic fetching', () => {
    it('should fetch all operations without filters', async () => {
      // Mock operations data
      const mockOperations: Operation[] = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.PENDING,
        }),
        createMockOperation({
          id: '0x0002000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.READY,
          timestamp: BigInt(Math.floor(Date.now() / 1000) - 100), // Already ready
        }),
        createMockOperation({
          id: '0x0003000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.EXECUTED,
          executedAt: BigInt(Math.floor(Date.now() / 1000)),
          executedTx: '0xexecutetx000000000000000000000000000000000000000000000000',
        }),
      ]

      // Mock the subgraph service
      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn().mockResolvedValue(mockOperations),
      }))

      const { result } = renderHook(
        () => useOperations({ timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}` }),
        { wrapper: createWrapper(queryClient) }
      )

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify data
      expect(result.current.data).toHaveLength(3)
      expect(result.current.error).toBeNull()
    })

    it('should handle empty results', async () => {
      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn().mockResolvedValue([]),
      }))

      const { result } = renderHook(
        () => useOperations({ timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}` }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toHaveLength(0)
    })

    it('should handle fetch errors gracefully', async () => {
      const mockError = new Error('Subgraph unavailable')

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn().mockRejectedValue(mockError),
      }))

      const { result } = renderHook(
        () => useOperations({ timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}` }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeDefined()
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('Status filtering', () => {
    it('should filter operations by PENDING status', async () => {
      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.PENDING,
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.status === OPERATION_STATUS.PENDING) {
            return Promise.resolve(mockOperations.filter(op => op.status === OPERATION_STATUS.PENDING))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { status: OPERATION_STATUS.PENDING },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeDefined()
      expect(result.current.data?.every(op => op.status === OPERATION_STATUS.PENDING)).toBe(true)
    })

    it('should filter operations by READY status', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const mockOperations = [
        createMockOperation({
          id: '0x0002000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.READY,
          timestamp: now - BigInt(100), // Ready
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.status === OPERATION_STATUS.READY) {
            return Promise.resolve(mockOperations.filter(op => op.status === OPERATION_STATUS.READY))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { status: OPERATION_STATUS.READY },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.status === OPERATION_STATUS.READY)).toBe(true)
    })

    it('should filter operations by EXECUTED status', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const mockOperations = [
        createMockOperation({
          id: '0x0003000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.EXECUTED,
          executedAt: now,
          executedTx: '0xexecutetx000000000000000000000000000000000000000000000000',
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.status === OPERATION_STATUS.EXECUTED) {
            return Promise.resolve(mockOperations.filter(op => op.status === OPERATION_STATUS.EXECUTED))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { status: OPERATION_STATUS.EXECUTED },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.status === OPERATION_STATUS.EXECUTED)).toBe(true)
    })

    it('should filter operations by CANCELLED status', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const mockOperations = [
        createMockOperation({
          id: '0x0004000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.CANCELLED,
          cancelledAt: now,
          cancelledTx: '0xcanceltx0000000000000000000000000000000000000000000000000',
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.status === OPERATION_STATUS.CANCELLED) {
            return Promise.resolve(mockOperations.filter(op => op.status === OPERATION_STATUS.CANCELLED))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { status: OPERATION_STATUS.CANCELLED },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.status === OPERATION_STATUS.CANCELLED)).toBe(true)
    })
  })

  describe('Address filtering', () => {
    it('should filter operations by proposer address', async () => {
      const proposerAddress = '0xProposerA00000000000000000000000000000000' as `0x${string}`
      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          scheduledBy: proposerAddress,
        }),
        createMockOperation({
          id: '0x0002000000000000000000000000000000000000000000000000000000000000',
          scheduledBy: proposerAddress,
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.proposer === proposerAddress) {
            return Promise.resolve(mockOperations.filter(op => op.scheduledBy === proposerAddress))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { proposer: proposerAddress },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.scheduledBy === proposerAddress)).toBe(true)
    })

    it('should filter operations by target address', async () => {
      const targetAddress = '0xTargetA0000000000000000000000000000000000' as `0x${string}`
      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          target: targetAddress,
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.target === targetAddress) {
            return Promise.resolve(mockOperations.filter(op => op.target === targetAddress))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { target: targetAddress },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.target === targetAddress)).toBe(true)
    })
  })

  describe('Date range filtering', () => {
    it('should filter operations by date range (dateFrom)', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const dateFrom = now - BigInt(7 * 24 * 60 * 60) // 7 days ago

      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          scheduledAt: now - BigInt(3 * 24 * 60 * 60), // 3 days ago
        }),
        createMockOperation({
          id: '0x0002000000000000000000000000000000000000000000000000000000000000',
          scheduledAt: now - BigInt(1 * 24 * 60 * 60), // 1 day ago
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.dateFrom) {
            return Promise.resolve(mockOperations.filter(op => op.scheduledAt >= params.dateFrom!))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { dateFrom },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.scheduledAt >= dateFrom)).toBe(true)
    })

    it('should filter operations by date range (dateTo)', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const dateTo = now - BigInt(1 * 24 * 60 * 60) // 1 day ago

      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          scheduledAt: now - BigInt(7 * 24 * 60 * 60), // 7 days ago
        }),
        createMockOperation({
          id: '0x0002000000000000000000000000000000000000000000000000000000000000',
          scheduledAt: now - BigInt(3 * 24 * 60 * 60), // 3 days ago
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.dateTo) {
            return Promise.resolve(mockOperations.filter(op => op.scheduledAt <= params.dateTo!))
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { dateTo },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.every(op => op.scheduledAt <= dateTo)).toBe(true)
    })

    it('should filter operations by date range (dateFrom and dateTo)', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const dateFrom = now - BigInt(7 * 24 * 60 * 60) // 7 days ago
      const dateTo = now - BigInt(1 * 24 * 60 * 60) // 1 day ago

      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          scheduledAt: now - BigInt(5 * 24 * 60 * 60), // 5 days ago (in range)
        }),
        createMockOperation({
          id: '0x0002000000000000000000000000000000000000000000000000000000000000',
          scheduledAt: now - BigInt(3 * 24 * 60 * 60), // 3 days ago (in range)
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          if (params.dateFrom && params.dateTo) {
            return Promise.resolve(
              mockOperations.filter(
                op => op.scheduledAt >= params.dateFrom! && op.scheduledAt <= params.dateTo!
              )
            )
          }
          return Promise.resolve([])
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: { dateFrom, dateTo },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(
        result.current.data?.every(op => op.scheduledAt >= dateFrom && op.scheduledAt <= dateTo)
      ).toBe(true)
    })
  })

  describe('Combined filters', () => {
    it('should support multiple filters simultaneously', async () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const proposerAddress = '0xProposerA00000000000000000000000000000000' as `0x${string}`
      const dateFrom = now - BigInt(7 * 24 * 60 * 60)

      const mockOperations = [
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
          status: OPERATION_STATUS.PENDING,
          scheduledBy: proposerAddress,
          scheduledAt: now - BigInt(3 * 24 * 60 * 60),
        }),
      ]

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: vi.fn((params) => {
          return Promise.resolve(
            mockOperations.filter(
              op =>
                op.status === params.status &&
                op.scheduledBy === params.proposer &&
                op.scheduledAt >= (params.dateFrom ?? BigInt(0))
            )
          )
        }),
      }))

      const { result } = renderHook(
        () =>
          useOperations({
            timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            filters: {
              status: OPERATION_STATUS.PENDING,
              proposer: proposerAddress,
              dateFrom,
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.length).toBe(1)
      expect(result.current.data?.[0].status).toBe(OPERATION_STATUS.PENDING)
      expect(result.current.data?.[0].scheduledBy).toBe(proposerAddress)
      expect(result.current.data?.[0].scheduledAt).toBeGreaterThanOrEqual(dateFrom)
    })
  })

  describe('Caching and refetching', () => {
    it('should cache results and not refetch immediately', async () => {
      const mockFetch = vi.fn().mockResolvedValue([
        createMockOperation({
          id: '0x0001000000000000000000000000000000000000000000000000000000000000',
        }),
      ])

      vi.mock('@/services/subgraph/operations', () => ({
        fetchOperations: mockFetch,
      }))

      const { result, rerender } = renderHook(
        () => useOperations({ timelockAddress: '0xTimelock000000000000000000000000000000000' as `0x${string}` }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Rerender should use cache
      rerender()

      // Should still only have called once (cache hit)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
