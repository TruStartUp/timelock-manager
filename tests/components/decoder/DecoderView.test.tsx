import { render, screen } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import DecoderView from '@/components/decoder/DecoderView'
import React from 'react'

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
    expect(
      screen.getByRole('heading', { name: /Decoded Function/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Verified/i)).toBeInTheDocument()

    // Check for function display elements - using getAllByText for non-unique text
    const functionLabels = screen.getAllByText(/Function/i)
    expect(functionLabels.length).toBeGreaterThan(0)
    const signatureLabels = screen.getAllByText(/Signature/i)
    expect(signatureLabels.length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { name: /Parameters/i })
    ).toBeInTheDocument()
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

  test('renders example decoded output', () => {
    render(<DecoderView />)

    // Check for example function name
    expect(screen.getByText(/transfer/i)).toBeInTheDocument()

    // Check for example signature
    expect(screen.getByText(/0xa9059cbb/i)).toBeInTheDocument()

    // Check for example parameters - multiple instances may exist
    const toParams = screen.getAllByText(/^to$/i)
    expect(toParams.length).toBeGreaterThan(0)
    const amountParams = screen.getAllByText(/^amount$/i)
    expect(amountParams.length).toBeGreaterThan(0)
    expect(
      screen.getByText(/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/1000000000000000000/i)).toBeInTheDocument()
  })
})
