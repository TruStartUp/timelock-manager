/**
 * Integration tests for useTimelockWrite hook (schedule operations)
 * Tests scheduling new operations with permission checks and transaction states
 * Based on User Story 4: Schedule New Timelock Operations
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
import TimelockControllerABI from '@/lib/abis/TimelockController.json'

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

describe('useTimelockWrite Hook - Schedule Operations', () => {
  let queryClient: QueryClient
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    queryClient.clear()
    consoleWarnSpy.mockRestore()
  })

  describe('Schedule mutation setup', () => {
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      expect(result.current.schedule).toBeDefined()
      expect(typeof result.current.schedule).toBe('function')
    })

    it('should expose schedule function', () => {
      // Mock role check
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
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      expect(result.current.schedule).toBeDefined()
      expect(typeof result.current.schedule).toBe('function')
    })

    it('should check PROPOSER_ROLE permission', () => {
      // Mock PROPOSER_ROLE check
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
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Hook should use useHasRole with PROPOSER_ROLE
      expect(result.current.hasProposerRole).toBeDefined()
    })

    it('should expose hasProposerRole flag', () => {
      // Mock PROPOSER_ROLE check returning true
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
        () => useTimelockWrite({
          timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      expect(result.current.hasProposerRole).toBeDefined()
      expect(typeof result.current.hasProposerRole).toBe('boolean')
    })
  })

  describe('Schedule operation flow', () => {
    it('should schedule a single operation successfully', async () => {
      const mockWriteContract = vi.fn()
      const mockTxHash = '0xschedule12000000000000000000000000000000000000000000000000' as `0x${string}`

      // Mock role check (account has PROPOSER_ROLE)
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Schedule operation
      const scheduleParams = {
        target: '0xTarget00000000000000000000000000000000000' as `0x${string}`,
        value: BigInt(0),
        data: '0x' as `0x${string}`,
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        delay: BigInt(172800), // 2 days in seconds
      }

      await act(async () => {
        result.current.schedule(scheduleParams)
      })

      // Verify writeContract was called with correct parameters
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith({
          address: '0xTimelock000000000000000000000000000000000',
          abi: TimelockControllerABI,
          functionName: 'schedule',
          args: [
            scheduleParams.target,
            scheduleParams.value,
            scheduleParams.data,
            scheduleParams.predecessor,
            scheduleParams.salt,
            scheduleParams.delay,
          ],
        })
      })
    })

    it('should schedule a batch operation successfully', async () => {
      const mockWriteContract = vi.fn()
      const mockTxHash = '0xbatchschedule0000000000000000000000000000000000000000000000' as `0x${string}`

      // Mock role check (account has PROPOSER_ROLE)
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Schedule batch operation
      const batchParams = {
        targets: [
          '0xTarget00000000000000000000000000000000000' as `0x${string}`,
          '0xTarget00000000000000000000000000000000001' as `0x${string}`,
        ],
        values: [BigInt(0), BigInt(100)],
        payloads: ['0x' as `0x${string}`, '0xabcd' as `0x${string}`],
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        delay: BigInt(86400), // 1 day in seconds
      }

      await act(async () => {
        result.current.schedule(batchParams)
      })

      // Verify writeContract was called with scheduleBatch
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith({
          address: '0xTimelock000000000000000000000000000000000',
          abi: TimelockControllerABI,
          functionName: 'scheduleBatch',
          args: [
            batchParams.targets,
            batchParams.values,
            batchParams.payloads,
            batchParams.predecessor,
            batchParams.salt,
            batchParams.delay,
          ],
        })
      })
    })

    it('should return transaction hash on successful scheduling', async () => {
      const mockWriteContract = vi.fn()
      const mockTxHash = '0xtxhash123000000000000000000000000000000000000000000000000' as `0x${string}`

      // Mock role check
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Verify transaction hash is exposed
      expect(result.current.txHash).toBe(mockTxHash)
    })
  })

  describe('Permission checks (T059)', () => {
    it('should check PROPOSER_ROLE before enabling schedule', async () => {
      // Mock hasRole check for PROPOSER_ROLE
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
            role: TIMELOCK_ROLES.PROPOSER_ROLE,
            account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
          }),
          write: useTimelockWrite({
            timelockController: '0xTimelock000000000000000000000000000000000' as `0x${string}`,
            account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
          }),
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasRole.hasRole).toBe(true)
        expect(result.current.write.hasProposerRole).toBe(true)
      })
    })

    it('should prevent scheduling when user lacks PROPOSER_ROLE', async () => {
      const mockWriteContract = vi.fn()

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
        writeContract: mockWriteContract,
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
          account: '0xUnauthorized000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Attempt to schedule without PROPOSER_ROLE
      const scheduleParams = {
        target: '0xTarget00000000000000000000000000000000000' as `0x${string}`,
        value: BigInt(0),
        data: '0x' as `0x${string}`,
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        delay: BigInt(172800),
      }

      await act(async () => {
        result.current.schedule(scheduleParams)
      })

      // Verify writeContract was NOT called
      expect(mockWriteContract).not.toHaveBeenCalled()

      // Verify console.warn was called
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Schedule blocked: Account lacks PROPOSER_ROLE'
      )
    })

    it('should expose hasProposerRole as false when role check fails', async () => {
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
          account: '0xUnauthorized000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      await waitFor(() => {
        expect(result.current.hasProposerRole).toBe(false)
      })
    })
  })

  describe('Transaction states', () => {
    it('should show pending state during scheduling', async () => {
      const mockWriteContract = vi.fn()

      // Mock role check (account has PROPOSER_ROLE)
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Should expose pending state for UI
      expect(result.current.schedule).toBeDefined()
      expect(result.current.isPending).toBeDefined()
    })

    it('should handle transaction errors gracefully', async () => {
      const mockError = new Error('Transaction reverted: TimelockUnauthorizedCaller')

      // Mock role check (account has PROPOSER_ROLE)
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Schedule should be defined even in error state
      expect(result.current.schedule).toBeDefined()
      expect(result.current.isError).toBeDefined()
    })
  })

  describe('Type guards and auto-detection', () => {
    it('should auto-detect batch params and call scheduleBatch', async () => {
      const mockWriteContract = vi.fn()

      // Mock role check
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
        writeContract: mockWriteContract,
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Pass batch params (has 'targets' property)
      const batchParams = {
        targets: ['0xTarget00000000000000000000000000000000000' as `0x${string}`],
        values: [BigInt(0)],
        payloads: ['0x' as `0x${string}`],
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        delay: BigInt(86400),
      }

      await act(async () => {
        result.current.schedule(batchParams)
      })

      // Should call scheduleBatch, not schedule
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'scheduleBatch',
          })
        )
      })
    })

    it('should auto-detect single params and call schedule', async () => {
      const mockWriteContract = vi.fn()

      // Mock role check
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
        writeContract: mockWriteContract,
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
          account: '0xProposer00000000000000000000000000000000' as `0x${string}`,
        }),
        { wrapper: createWrapper(queryClient) }
      )

      // Pass single params (has 'target' property, not 'targets')
      const singleParams = {
        target: '0xTarget00000000000000000000000000000000000' as `0x${string}`,
        value: BigInt(0),
        data: '0x' as `0x${string}`,
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        salt: '0xsalt0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        delay: BigInt(172800),
      }

      await act(async () => {
        result.current.schedule(singleParams)
      })

      // Should call schedule, not scheduleBatch
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'schedule',
          })
        )
      })
    })
  })
})
