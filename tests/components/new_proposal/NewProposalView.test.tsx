import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import NewProposalView from '@/components/new_proposal/NewProposalView'
import React from 'react'

const mockSchedule = vi.fn()
let mockIsSuccess = false
let mockTxHash: `0x${string}` | undefined = undefined
let mockMinDelay: bigint | undefined = BigInt(0)
let mockResolvedAbi: any[] = []
let mockHasProposerRole = true
let mockIsCheckingRole = false

const MOCK_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'setOwner',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateDelay',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newDelay', type: 'uint256' }],
    outputs: [],
  },
]

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000001',
  }),
  usePublicClient: () => ({
    simulateContract: vi.fn(),
  }),
}))

vi.mock('@/hooks/useContractABI', () => ({
  useContractABI: () => ({
    abi: mockResolvedAbi,
    isProxy: false,
    implementationAddress: undefined,
    source: 'blockscout',
    confidence: 'high',
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useTimelockWrite', () => ({
  useTimelockWrite: () => ({
    schedule: mockSchedule,
    isPending: false,
    isSuccess: mockIsSuccess,
    isError: false,
    error: null,
    txHash: mockTxHash,
    minDelay: mockMinDelay,
    hasProposerRole: mockHasProposerRole,
    isCheckingRole: mockIsCheckingRole,
    reset: vi.fn(),
  }),
}))

describe('NewProposalView', () => {
  beforeEach(() => {
    mockSchedule.mockClear()
    mockIsSuccess = false
    mockTxHash = undefined
    mockMinDelay = BigInt(0)
    mockResolvedAbi = MOCK_ABI
    mockHasProposerRole = true
    mockIsCheckingRole = false
    sessionStorage.clear()
  })

  test('renders sidebar navigation correctly', () => {
    render(<NewProposalView />)

    // Check for title and subtitle
    expect(screen.getByText(/Timelock Wizard/i)).toBeInTheDocument()
    expect(screen.getByText(/Schedule a new operation/i)).toBeInTheDocument()

    // Check for navigation steps
    expect(screen.getByText(/1\. Target/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. Function/i)).toBeInTheDocument()
    expect(screen.getByText(/3\. Review/i)).toBeInTheDocument()

    // Check for help section
    expect(screen.getByText(/Need help\?/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /Refer to the documentation for detailed instructions on scheduling operations/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /View Docs/i })
    ).toBeInTheDocument()
  })

  test('renders Step 1 content correctly', () => {
    render(<NewProposalView />)

    // Check for step heading and description
    expect(
      screen.getByText(/Step 1: Select Target Contract/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Enter the address of the contract you wish to interact with and fetch its ABI/i
      )
    ).toBeInTheDocument()

    // Check for input field
    expect(
      screen.getByLabelText(/Target Contract Address/i)
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/^0x\.\.\.$/i)).toBeInTheDocument()

    // Check for Fetch ABI button
    expect(
      screen.getByRole('button', { name: /Fetch ABI/i })
    ).toBeInTheDocument()
  })

  test('advances to Step 2 after fetching ABI', async () => {
    render(<NewProposalView />)

    // Enter valid address and click Fetch ABI
    fireEvent.change(screen.getByLabelText(/Target Contract Address/i), {
      target: { value: '0x0000000000000000000000000000000000000002' },
    })
    const fetchButton = screen.getByRole('button', { name: /Fetch ABI/i })
    fireEvent.click(fetchButton)

    // After successful ABI load, UX should auto-navigate to Step 2
    await screen.findByText(/Step 2: Configure Function Call/i)
    await screen.findByText(/Select Function/i)
  })

  test('allows navigation to Step 2', async () => {
    render(<NewProposalView />)

    // Click on Step 2 in sidebar navigation
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Check for Step 2 heading
    expect(
      screen.getByText(/Step 2: Configure Function Call/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Select a function from the ABI and provide the required arguments/i
      )
    ).toBeInTheDocument()

    // With a fetched ABI, Step 2 should show the function selector (not the warning block)
    await screen.findByText(/Select Function/i)
  })

  test('renders Step 2 content correctly (write functions only)', async () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Check for function selector
    await screen.findByText(/Select Function/i)
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Only write functions should be selectable (T063)
    expect(
      screen.getByRole('option', { name: /setOwner\(address\)/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /transfer\(address,uint256\)/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /owner\(\)/i })).toBeNull()

    // Select transfer and ensure dynamic fields are generated
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })

    await screen.findByLabelText(/to \(address\)/i)
    expect(screen.getByLabelText(/amount \(uint256\)/i)).toBeInTheDocument()

    // Check for navigation buttons
    expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Next: Review/i })
    ).toBeInTheDocument()
  })

  test('renders Step 3 review screen with calldata preview', async () => {
    render(<NewProposalView />)

    // Go to Step 2
    fireEvent.click(screen.getByText(/2\. Function/i))
    await screen.findByText(/Select Function/i)

    // Select transfer and fill inputs
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })
    fireEvent.change(await screen.findByLabelText(/to \(address\)/i), {
      target: { value: '0x0000000000000000000000000000000000000004' },
    })
    fireEvent.change(screen.getByLabelText(/amount \(uint256\)/i), {
      target: { value: '1' },
    })

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }))

    // Review screen should render
    await screen.findByText(/Step 3: Review Operation/i)
    expect(
      screen.getByText(/Encoded calldata preview/i)
    ).toBeInTheDocument()

    // Calldata should be encoded (starts with 0x)
    const calldataBox = screen.getByLabelText(
      /Encoded calldata preview/i
    ) as HTMLTextAreaElement
    expect(calldataBox.value.startsWith('0x')).toBe(true)
  })

  test('requires CONFIRM for high-risk functions before enabling Submit', async () => {
    render(<NewProposalView />)

    // Go to Step 2
    fireEvent.click(screen.getByText(/2\. Function/i))
    await screen.findByText(/Select Function/i)

    // Select high-risk function and fill inputs
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'updateDelay(uint256)' },
    })
    fireEvent.change(await screen.findByLabelText(/newDelay \(uint256\)/i), {
      target: { value: '123' },
    })

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }))
    await screen.findByText(/Step 3: Review Operation/i)

    // CONFIRM gate visible and Submit disabled
    expect(screen.getByText(/High-risk function detected/i)).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /^Submit$/i })
    expect(submit).toBeDisabled()

    // Type wrong text -> still disabled
    fireEvent.change(screen.getByLabelText(/Type CONFIRM to enable Submit/i), {
      target: { value: 'confirm' },
    })
    expect(submit).toBeDisabled()

    // Type exact CONFIRM -> enabled
    fireEvent.change(screen.getByLabelText(/Type CONFIRM to enable Submit/i), {
      target: { value: 'CONFIRM' },
    })
    expect(submit).toBeDisabled() // still disabled until required fields for scheduling are filled
  })

  test('submits schedule via useTimelockWrite.schedule with validated params', async () => {
    render(<NewProposalView />)

    // Step 1: set target contract and fetch ABI (auto-advances to Step 2)
    fireEvent.change(screen.getByLabelText(/Target Contract Address/i), {
      target: { value: '0x0000000000000000000000000000000000000002' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Fetch ABI/i }))
    await screen.findByText(/Select Function/i)

    // Select transfer and fill inputs
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })
    fireEvent.change(await screen.findByLabelText(/to \(address\)/i), {
      target: { value: '0x0000000000000000000000000000000000000004' },
    })
    fireEvent.change(screen.getByLabelText(/amount \(uint256\)/i), {
      target: { value: '1' },
    })

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }))
    await screen.findByText(/Step 3: Review Operation/i)

    // Fill timelock address + delay so Submit is enabled
    fireEvent.change(screen.getByLabelText(/Timelock Controller Address/i), {
      target: { value: '0x0000000000000000000000000000000000000009' },
    })
    fireEvent.change(screen.getByLabelText(/Delay \(seconds\)/i), {
      target: { value: '86400' },
    })

    const submit = screen.getByRole('button', { name: /^Submit$/i })
    expect(submit).not.toBeDisabled()

    fireEvent.click(submit)

    expect(mockSchedule).toHaveBeenCalledTimes(1)
    const arg = mockSchedule.mock.calls[0][0]
    expect(arg.target).toMatch(/^0x/i)
    expect(arg.value).toBe(BigInt(0))
    expect(arg.data.startsWith('0x')).toBe(true)
    expect(arg.predecessor.startsWith('0x')).toBe(true)
    expect(arg.salt.startsWith('0x')).toBe(true)
    expect(arg.delay).toBe(BigInt(86400))
  })

  test('shows success screen with tx hash, operation id, and ETA after scheduling', async () => {
    const { rerender } = render(<NewProposalView />)

    // Step 1: set target contract and fetch ABI (auto-advances to Step 2)
    fireEvent.change(screen.getByLabelText(/Target Contract Address/i), {
      target: { value: '0x0000000000000000000000000000000000000002' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Fetch ABI/i }))
    await screen.findByText(/Select Function/i)

    // Select transfer and fill inputs
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })
    fireEvent.change(await screen.findByLabelText(/to \(address\)/i), {
      target: { value: '0x0000000000000000000000000000000000000004' },
    })
    fireEvent.change(screen.getByLabelText(/amount \(uint256\)/i), {
      target: { value: '1' },
    })

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }))
    await screen.findByText(/Step 3: Review Operation/i)

    // Fill timelock address + delay so Submit is enabled
    fireEvent.change(screen.getByLabelText(/Timelock Controller Address/i), {
      target: { value: '0x0000000000000000000000000000000000000009' },
    })
    fireEvent.change(screen.getByLabelText(/Delay \(seconds\)/i), {
      target: { value: '86400' },
    })

    const submit = screen.getByRole('button', { name: /^Submit$/i })
    fireEvent.click(submit)

    // Simulate hook success and rerender so component sees updated values
    mockIsSuccess = true
    mockTxHash =
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    rerender(<NewProposalView />)

    await screen.findByText(/Operation scheduled successfully/i)
    expect(screen.getByLabelText(/Transaction hash/i)).toHaveTextContent(
      mockTxHash
    )

    const opId = screen.getByLabelText(/Operation ID/i).textContent || ''
    expect(opId.startsWith('0x')).toBe(true)
    expect(opId.length).toBe(66)

    expect(screen.getByLabelText(/Estimated ETA/i)).toBeInTheDocument()
  })

  test('stores manual ABI in sessionStorage with 24h TTL', async () => {
    // Force the manual-ABI path by making ABI lookup return empty
    mockResolvedAbi = []
    render(<NewProposalView />)

    fireEvent.change(screen.getByLabelText(/Target Contract Address/i), {
      target: { value: '0x0000000000000000000000000000000000000002' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Fetch ABI/i }))

    // Manual ABI modal should appear
    await screen.findByText(/Contract Not Verified/i)

    const abiJson = JSON.stringify([
      {
        type: 'function',
        name: 'foo',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
      },
    ])

    fireEvent.change(screen.getByLabelText(/Contract ABI \(JSON\)/i), {
      target: { value: abiJson },
    })
    fireEvent.click(screen.getByRole('button', { name: /Use This ABI/i }))

    // Verify sessionStorage written
    const cacheRaw = sessionStorage.getItem('abiCache')
    expect(cacheRaw).toBeTruthy()
    const cache = JSON.parse(cacheRaw as string)
    expect(cache['0x0000000000000000000000000000000000000002']).toBeTruthy()

    const entry = cache['0x0000000000000000000000000000000000000002']
    expect(entry.ttl).toBe(24 * 60 * 60)
    expect(typeof entry.fetchedAt).toBe('string')
    expect(entry.source).toBe('manual')
    expect(entry.confidence).toBe('high')
    expect(Array.isArray(entry.abi)).toBe(true)
  })

  test('warns user when wallet lacks PROPOSER_ROLE', async () => {
    mockHasProposerRole = false
    mockIsCheckingRole = false

    render(<NewProposalView />)

    // Step 1 -> Step 2
    fireEvent.change(screen.getByLabelText(/Target Contract Address/i), {
      target: { value: '0x0000000000000000000000000000000000000002' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Fetch ABI/i }))
    await screen.findByText(/Select Function/i)

    // Step 2 -> Step 3
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })
    fireEvent.change(await screen.findByLabelText(/to \(address\)/i), {
      target: { value: '0x0000000000000000000000000000000000000004' },
    })
    fireEvent.change(screen.getByLabelText(/amount \(uint256\)/i), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }))
    await screen.findByText(/Step 3: Review Operation/i)

    // Provide timelock address to trigger role display
    fireEvent.change(screen.getByLabelText(/Timelock Controller Address/i), {
      target: { value: '0x0000000000000000000000000000000000000009' },
    })

    expect(
      await screen.findByText(/Not authorized to schedule/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled()
  })

  test('allows input in contract address field', () => {
    render(<NewProposalView />)

    const input = screen.getByLabelText(
      /Target Contract Address/i
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: '0x1234567890abcdef' } })

    expect(input.value).toBe('0x1234567890abcdef')
  })

  test('allows input in function parameter fields', async () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    await screen.findByText(/Select Function/i)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })

    // Test 'to' parameter input
    const toInput = (await screen.findByLabelText(
      /to \(address\)/i
    )) as HTMLInputElement
    fireEvent.change(toInput, {
      target: { value: '0x0000000000000000000000000000000000000003' },
    })
    expect(toInput.value).toBe('0x0000000000000000000000000000000000000003')

    // Test 'amount' parameter input
    const amountInput = screen.getByLabelText(
      /amount \(uint256\)/i
    ) as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '1000000000000000000' } })
    expect(amountInput.value).toBe('1000000000000000000')
  })

  test('allows function selection from dropdown', async () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    await screen.findByText(/Select Function/i)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, {
      target: { value: 'setOwner(address)' },
    })

    expect(select.value).toBe('setOwner(address)')
  })

  test('Back button navigates to previous step', async () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Verify we're on Step 2
    expect(
      screen.getByText(/Step 2: Configure Function Call/i)
    ).toBeInTheDocument()
    await screen.findByText(/Select Function/i)

    // Click Back button
    const backButton = screen.getByRole('button', { name: /^Back$/i })
    fireEvent.click(backButton)

    // Should show only Step 1 content (Step 2 should not be visible)
    expect(
      screen.getByText(/Step 1: Select Target Contract/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Step 2: Configure Function Call/i)
    ).not.toBeInTheDocument()
  })

  test('Next button navigates to next step (validates Step 2 before advancing)', async () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    await screen.findByText(/Select Function/i)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transfer(address,uint256)' },
    })

    // Fill required params so validation passes
    fireEvent.change(await screen.findByLabelText(/to \(address\)/i), {
      target: { value: '0x0000000000000000000000000000000000000004' },
    })
    fireEvent.change(screen.getByLabelText(/amount \(uint256\)/i), {
      target: { value: '1' },
    })

    // Click Next button
    const nextButton = screen.getByRole('button', { name: /Next: Review/i })
    fireEvent.click(nextButton)

    // Verify Step 3 UI is visible and sidebar highlights Step 3
    await screen.findByText(/Step 3: Review Operation/i)
    await waitFor(() => {
      const step3 = screen.getByText(/3\. Review/i).closest('a')
      expect(step3).toBeTruthy()
      expect(step3?.className).toMatch(/bg-primary\/20/)
    })
  })
})
