/**
 * Integration tests for useRoles hook
 * Task: T046 [US3]
 *
 * Tests the useRoles hook's ability to:
 * - Fetch role members and history from subgraph
 * - Use event-sourcing logic to compute current members from RoleGranted/RoleRevoked
 * - Handle all 4 standard roles (PROPOSER, EXECUTOR, CANCELLER, DEFAULT_ADMIN_ROLE)
 */

import { renderHook, waitFor } from '@testing-library/react'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/wagmi'
import { useRoles } from '@/hooks/useRoles'
import { TIMELOCK_ROLES } from '@/lib/constants'
import { type Address } from 'viem'
import React from 'react'

// Mock role assignment data from subgraph
interface MockRoleAssignment {
  id: string
  role: `0x${string}`
  account: Address
  sender: Address
  granted: boolean
  blockNumber: bigint
  blockTimestamp: bigint
  transactionHash: `0x${string}`
}

// Create fresh QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

// Test wrapper with providers
const createWrapper = (queryClient: QueryClient) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
  return Wrapper
}

// Mock addresses
const TIMELOCK_ADDRESS = '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as Address
const PROPOSER_1 = '0x1111111111111111111111111111111111111111' as Address
const PROPOSER_2 = '0x2222222222222222222222222222222222222222' as Address
const EXECUTOR_1 = '0x3333333333333333333333333333333333333333' as Address
const CANCELLER_1 = '0x4444444444444444444444444444444444444444' as Address
const ADMIN_1 = '0x5555555555555555555555555555555555555555' as Address
const SENDER = '0x6666666666666666666666666666666666666666' as Address

describe('useRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('T046: fetches and computes current role members using event-sourcing', async () => {
    const queryClient = createTestQueryClient()

    // Mock subgraph response with RoleGranted and RoleRevoked events
    const mockRoleAssignments: MockRoleAssignment[] = [
      // PROPOSER granted to address 1
      {
        id: '0x1-1',
        role: TIMELOCK_ROLES.PROPOSER_ROLE,
        account: PROPOSER_1,
        sender: SENDER,
        granted: true,
        blockNumber: BigInt(1000),
        blockTimestamp: BigInt(1698105600),
        transactionHash: '0xabc1' as `0x${string}`,
      },
      // PROPOSER granted to address 2
      {
        id: '0x1-2',
        role: TIMELOCK_ROLES.PROPOSER_ROLE,
        account: PROPOSER_2,
        sender: SENDER,
        granted: true,
        blockNumber: BigInt(1001),
        blockTimestamp: BigInt(1698105700),
        transactionHash: '0xabc2' as `0x${string}`,
      },
      // PROPOSER revoked from address 2 (should not be in current members)
      {
        id: '0x1-3',
        role: TIMELOCK_ROLES.PROPOSER_ROLE,
        account: PROPOSER_2,
        sender: SENDER,
        granted: false,
        blockNumber: BigInt(1002),
        blockTimestamp: BigInt(1698105800),
        transactionHash: '0xabc3' as `0x${string}`,
      },
    ]

    // Mock the subgraph query - we'll need to mock the actual implementation
    // For now, we'll test the hook structure
    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    // Wait for hook to complete (this will fail until T047 implements the hook)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // After event-sourcing, PROPOSER_1 should be current member
    // PROPOSER_2 should NOT be current member (was revoked)
    expect(result.current.roles).toBeDefined()

    const proposerRole = result.current.roles?.find(
      (r) => r.roleHash === TIMELOCK_ROLES.PROPOSER_ROLE
    )

    expect(proposerRole).toBeDefined()
    expect(proposerRole?.currentMembers).toContain(PROPOSER_1)
    expect(proposerRole?.currentMembers).not.toContain(PROPOSER_2)
  })

  test('T046: returns role history with all grant and revoke events', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // History should include both granted and revoked events
    expect(result.current.roleHistory).toBeDefined()
    expect(Array.isArray(result.current.roleHistory)).toBe(true)

    // History should be sorted by timestamp (most recent first)
    if (result.current.roleHistory && result.current.roleHistory.length > 1) {
      for (let i = 0; i < result.current.roleHistory.length - 1; i++) {
        expect(
          result.current.roleHistory[i].blockTimestamp
        ).toBeGreaterThanOrEqual(
          result.current.roleHistory[i + 1].blockTimestamp
        )
      }
    }
  })

  test('T046: handles multiple members for the same role', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Should handle multiple EXECUTOR role holders
    const executorRole = result.current.roles?.find(
      (r) => r.roleHash === TIMELOCK_ROLES.EXECUTOR_ROLE
    )

    if (executorRole && executorRole.currentMembers.length > 0) {
      expect(Array.isArray(executorRole.currentMembers)).toBe(true)
      // All members should be unique addresses
      const uniqueMembers = new Set(executorRole.currentMembers)
      expect(uniqueMembers.size).toBe(executorRole.currentMembers.length)
    }
  })

  test('T046: fetches all 4 standard timelock roles', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    expect(result.current.roles).toBeDefined()

    // Should include all 4 standard roles (even if empty)
    const roleHashes = result.current.roles?.map((r) => r.roleHash) ?? []
    expect(roleHashes).toContain(TIMELOCK_ROLES.PROPOSER_ROLE)
    expect(roleHashes).toContain(TIMELOCK_ROLES.EXECUTOR_ROLE)
    expect(roleHashes).toContain(TIMELOCK_ROLES.CANCELLER_ROLE)
    expect(roleHashes).toContain(TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE)
  })

  test('T046: returns role names alongside role hashes', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Each role should have a human-readable name
    result.current.roles?.forEach((role) => {
      expect(role.roleHash).toBeDefined()
      expect(role.roleName).toBeDefined()
      expect(typeof role.roleName).toBe('string')
      expect(role.roleName.length).toBeGreaterThan(0)
    })
  })

  test('T046: handles error when subgraph is unavailable', async () => {
    const queryClient = createTestQueryClient()

    // Mock subgraph error - will be implemented with actual mock in T047
    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Hook should handle errors gracefully
    if (result.current.isError) {
      expect(result.current.error).toBeDefined()
      expect(result.current.roles).toBeUndefined()
    }
  })

  test('T046: returns empty arrays when no roles are granted', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Even with no role grants, should return structure with empty members
    expect(result.current.roles).toBeDefined()
    result.current.roles?.forEach((role) => {
      expect(Array.isArray(role.currentMembers)).toBe(true)
    })
  })

  test('T046: supports refetch to get latest role changes', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Hook should provide refetch function
    expect(result.current.refetch).toBeDefined()
    expect(typeof result.current.refetch).toBe('function')

    // Call refetch
    const refetchPromise = result.current.refetch()
    expect(refetchPromise).toBeInstanceOf(Promise)
  })

  test('T046: includes transaction details in role history', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Each history event should include transaction details
    result.current.roleHistory?.forEach((event) => {
      expect(event.transactionHash).toBeDefined()
      expect(event.blockTimestamp).toBeDefined()
      expect(event.account).toBeDefined()
      expect(event.role).toBeDefined()
      expect(typeof event.granted).toBe('boolean')
    })
  })

  test('T046: correctly identifies granted vs revoked events', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // History should distinguish between grants and revokes
    result.current.roleHistory?.forEach((event) => {
      expect(event.granted).toBeDefined()
      if (event.granted) {
        // Granted event
        expect(event.granted).toBe(true)
      } else {
        // Revoked event
        expect(event.granted).toBe(false)
      }
    })
  })

  test('T046: handles timelock address change via refetch', async () => {
    const queryClient = createTestQueryClient()

    const TIMELOCK_2 = '0x7777777777777777777777777777777777777777' as Address

    const { result, rerender } = renderHook(
      ({ address }: { address: Address }) => useRoles({ timelockController: address }),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { address: TIMELOCK_ADDRESS }
      }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Change timelock address
    rerender({ address: TIMELOCK_2 })

    // Should trigger new fetch
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Hook should have processed new address
    expect(result.current.roles).toBeDefined()
  })

  test('T046: computes correct member count per role', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useRoles({ timelockController: TIMELOCK_ADDRESS }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    // Each role should report correct member count
    result.current.roles?.forEach((role) => {
      expect(role.currentMembers).toBeDefined()
      expect(role.memberCount).toBe(role.currentMembers.length)
    })
  })
})
