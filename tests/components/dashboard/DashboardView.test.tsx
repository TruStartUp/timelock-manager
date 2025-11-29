import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import DashboardView from '@/components/dashboard/DashboardView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/wagmi'
import React from 'react'

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
    expect(screen.getByText(/PROPOSER_ROLE/i)).toBeInTheDocument()
    expect(screen.getByText(/EXECUTOR_ROLE/i)).toBeInTheDocument()
  })
})
