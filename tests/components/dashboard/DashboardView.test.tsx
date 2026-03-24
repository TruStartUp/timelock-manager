import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import DashboardView from '@/components/dashboard/DashboardView'
import { config } from '@/wagmi'
import * as useOperationsModule from '@/hooks/useOperations'
import * as useRolesModule from '@/hooks/useRoles'

const mockUseTimelocks = vi.fn()

vi.mock('@/hooks/useTimelocks', () => ({
  useTimelocks: () => mockUseTimelocks(),
}))

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
  useOperations: vi.fn(() => ({
    data: [
      {
        id: '0x1111111111111111111111111111111111111111111111111111111111111111',
        index: BigInt(1),
        timelockController: '0x0000000000000000000000000000000000000001',
        target: '0x1111111111111111111111111111111111111111',
        value: BigInt(0),
        data: '0x12345678',
        predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000',
        salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
        delay: BigInt(3600),
        timestamp: BigInt(Math.floor(Date.now() / 1000) + 7200),
        status: 'PENDING',
        scheduledAt: BigInt(Math.floor(Date.now() / 1000) - 1800),
        scheduledTx: '0xaaa',
        scheduledBy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        executedAt: null,
        executedTx: null,
        executedBy: null,
        cancelledAt: null,
        cancelledTx: null,
        cancelledBy: null,
        calls: [
          {
            id: 'call-1',
            operation: '0x1111111111111111111111111111111111111111111111111111111111111111',
            index: 0,
            target: '0x1111111111111111111111111111111111111111',
            value: BigInt(0),
            data: '0x12345678',
            signature: '_setMarketBorrowCaps(address[],uint256[])',
          },
        ],
      },
    ],
    isLoading: false,
    isError: false,
  })),
}))

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
      {
        roleHash: '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783',
        roleName: 'CANCELLER',
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

    mockUseTimelocks.mockReturnValue({
      configurations: [
        {
          id: 'test-1',
          name: 'Test Timelock',
          address: '0x0000000000000000000000000000000000000001',
          network: 'rsk_mainnet',
          subgraphUrl: 'https://example.com/subgraph',
        },
      ],
      selected: {
        id: 'test-1',
        name: 'Test Timelock',
        address: '0x0000000000000000000000000000000000000001',
        network: 'rsk_mainnet',
        subgraphUrl: 'https://example.com/subgraph',
      },
      addConfig: vi.fn(),
      removeConfig: vi.fn(),
      select: vi.fn(),
      isLoading: false,
      error: null,
    })
  })

  const renderDashboard = () =>
    render(
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DashboardView />
        </QueryClientProvider>
      </WagmiProvider>
    )

  test('renders redesigned dashboard sections and KPI counts', async () => {
    renderDashboard()

    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument()
    expect(screen.getByText(/Governance Operations/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Schedule New Operation/i })).toBeInTheDocument()

    expect(
      screen.getByLabelText(/View pending operations in Operations Explorer/i)
    ).toHaveTextContent('12')
    expect(
      screen.getByLabelText(/View ready operations in Operations Explorer/i)
    ).toHaveTextContent('3')
    expect(
      screen.getByLabelText(/View executed operations in Operations Explorer/i)
    ).toHaveTextContent('89')

    expect(screen.getByRole('heading', { name: /Recent Operations/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Role Overview/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/_setMarketBorrowCaps/i)).toBeInTheDocument()
    })
  })

  test('shows empty state when no timelocks are configured', () => {
    mockUseTimelocks.mockReturnValue({
      configurations: [],
      selected: null,
      addConfig: vi.fn(),
      removeConfig: vi.fn(),
      select: vi.fn(),
      isLoading: false,
      error: null,
    })

    renderDashboard()
    expect(screen.getByText(/No timelocks configured yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Go to Settings/i })).toBeInTheDocument()
  })

  test('shows select timelock state when no active timelock is selected', () => {
    mockUseTimelocks.mockReturnValue({
      configurations: [
        {
          id: 'test-1',
          name: 'Test Timelock',
          address: '0x0000000000000000000000000000000000000001',
          network: 'rsk_mainnet',
          subgraphUrl: 'https://example.com/subgraph',
        },
      ],
      selected: null,
      addConfig: vi.fn(),
      removeConfig: vi.fn(),
      select: vi.fn(),
      isLoading: false,
      error: null,
    })

    renderDashboard()
    expect(screen.getByText(/Select a timelock to view the dashboard/i)).toBeInTheDocument()
  })

  test('displays loading skeletons when operations are fetching', () => {
    vi.spyOn(useOperationsModule, 'useOperationsSummary').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    vi.spyOn(useOperationsModule, 'useOperations').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /Recent Operations/i })).toBeInTheDocument()
  })

  test('displays error message when operations summary fetch fails', () => {
    vi.spyOn(useOperationsModule, 'useOperationsSummary').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch operations'),
      refetch: vi.fn(),
    } as any)

    renderDashboard()
    expect(screen.getByText(/Failed to load operations data/i)).toBeInTheDocument()
  })

  test('displays error message when recent operations fetch fails', () => {
    vi.spyOn(useOperationsModule, 'useOperations').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch recent operations'),
      refetch: vi.fn(),
    } as any)

    renderDashboard()
    expect(screen.getByText(/Failed to load recent operations/i)).toBeInTheDocument()
  })

  test('displays zero counts when no summary data is available', () => {
    vi.spyOn(useOperationsModule, 'useOperationsSummary').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()
    expect(screen.getByLabelText(/View pending operations in Operations Explorer/i)).toHaveTextContent('0')
    expect(screen.getByLabelText(/View ready operations in Operations Explorer/i)).toHaveTextContent('0')
    expect(screen.getByLabelText(/View executed operations in Operations Explorer/i)).toHaveTextContent('0')
  })

  test('displays empty recent operations message when no operations are available', () => {
    vi.spyOn(useOperationsModule, 'useOperations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()
    expect(screen.getByText(/No operations have been indexed for this timelock yet/i)).toBeInTheDocument()
  })

  test('displays roles error message when roles fetch fails', () => {
    vi.spyOn(useRolesModule, 'useRoles').mockReturnValue({
      roles: undefined,
      roleHistory: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed roles'),
      refetch: vi.fn(),
    } as any)

    renderDashboard()
    expect(screen.getByText(/Failed to load roles data/i)).toBeInTheDocument()
  })
})
