import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import DashboardView from '@/components/dashboard/DashboardView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/wagmi'
import React from 'react'
import * as useOperationsModule from '@/hooks/useOperations'
import * as useRolesModule from '@/hooks/useRoles'

// Mock the useOperationsSummary hook
vi.mock('@/hooks/useOperations', () => ({
  useOperationsSummary: vi.fn(() => ({
    data: {
      pending: 12,
      ready: 3,
      executed: 89,
      cancelled: 5,
      total: 109,
    },
    isLoading: false,
    isError: false,
  })),
}))

// Mock the useRoles hook
vi.mock('@/hooks/useRoles', () => ({
  useRoles: vi.fn(() => ({
    roles: [
      {
        roleHash: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1',
        roleName: 'PROPOSER',
        currentMembers: [],
        memberCount: 2,
      },
      {
        roleHash: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
        roleName: 'EXECUTOR',
        currentMembers: [],
        memberCount: 1,
      },
    ],
    roleHistory: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

describe('DashboardView', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  test('renders dashboard elements correctly', async () => {
    render(
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DashboardView />
        </QueryClientProvider>
      </WagmiProvider>
    )

    // Check for the "Timelock Contract" label and select
    expect(screen.getByLabelText(/Timelock Contract/i)).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /Timelock Contract/i })
    ).toBeInTheDocument()

    // Check for network status
    expect(screen.getByText(/Connected to:/i)).toBeInTheDocument()
    expect(screen.getByText(/Rootstock Mainnet/i)).toBeInTheDocument()

    // Check for "Operations Overview" section
    expect(
      screen.getByRole('heading', { name: /Operations Overview/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Pending Operations/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready for Execution/i)).toBeInTheDocument()
    expect(screen.getByText(/Executed Operations/i)).toBeInTheDocument()

    // Wait for operation counts to be rendered (from mocked hook)
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument() // Pending count
      expect(screen.getByText('89')).toBeInTheDocument() // Executed count
    })

    // Verify the "Ready for Execution" count (note: "3" also appears in roles table, so we check context)
    const readySection = screen.getByText(/Ready for Execution/i).parentElement
    expect(readySection).toHaveTextContent('3')

    // Check for "Access Manager Roles" section
    expect(
      screen.getByRole('heading', { name: /Access Manager Roles/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    // Role names are now displayed from ROLE_NAMES (Proposer, Executor, etc.)
    await waitFor(() => {
      expect(screen.getByText(/Proposer/i)).toBeInTheDocument()
      expect(screen.getByText(/Executor/i)).toBeInTheDocument()
    })
  })

  test('displays loading skeletons when operations are fetching', () => {
    // Mock loading state
    vi.spyOn(useOperationsModule, 'useOperationsSummary').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    render(
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DashboardView />
        </QueryClientProvider>
      </WagmiProvider>
    )

    // Check that loading skeletons are displayed (should have animate-pulse class)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)

    // Verify that operation cards still render but with loading state
    expect(screen.getByText(/Pending Operations/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready for Execution/i)).toBeInTheDocument()
    expect(screen.getByText(/Executed Operations/i)).toBeInTheDocument()
  })

  test('displays error message when operations fetch fails', () => {
    // Mock error state
    vi.spyOn(useOperationsModule, 'useOperationsSummary').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch operations'),
      refetch: vi.fn(),
    } as any)

    render(
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DashboardView />
        </QueryClientProvider>
      </WagmiProvider>
    )

    // Check that error message is displayed
    expect(screen.getByText(/Failed to load operations data/i)).toBeInTheDocument()
    expect(screen.getByText(/Please check your connection and try again/i)).toBeInTheDocument()
  })

  test('displays zero counts when no data is available', () => {
    // Mock no data state (but not loading or error)
    vi.spyOn(useOperationsModule, 'useOperationsSummary').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    render(
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DashboardView />
        </QueryClientProvider>
      </WagmiProvider>
    )

    // Should display 0 for all counts
    const pendingSection = screen.getByText(/Pending Operations/i).parentElement
    expect(pendingSection).toHaveTextContent('0')

    const readySection = screen.getByText(/Ready for Execution/i).parentElement
    expect(readySection).toHaveTextContent('0')

    const executedSection = screen.getByText(/Executed Operations/i).parentElement
    expect(executedSection).toHaveTextContent('0')
  })
})
