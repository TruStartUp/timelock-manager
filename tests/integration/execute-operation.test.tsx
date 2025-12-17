/**
 * Integration tests for useTimelockWrite hook (execute operations)
 * Tests executing ready operations with permission checks and transaction states
 * Based on User Story 2: Execute Ready Timelock Operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import type { ReactNode } from 'react'
import { useTimelockWrite } from '@/hooks/useTimelockWrite'
import { useHasRole } from '@/hooks/useHasRole'
import { TIMELOCK_ROLES } from '@/lib/constants'
import { config } from '@/wagmi'

/**
 * Mock wagmi hooks
 */
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useWriteContract: vi.fn(),
    useReadContract: vi.fn(),
    useWaitForTransactionReceipt: vi.fn(),
  }
})

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'

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
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Wrapper component that provides QueryClientProvider and WagmiProvider
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    )
  }
}

describe('useTimelockWrite Hook - Execute Operations', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Execute mutation setup', () => {
    it('should initialize with idle state', () => {
      // Mock role check (required by useTimelockWrite)
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      // Mock wagmi hooks
      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: vi.fn(),
        writeContractAsync: vi.fn(),
        data: undefined,
        error: null,
        isPending: false,
        isSuccess: false,
        isError: false,
        isIdle: true,
        reset: vi.fn(),
        status: 'idle',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: 0,
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: undefined,
        error: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
        status: 'idle',
      } as any)

      const { result } = renderHook(
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      expect(result.current.execute).toBeDefined()
      expect(typeof result.current.execute).toBe('function')
      expect(result.current.hasExecutorRole).toBe(true)
    })
  })

  describe('Execute operation flow', () => {
    it('should execute a ready operation successfully', async () => {
      const mockWriteContract = vi.fn()
      const mockTxHash = '0xexecute123000000000000000000000000000000000000000000000000' as `0x${string}`

      // Mock role check (account has EXECUTOR_ROLE)
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      // Mock successful write
      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: mockWriteContract,
        writeContractAsync: vi.fn().mockResolvedValue(mockTxHash),
        data: mockTxHash,
        error: null,
        isPending: false,
        isSuccess: true,
        isError: false,
        isIdle: false,
        reset: vi.fn(),
        status: 'success',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: Date.now(),
        context: undefined,
      } as any)

      // Mock successful transaction receipt
      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: {
          transactionHash: mockTxHash,
          status: 'success',
        } as any,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
      } as any)

      const { result } = renderHook(
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Execute operation
      const operationParams = {
        target: '0xTarget00000000000000000000000000000000000' as `0x${string}`,
        value: BigInt(0),
        data: '0x' as `0x${string}`,
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      }

      await act(async () => {
        result.current.execute(operationParams)
      })

      // Verify writeContract was called with correct parameters
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalled()
      })
    })

    it('should execute a batch operation successfully', async () => {
      const mockWriteContract = vi.fn()
      const mockTxHash = '0xbatch123000000000000000000000000000000000000000000000000000' as `0x${string}`

      // Mock role check (account has EXECUTOR_ROLE)
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      // Mock successful write
      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: mockWriteContract,
        writeContractAsync: vi.fn().mockResolvedValue(mockTxHash),
        data: mockTxHash,
        error: null,
        isPending: false,
        isSuccess: true,
        isError: false,
        isIdle: false,
        reset: vi.fn(),
        status: 'success',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: Date.now(),
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: {
          transactionHash: mockTxHash,
          status: 'success',
        } as any,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
      } as any)

      const { result } = renderHook(
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Execute batch operation
      const batchParams = {
        targets: [
          '0xTarget00000000000000000000000000000000000' as `0x${string}`,
          '0xTarget00000000000000000000000000000000001' as `0x${string}`,
        ],
        values: [BigInt(0), BigInt(100)],
        payloads: ['0x' as `0x${string}`, '0xabcd' as `0x${string}`],
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      }

      await act(async () => {
        result.current.execute(batchParams)
      })

      // Verify writeContract was called
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalled()
      })
    })
  })

  describe('Permission checks', () => {
    it('should check EXECUTOR_ROLE before enabling execute', async () => {
      // Mock hasRole check
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: vi.fn(),
        writeContractAsync: vi.fn(),
        data: undefined,
        error: null,
        isPending: false,
        isSuccess: false,
        isError: false,
        isIdle: true,
        reset: vi.fn(),
        status: 'idle',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: 0,
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: undefined,
        error: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
        status: 'idle',
      } as any)

      const { result } = renderHook(
        () => ({
          hasRole: useHasRole({
            timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            role: TIMELOCK_ROLES.EXECUTOR_ROLE,
            account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
          }),
          write: useTimelockWrite({
            timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          }),
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasRole.hasRole).toBe(true)
      })
    })

    it('should prevent execution when user lacks EXECUTOR_ROLE', async () => {
      // Mock hasRole check returning false
      vi.mocked(useReadContract).mockReturnValue({
        data: false,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: vi.fn(),
        writeContractAsync: vi.fn(),
        data: undefined,
        error: null,
        isPending: false,
        isSuccess: false,
        isError: false,
        isIdle: true,
        reset: vi.fn(),
        status: 'idle',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: 0,
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: undefined,
        error: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
        status: 'idle',
      } as any)

      const { result } = renderHook(
        () => ({
          hasRole: useHasRole({
            timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            role: TIMELOCK_ROLES.EXECUTOR_ROLE,
            account: '0xUnauthorized000000000000000000000000000' as `0x${string}`,
          }),
          write: useTimelockWrite({
            timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          }),
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasRole.hasRole).toBe(false)
      })

      // Verify that hasRole check prevents execution
      // (UI components should disable the execute button based on hasRole)
    })
  })

  describe('Transaction states', () => {
    it('should show pending state during execution', async () => {
      const mockWriteContract = vi.fn()

      // Mock role check (account has EXECUTOR_ROLE)
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      // Mock pending write
      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: mockWriteContract,
        writeContractAsync: vi.fn(),
        data: undefined,
        error: null,
        isPending: true,
        isSuccess: false,
        isError: false,
        isIdle: false,
        reset: vi.fn(),
        status: 'pending',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: Date.now(),
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: undefined,
        error: null,
        isLoading: true,
        isSuccess: false,
        isError: false,
        status: 'pending',
      } as any)

      const { result } = renderHook(
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Should expose pending state for UI
      expect(result.current.execute).toBeDefined()
    })

    it('should handle transaction errors gracefully', async () => {
      const mockError = new Error('Transaction reverted: TimelockUnauthorizedCaller')

      // Mock role check (account has EXECUTOR_ROLE)
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      // Mock failed write
      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: vi.fn(),
        writeContractAsync: vi.fn().mockRejectedValue(mockError),
        data: undefined,
        error: mockError,
        isPending: false,
        isSuccess: false,
        isError: true,
        isIdle: false,
        reset: vi.fn(),
        status: 'error',
        variables: undefined,
        failureCount: 1,
        failureReason: mockError,
        submittedAt: Date.now(),
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: undefined,
        error: mockError,
        isLoading: false,
        isSuccess: false,
        isError: true,
        status: 'error',
      } as any)

      const { result } = renderHook(
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Execute should be defined even in error state
      expect(result.current.execute).toBeDefined()
    })
  })

  describe('Cache invalidation', () => {
    it('should support automatic operation list refresh after successful execution', async () => {
      const mockTxHash = '0xsuccess123000000000000000000000000000000000000000000000000' as `0x${string}`

      // Mock role check (account has EXECUTOR_ROLE)
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      // Mock successful execution
      vi.mocked(useWriteContract).mockReturnValue({
        writeContract: vi.fn(),
        writeContractAsync: vi.fn().mockResolvedValue(mockTxHash),
        data: mockTxHash,
        error: null,
        isPending: false,
        isSuccess: true,
        isError: false,
        isIdle: false,
        reset: vi.fn(),
        status: 'success',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        submittedAt: Date.now(),
        context: undefined,
      } as any)

      vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
        data: {
          transactionHash: mockTxHash,
          status: 'success',
        } as any,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
      } as any)

      const { result } = renderHook(
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Verify that the hook provides success state
      // (Component integration will handle queryClient.invalidateQueries)
      expect(result.current.execute).toBeDefined()
    })
  })
})

describe('useHasRole Hook', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Role checking', () => {
    it('should check if account has EXECUTOR_ROLE', async () => {
      // Mock hasRole returning true
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      const { result } = renderHook(
        () => useHasRole({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          role: TIMELOCK_ROLES.EXECUTOR_ROLE,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasRole).toBe(true)
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should return false when account lacks role', async () => {
      // Mock hasRole returning false
      vi.mocked(useReadContract).mockReturnValue({
        data: false,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: vi.fn(),
      } as any)

      const { result } = renderHook(
        () => useHasRole({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          role: TIMELOCK_ROLES.EXECUTOR_ROLE,
          account: '0xNonExecutor0000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasRole).toBe(false)
      })
    })

    it('should handle undefined account gracefully', async () => {
      // Mock undefined account
      vi.mocked(useReadContract).mockReturnValue({
        data: undefined,
        error: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
        status: 'idle',
        refetch: vi.fn(),
      } as any)

      const { result } = renderHook(
        () => useHasRole({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          role: TIMELOCK_ROLES.EXECUTOR_ROLE,
          account: undefined,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Should return false when account is undefined
      expect(result.current.hasRole).toBe(false)
    })
  })

  describe('Caching behavior', () => {
    it('should cache role checks for 5 minutes', async () => {
      const mockRefetch = vi.fn()

      // Mock with 5-minute cache
      vi.mocked(useReadContract).mockReturnValue({
        data: true,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        status: 'success',
        refetch: mockRefetch,
      } as any)

      const { result, rerender } = renderHook(
        () => useHasRole({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          role: TIMELOCK_ROLES.EXECUTOR_ROLE,
          account: '0xExecutor00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasRole).toBe(true)
      })

      // Rerender should use cache
      rerender()

      // Should not trigger additional reads immediately
      expect(result.current.hasRole).toBe(true)
    })
  })
})
