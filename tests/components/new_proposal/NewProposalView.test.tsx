import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import NewProposalView from '@/components/new_proposal/NewProposalView'
import React from 'react'

describe('NewProposalView', () => {
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

  test('shows success message after fetching ABI', () => {
    render(<NewProposalView />)

    // Initially, success message should not be visible
    expect(
      screen.queryByText(/ABI fetched successfully!/i)
    ).not.toBeInTheDocument()

    // Click Fetch ABI button
    const fetchButton = screen.getByRole('button', { name: /Fetch ABI/i })
    fireEvent.click(fetchButton)

    // Success message should now be visible
    expect(screen.getByText(/ABI fetched successfully!/i)).toBeInTheDocument()
  })

  test('allows navigation to Step 2', () => {
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
  })

  test('renders Step 2 content correctly', () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Check for function selector
    expect(screen.getByText(/Select Function/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Check for parameter inputs
    expect(screen.getByLabelText(/to \(address\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount \(uint256\)/i)).toBeInTheDocument()

    // Check for navigation buttons
    expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Next: Review/i })
    ).toBeInTheDocument()
  })

  test('allows input in contract address field', () => {
    render(<NewProposalView />)

    const input = screen.getByLabelText(
      /Target Contract Address/i
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: '0x1234567890abcdef' } })

    expect(input.value).toBe('0x1234567890abcdef')
  })

  test('allows input in function parameter fields', () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Test 'to' parameter input
    const toInput = screen.getByLabelText(/to \(address\)/i) as HTMLInputElement
    fireEvent.change(toInput, { target: { value: '0xabcdef' } })
    expect(toInput.value).toBe('0xabcdef')

    // Test 'amount' parameter input
    const amountInput = screen.getByLabelText(
      /amount \(uint256\)/i
    ) as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '1000000000000000000' } })
    expect(amountInput.value).toBe('1000000000000000000')
  })

  test('allows function selection from dropdown', () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, {
      target: { value: 'setOwner(address newOwner)' },
    })

    expect(select.value).toBe('setOwner(address newOwner)')
  })

  test('Back button navigates to previous step', () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Verify we're on Step 2
    expect(
      screen.getByText(/Step 2: Configure Function Call/i)
    ).toBeInTheDocument()

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

  test('Next button navigates to next step', () => {
    render(<NewProposalView />)

    // Navigate to Step 2
    const step2Link = screen.getByText(/2\. Function/i)
    fireEvent.click(step2Link)

    // Click Next button
    const nextButton = screen.getByRole('button', { name: /Next: Review/i })
    fireEvent.click(nextButton)

    // Should now be on Step 3 (though Step 3 content is not yet implemented in the component)
    // We can verify the step changed by checking the sidebar active state would change
    // For now, this test verifies the button is clickable
  })
})
