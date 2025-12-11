import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import OperationsExplorerView from '@/components/operations_explorer/OperationsExplorerView'
import React from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/wagmi'
import * as useOperationsModule from '@/hooks/useOperations'
import * as useOperationStatusModule from '@/hooks/useOperationStatus'
import * as useHasRoleModule from '@/hooks/useHasRole'
import * as useTimelockWriteModule from '@/hooks/useTimelockWrite'
import { type Operation } from '@/types/operation'

// Mock data matching the original component's mock data
const mockOperations: Operation[] = [
  {
    id: '0xab1234567890abcdef1234567890abcdef1234567890abcdef1234567890c456' as `0x${string}`,
    index: BigInt(1),
    timelockController: '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as `0x${string}`,
    target: '0x1234567890abcdef1234567890abcdef1234a7b8' as `0x${string}`,
    value: BigInt('1500000000000000000'), // 1.5 ETH in wei
    data: '0x' as `0x${string}`,
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
    delay: BigInt(86400),
    timestamp: BigInt(Math.floor(Date.now() / 1000) + 43200), // 12 hours from now
    status: 'READY',
    scheduledAt: BigInt(1698279600), // 2023-10-26 03:00
    scheduledTx: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    scheduledBy: '0xd4567890abcdef1234567890abcdef1234567e8f9' as `0x${string}`,
    executedAt: null,
    executedTx: null,
    executedBy: null,
    cancelledAt: null,
    cancelledTx: null,
    cancelledBy: null,
  },
  {
    id: '0x2d1234567890abcdef1234567890abcdef1234567890abcdef1234567890a1b2' as `0x${string}`,
    index: BigInt(2),
    timelockController: '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as `0x${string}`,
    target: '0xef567890abcdef1234567890abcdef1234567d5c6' as `0x${string}`,
    value: BigInt(0),
    data: '0x' as `0x${string}`,
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    salt: '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`,
    delay: BigInt(86400),
    timestamp: BigInt(Math.floor(Date.now() / 1000) + 172800), // 2 days from now
    status: 'PENDING',
    scheduledAt: BigInt(1698451800), // 2023-10-28
    scheduledTx: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    scheduledBy: '0x9890abcdef1234567890abcdef1234567890ab3a4' as `0x${string}`,
    executedAt: null,
    executedTx: null,
    executedBy: null,
    cancelledAt: null,
    cancelledTx: null,
    cancelledBy: null,
  },
  {
    id: '0x7f1234567890abcdef1234567890abcdef1234567890abcdef1234567890e3d4' as `0x${string}`,
    index: BigInt(3),
    timelockController: '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as `0x${string}`,
    target: '0x5a567890abcdef1234567890abcdef1234567b6c7' as `0x${string}`,
    value: BigInt(0),
    data: '0x' as `0x${string}`,
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    salt: '0x0000000000000000000000000000000000000000000000000000000000000003' as `0x${string}`,
    delay: BigInt(86400),
    timestamp: BigInt(1698192000), // 2023-10-25 10:00 (executed)
    status: 'EXECUTED',
    scheduledAt: BigInt(1698105600),
    scheduledTx: '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    scheduledBy: '0x3c567890abcdef1234567890abcdef1234567d8e9' as `0x${string}`,
    executedAt: BigInt(1698192000),
    executedTx: '0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    executedBy: '0x4d567890abcdef1234567890abcdef1234567e9f0' as `0x${string}`,
    cancelledAt: null,
    cancelledTx: null,
    cancelledBy: null,
  },
  {
    id: '0x9c1234567890abcdef1234567890abcdef1234567890abcdef1234567890b5d6' as `0x${string}`,
    index: BigInt(4),
    timelockController: '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as `0x${string}`,
    target: '0x8e567890abcdef1234567890abcdef1234567f1a2' as `0x${string}`,
    value: BigInt(0),
    data: '0x' as `0x${string}`,
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    salt: '0x0000000000000000000000000000000000000000000000000000000000000004' as `0x${string}`,
    delay: BigInt(86400),
    timestamp: BigInt(1698134400), // 2023-10-24 12:00 (cancelled)
    status: 'CANCELLED',
    scheduledAt: BigInt(1698048000),
    scheduledTx: '0x5234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    scheduledBy: '0x7a567890abcdef1234567890abcdef1234567b3c4' as `0x${string}`,
    executedAt: null,
    executedTx: null,
    executedBy: null,
    cancelledAt: BigInt(1698134400),
    cancelledTx: '0x6234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    cancelledBy: '0x8b567890abcdef1234567890abcdef1234567c4d5' as `0x${string}`,
  },
]

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

// Wrapper component with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </WagmiProvider>
)

describe('OperationsExplorerView', () => {
  // Create a mock execute function that we can spy on
  const mockExecute = vi.fn()
  const mockReset = vi.fn()

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()

    // Mock useOperations hook to return mock data
    vi.spyOn(useOperationsModule, 'useOperations').mockReturnValue({
      data: mockOperations,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      status: 'success',
      fetchStatus: 'idle',
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
    } as any)

    // Mock useHasRole hook - by default, user has executor role
    vi.spyOn(useHasRoleModule, 'useHasRole').mockReturnValue({
      hasRole: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    // Mock useTimelockWrite hook
    vi.spyOn(useTimelockWriteModule, 'useTimelockWrite').mockReturnValue({
      execute: mockExecute,
      txHash: undefined,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      hasExecutorRole: true,
      isCheckingRole: false,
      reset: mockReset,
    } as any)

    // Mock useOperationStatus hook for each operation
    vi.spyOn(useOperationStatusModule, 'useOperationStatus').mockImplementation((timelockAddress, operationId) => {
      // Find the matching operation from mock data
      const operation = mockOperations.find(op => op.id === operationId)

      if (!operation) {
        return {
          status: 'PENDING',
          timestamp: BigInt(0),
          isReady: false,
          isDone: false,
          isPending: true,
          secondsUntilReady: null,
          timeUntilReady: null,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }
      }

      // Return appropriate status based on operation
      return {
        status: operation.status,
        timestamp: operation.timestamp,
        isReady: operation.status === 'READY',
        isDone: operation.status === 'EXECUTED' || operation.status === 'CANCELLED',
        isPending: operation.status === 'PENDING',
        secondsUntilReady: operation.status === 'PENDING' ? 43200 : null, // 12 hours for pending
        timeUntilReady: operation.status === 'PENDING' ? '12h' : null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      }
    })
  })

  test('renders top navigation bar correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check for title
    expect(screen.getByText(/Timelock Management/i)).toBeInTheDocument()

    // Check for Schedule Operation button
    expect(
      screen.getByRole('button', { name: /Schedule Operation/i })
    ).toBeInTheDocument()
  })

  test('renders page heading correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    expect(screen.getByText(/Timelock Operations/i)).toBeInTheDocument()
  })

  test('renders filter chips correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check for all filter buttons
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Pending$/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ready$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Executed$/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Canceled$/i })
    ).toBeInTheDocument()
  })

  test('renders search bar correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    const searchInput = screen.getByPlaceholderText(
      /Search by ID, proposer\.\.\./i
    )
    expect(searchInput).toBeInTheDocument()
  })

  test('renders filter list button', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // The filter_list icon button should be present
    const filterButtons = screen.getAllByRole('button')
    const filterListButton = filterButtons.find((button) => {
      const icon = button.querySelector('.material-symbols-outlined')
      return icon?.textContent === 'filter_list'
    })
    expect(filterListButton).toBeDefined()
  })

  test('renders table headers correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    expect(screen.getByText(/^ID$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Status$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Calls$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Targets$/i)).toBeInTheDocument()
    expect(screen.getByText(/^ETA$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Proposer$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Actions$/i)).toBeInTheDocument()
  })

  test('renders operation rows with correct data', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check for operation IDs (shortened format: 0x + 4 chars + ... + 4 chars)
    expect(screen.getByText(/0xab12\.\.\.c456/i)).toBeInTheDocument()
    expect(screen.getByText(/0x2d12\.\.\.a1b2/i)).toBeInTheDocument()
    expect(screen.getByText(/0x7f12\.\.\.e3d4/i)).toBeInTheDocument()
    expect(screen.getByText(/0x9c12\.\.\.b5d6/i)).toBeInTheDocument()

    // Check for statuses - use getAllByText since these appear in filters and table
    const readyElements = screen.getAllByText(/^Ready$/i)
    expect(readyElements.length).toBeGreaterThan(0)
    const pendingElements = screen.getAllByText(/^Pending$/i)
    expect(pendingElements.length).toBeGreaterThan(0)
    const executedElements = screen.getAllByText(/^Executed$/i)
    expect(executedElements.length).toBeGreaterThan(0)
    const canceledElements = screen.getAllByText(/^Canceled$/i)
    expect(canceledElements.length).toBeGreaterThan(0)
  })

  test('renders action buttons for Ready status', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check for EXECUTE and CANCEL buttons (Ready status operation)
    // Use getAllByRole since "Executed" filter button also matches "EXECUTE"
    const executeButtons = screen.getAllByRole('button', { name: /EXECUTE/i })
    expect(executeButtons.length).toBeGreaterThan(0)
    const cancelButtons = screen.getAllByRole('button', { name: /CANCEL/i })
    expect(cancelButtons.length).toBeGreaterThan(0)
  })

  test('filter selection updates active filter', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    const pendingButton = screen.getByRole('button', { name: /^Pending$/i })
    fireEvent.click(pendingButton)

    // After clicking, the Pending filter should have the active class
    expect(pendingButton.className).toContain('bg-primary')
  })

  test('search input accepts text input', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    const searchInput = screen.getByPlaceholderText(
      /Search by ID, proposer\.\.\./i
    ) as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: '0xab' } })

    expect(searchInput.value).toBe('0xab')
  })

  test('clicking a row expands operation details', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Click the first row to expand it (starts with no expansion)
    const firstRow = screen.getByText(/0xab12\.\.\.c456/i).closest('tr')
    if (firstRow) {
      fireEvent.click(firstRow)
      // Now operation details should be visible
      expect(screen.getByText(/Operation Details/i)).toBeInTheDocument()
    }

    // Click the second operation row
    const secondRow = screen.getByText(/0x2d12\.\.\.a1b2/i).closest('tr')
    if (secondRow) {
      fireEvent.click(secondRow)
      // The first operation details should be collapsed (only second expanded)
    }
  })

  test('expanded row shows operation details correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Click the first row to expand it
    const firstRow = screen.getByText(/0xab12\.\.\.c456/i).closest('tr')
    if (firstRow) {
      fireEvent.click(firstRow)
    }

    // Check expanded details with full operation ID
    expect(screen.getByText(/Operation Details/i)).toBeInTheDocument()
    expect(screen.getByText(/ID:/i)).toBeInTheDocument()
    expect(screen.getByText(/0xab1234567890abcdef1234567890abcdef1234567890abcdef1234567890c456/i)).toBeInTheDocument()
    expect(screen.getByText(/Proposer:/i)).toBeInTheDocument()
    expect(screen.getByText(/0xd4567890abcdef1234567890abcdef1234567e8f9/i)).toBeInTheDocument()
    expect(screen.getByText(/Scheduled:/i)).toBeInTheDocument()
  })

  test('expanded row shows calls details correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Click the first row to expand it
    const firstRow = screen.getByText(/0xab12\.\.\.c456/i).closest('tr')
    if (firstRow) {
      fireEvent.click(firstRow)
    }

    // Check for Calls section - our mock has 1 call
    expect(screen.getByText(/Calls \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/0x1234567890abcdef1234567890abcdef1234a7b8/i)).toBeInTheDocument()
    expect(screen.getByText(/1\.5 RBTC/i)).toBeInTheDocument()
  })

  test('EXECUTE button is clickable and calls execute function', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    const executeButtons = screen.getAllByRole('button', { name: /^EXECUTE$/i })
    // The actual EXECUTE action button should be the last one (after the "Executed" filter)
    const executeButton = executeButtons[executeButtons.length - 1]
    fireEvent.click(executeButton)

    // Verify that the execute function was called with the correct parameters
    expect(mockExecute).toHaveBeenCalledTimes(1)
    expect(mockExecute).toHaveBeenCalledWith({
      target: '0x1234567890abcdef1234567890abcdef1234a7b8',
      value: BigInt('1500000000000000000'),
      data: '0x',
      predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000',
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
    })
  })

  test('CANCEL button is clickable', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Mock console.log before clicking
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const cancelButtons = screen.getAllByRole('button', { name: /^CANCEL$/i })
    // There are action CANCEL buttons and filter buttons
    // Click the first action button (which should be in the table)
    const actionCancelButton = cancelButtons.find((button) => {
      // Action buttons have specific styling classes
      return button.className.includes('bg-status-canceled/20')
    })

    expect(actionCancelButton).toBeDefined()
    if (actionCancelButton) {
      fireEvent.click(actionCancelButton)
      // Just verify the handler was called with some operation ID
      expect(consoleSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy.mock.calls[0][0]).toBe('Cancel operation:')
    }

    consoleSpy.mockRestore()
  })

  test('displays relative ETA for operations', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check for relative time formatting from live countdown
    // Pending operations show countdown (e.g., "in 12h")
    expect(screen.getByText(/in 12h/i)).toBeInTheDocument()
    // Ready operations show "Ready now"
    expect(screen.getByText(/Ready now/i)).toBeInTheDocument()
  })

  test('displays absolute ETA timestamps', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check that absolute timestamps are formatted (they will be localized)
    // Just verify there are timestamp strings present
    const timestamps = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}.*UTC/i)
    expect(timestamps.length).toBeGreaterThan(0)
  })

  test('formats targets correctly', () => {
    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Our mock data has single targets, so check for shortened addresses
    expect(screen.getByText(/0x1234\.\.\.a7b8/i)).toBeInTheDocument()
    expect(screen.getByText(/0xef56\.\.\.d5c6/i)).toBeInTheDocument()
    expect(screen.getByText(/0x5a56\.\.\.b6c7/i)).toBeInTheDocument()
    expect(screen.getByText(/0x8e56\.\.\.f1a2/i)).toBeInTheDocument()
  })

  test('displays error message when subgraph is unavailable', () => {
    // Mock useOperations to return error state
    vi.spyOn(useOperationsModule, 'useOperations').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Subgraph query failed'),
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: Date.now(),
      failureCount: 1,
      failureReason: new Error('Subgraph query failed'),
      errorUpdateCount: 1,
      isLoadingError: true,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: false,
      status: 'error',
      fetchStatus: 'idle',
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
    } as any)

    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Check for error message
    expect(screen.getByText(/Subgraph Unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/The Graph subgraph is currently unavailable/i)).toBeInTheDocument()
  })

  test('displays retry button when subgraph is unavailable', () => {
    const mockRefetch = vi.fn()

    // Mock useOperations to return error state with refetch function
    vi.spyOn(useOperationsModule, 'useOperations').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Subgraph query failed'),
      refetch: mockRefetch,
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: Date.now(),
      failureCount: 1,
      failureReason: new Error('Subgraph query failed'),
      errorUpdateCount: 1,
      isLoadingError: true,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: false,
      status: 'error',
      fetchStatus: 'idle',
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
    } as any)

    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Find and click retry button
    const retryButton = screen.getByRole('button', { name: /Try Again/i })
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  // T044: Test automatic operation list refresh after successful execution
  test('T044: invalidates queries after successful execution', () => {
    // Spy on queryClient.invalidateQueries
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    // Mock useTimelockWrite to simulate successful execution
    vi.spyOn(useTimelockWriteModule, 'useTimelockWrite').mockReturnValue({
      execute: mockExecute,
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
      isPending: false,
      isSuccess: true, // Successful execution
      isError: false,
      error: null,
      hasExecutorRole: true,
      isCheckingRole: false,
      reset: mockReset,
    } as any)

    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Verify queryClient.invalidateQueries was called with correct query keys
    expect(invalidateQueriesSpy).toHaveBeenCalled()

    // Check that it was called with operations query key
    const calls = invalidateQueriesSpy.mock.calls
    const operationsCall = calls.find(call =>
      call[0]?.queryKey &&
      Array.isArray(call[0].queryKey) &&
      call[0].queryKey[0] === 'operations'
    )
    expect(operationsCall).toBeDefined()

    // Check that it was called with operations-summary query key
    const summaryCall = calls.find(call =>
      call[0]?.queryKey &&
      Array.isArray(call[0].queryKey) &&
      call[0].queryKey[0] === 'operations-summary'
    )
    expect(summaryCall).toBeDefined()

    invalidateQueriesSpy.mockRestore()
  })

  // T045: Test tooltip on disabled Execute button when lacking EXECUTOR_ROLE
  test('T045: displays tooltip when Execute button is disabled due to missing EXECUTOR_ROLE', () => {
    // Mock useHasRole to return false (user doesn't have executor role)
    vi.spyOn(useHasRoleModule, 'useHasRole').mockReturnValue({
      hasRole: false, // No executor role
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    // Mock useTimelockWrite to reflect lack of executor role
    vi.spyOn(useTimelockWriteModule, 'useTimelockWrite').mockReturnValue({
      execute: mockExecute,
      txHash: undefined,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      hasExecutorRole: false, // No executor role
      isCheckingRole: false,
      reset: mockReset,
    } as any)

    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Find the EXECUTE button
    const executeButtons = screen.getAllByRole('button', { name: /^EXECUTE$/i })
    const executeButton = executeButtons[executeButtons.length - 1]

    // Verify button is disabled
    expect(executeButton).toBeDisabled()

    // Verify tooltip contains the expected message
    expect(executeButton).toHaveAttribute('title', 'Your wallet does not have the EXECUTOR_ROLE')
  })

  // T045: Test that Execute button is enabled with correct tooltip when user has EXECUTOR_ROLE
  test('T045: displays correct tooltip when Execute button is enabled with EXECUTOR_ROLE', () => {
    // Mock useHasRole to return true (user has executor role)
    vi.spyOn(useHasRoleModule, 'useHasRole').mockReturnValue({
      hasRole: true, // Has executor role
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    // Mock useTimelockWrite to reflect executor role
    vi.spyOn(useTimelockWriteModule, 'useTimelockWrite').mockReturnValue({
      execute: mockExecute,
      txHash: undefined,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      hasExecutorRole: true, // Has executor role
      isCheckingRole: false,
      reset: mockReset,
    } as any)

    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Find the EXECUTE button
    const executeButtons = screen.getAllByRole('button', { name: /^EXECUTE$/i })
    const executeButton = executeButtons[executeButtons.length - 1]

    // Verify button is enabled
    expect(executeButton).not.toBeDisabled()

    // Verify tooltip contains the expected message
    expect(executeButton).toHaveAttribute('title', 'Execute this operation')
  })

  // T045: Test tooltip when role check is loading
  test('T045: displays correct tooltip when checking permissions', () => {
    // Mock useHasRole to return loading state
    vi.spyOn(useHasRoleModule, 'useHasRole').mockReturnValue({
      hasRole: false,
      isLoading: true, // Checking role
      error: null,
      refetch: vi.fn(),
    } as any)

    // Mock useTimelockWrite to reflect checking state
    vi.spyOn(useTimelockWriteModule, 'useTimelockWrite').mockReturnValue({
      execute: mockExecute,
      txHash: undefined,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      hasExecutorRole: false,
      isCheckingRole: true, // Checking role
      reset: mockReset,
    } as any)

    render(<OperationsExplorerView />, { wrapper: TestWrapper })

    // Find the EXECUTE button (should show CHECKING...)
    const checkingButtons = screen.getAllByRole('button', { name: /CHECKING/i })
    const checkingButton = checkingButtons[checkingButtons.length - 1]

    // Verify button is disabled
    expect(checkingButton).toBeDisabled()

    // Verify tooltip contains the expected message
    expect(checkingButton).toHaveAttribute('title', 'Checking permissions...')
  })
})
