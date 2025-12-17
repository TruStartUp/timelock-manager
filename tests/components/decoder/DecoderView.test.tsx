import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, describe, vi } from 'vitest'
import DecoderView from '@/components/decoder/DecoderView'
import React from 'react'

vi.mock('wagmi', () => ({
  useChainId: () => 31,
  usePublicClient: () => ({ request: vi.fn() }),
}))

vi.mock('@/hooks/useContractABI', () => ({
  useContractABI: () => ({
    abi: null,
    source: null,
    confidence: null,
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/lib/decoder', () => ({
  decodeCalldata: vi.fn(async () => ({
    selector: '0xa9059cbb',
    functionName: 'transfer',
    signature: 'transfer(address to,uint256 amount)',
    params: [
      {
        name: 'to',
        type: 'address',
        value: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      },
      { name: 'amount', type: 'uint256', value: 1000000000000000000n },
    ],
    source: 'BLOCKSCOUT',
    confidence: 'HIGH',
    warnings: [],
    children: [],
  })),
}))

describe('DecoderView', () => {
  test('renders decoder elements correctly', () => {
    render(<DecoderView />)

    // Check for the main heading
    expect(
      screen.getByRole('heading', { name: /Calldata Decoder/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Decode arbitrary calldata or transaction hashes from the Rootstock network/i
      )
    ).toBeInTheDocument()

    // Check for Input section
    expect(
      screen.getByRole('heading', { name: /^Input$/i })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Calldata \(0x\.\.\.\)/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Contract Address \(Optional\)/i)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Contract ABI \(JSON, Optional\)/i)
    ).toBeInTheDocument()

    // Check for action buttons
    expect(screen.getByRole('button', { name: /Decode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()

    // Check for Output section
    expect(
      screen.getByRole('heading', { name: /^Output$/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Awaiting input to decode/i)).toBeInTheDocument()
  })

  test('renders input fields with correct placeholders', () => {
    render(<DecoderView />)

    // Check placeholders for better UX validation
    expect(
      screen.getByPlaceholderText(/Paste raw hexadecimal calldata here\.\.\./i)
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/^0x\.\.\.$/i)).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/Paste contract ABI JSON here\.\.\./i)
    ).toBeInTheDocument()
  })

  test('decodes calldata and renders decoded output', async () => {
    render(<DecoderView />)

    const textarea = screen.getByLabelText(/Calldata \(0x\.\.\.\)/i)
    const decodeButton = screen.getByRole('button', { name: /Decode/i })

    // Minimal ERC20 transfer calldata shape: selector + 32-byte padded args (dummy)
    fireEvent.change(textarea, {
      target: { value: '0xa9059cbb' + '0'.repeat(128) },
    })

    fireEvent.click(decodeButton)

    expect(
      await screen.findByRole('heading', { name: /Decoded Function/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/transfer/i)).toBeInTheDocument()
    expect(screen.getAllByText(/0xa9059cbb/i).length).toBeGreaterThan(0)

    expect(screen.getAllByText(/^to$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^amount$/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/1000000000000000000/i)).toBeInTheDocument()
  })
})
