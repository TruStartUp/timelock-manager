import { render, screen } from '@testing-library/react'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import PermissionsView from '@/components/permissions/PermissionsView'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/wagmi'
import React from 'react'

// Mock the useRoles hook
vi.mock('@/hooks/useRoles', () => ({
  useRoles: vi.fn(() => ({
    roles: [],
    roleHistory: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

// Mock the useHasRole hook
vi.mock('@/hooks/useHasRole', () => ({
  useHasRole: vi.fn(() => ({
    hasRole: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

describe('PermissionsView', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  test('renders the main heading', () => {
    render(
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <PermissionsView />
        </QueryClientProvider>
      </WagmiProvider>
    )
    const heading = screen.getByText('All Roles')
    expect(heading).toBeInTheDocument()
  })
})
