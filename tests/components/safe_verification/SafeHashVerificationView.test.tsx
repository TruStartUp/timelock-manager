import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import React from 'react'
import SafeHashVerificationView from '@/components/safe_verification/SafeHashVerificationView'

const mockCalculateSafeHashes = vi.fn()
const mockDecodeCalldata = vi.fn()
const mockGetContractABI = vi.fn()

vi.mock('wagmi', () => ({
  usePublicClient: () => undefined,
}))

vi.mock('@/lib/safeHash', () => ({
  calculateSafeHashes: (...args: unknown[]) => mockCalculateSafeHashes(...args),
}))

vi.mock('@/lib/decoder', () => ({
  decodeCalldata: (...args: unknown[]) => mockDecodeCalldata(...args),
}))

vi.mock('@/services/blockscout/abi', () => ({
  ABISource: {
    MANUAL: 'MANUAL',
    BLOCKSCOUT: 'BLOCKSCOUT',
    KNOWN_REGISTRY: 'KNOWN_REGISTRY',
    FOURBYTE: 'FOURBYTE',
  },
  ABIConfidence: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
  },
  getContractABI: (...args: unknown[]) => mockGetContractABI(...args),
}))

describe('SafeHashVerificationView', () => {
  beforeEach(() => {
    mockCalculateSafeHashes.mockReset()
    mockDecodeCalldata.mockReset()
    mockGetContractABI.mockReset()

    mockGetContractABI.mockResolvedValue({
      abi: [],
      source: 'BLOCKSCOUT',
      confidence: 'LOW',
    })
    mockDecodeCalldata.mockResolvedValue({
      selector: '0xa9059cbb',
      functionName: 'schedule',
      signature: 'schedule(address,uint256,bytes,bytes32,bytes32,uint256)',
      params: [{ name: 'target', type: 'address', value: '0x1111111111111111111111111111111111111111' }],
      source: 'FOURBYTE',
      confidence: 'LOW',
      warnings: [],
      children: [],
    })
  })

  test('renders API/manual controls and manual expected hash field', () => {
    render(<SafeHashVerificationView />)

    expect(
      screen.getByRole('heading', { name: /SAFE Hash Verification/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Safe API/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manual/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Manual/i }))

    expect(
      screen.getByText(/Expected SafeTxHash \(optional\)/i)
    ).toBeInTheDocument()
    expect(
      screen.getByTitle(/verification method help/i)
    ).toBeInTheDocument()
    expect(
      screen.getByTitle(/safe address help/i)
    ).toBeInTheDocument()
    expect(
      screen.getByTitle(/expected safetxhash \(optional\) help/i)
    ).toBeInTheDocument()
  })

  test('allows manual verification without an expected hash', async () => {
    mockCalculateSafeHashes.mockReturnValue({
      domainHash:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      messageHash:
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      safeTxHash:
        '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      encodedMessage: '0x',
    })

    render(<SafeHashVerificationView />)
    fireEvent.click(screen.getByRole('button', { name: /Manual/i }))

    fireEvent.change(screen.getByLabelText(/SAFE address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.change(screen.getByLabelText(/^Nonce$/i), {
      target: { value: '7' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }))

    expect(
      await screen.findByText(/Safe hash computed/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Hash mismatch detected/i)).not.toBeInTheDocument()
  })

  test('shows success state for a matching manual hash', async () => {
    mockCalculateSafeHashes.mockReturnValue({
      domainHash:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      messageHash:
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      safeTxHash:
        '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      encodedMessage: '0x',
    })

    render(<SafeHashVerificationView />)
    fireEvent.click(screen.getByRole('button', { name: /Manual/i }))

    fireEvent.change(screen.getByLabelText(/SAFE address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.change(screen.getByLabelText(/^Nonce$/i), {
      target: { value: '7' },
    })
    fireEvent.change(screen.getByLabelText(/^Data$/i), {
      target: { value: '0xa9059cbb0000000000000000000000000000000000000000000000000000000000000000' },
    })
    fireEvent.change(screen.getByLabelText(/Expected SafeTxHash \(optional\)/i), {
      target: {
        value:
          '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }))

    expect(
      await screen.findByText(/Hash verified successfully/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Decoded target call/i)).toBeInTheDocument()
    expect(screen.getAllByText(/schedule/i).length).toBeGreaterThan(0)
  })

  test('shows mismatch state and decode fallback message', async () => {
    mockCalculateSafeHashes.mockReturnValue({
      domainHash:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      messageHash:
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      safeTxHash:
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      encodedMessage: '0x',
    })
    mockDecodeCalldata.mockRejectedValue(new Error('decode failed'))

    render(<SafeHashVerificationView />)
    fireEvent.click(screen.getByRole('button', { name: /Manual/i }))

    fireEvent.change(screen.getByLabelText(/SAFE address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.change(screen.getByLabelText(/^Nonce$/i), {
      target: { value: '7' },
    })
    fireEvent.change(screen.getByLabelText(/^Data$/i), {
      target: { value: '0xa9059cbb0000000000000000000000000000000000000000000000000000000000000000' },
    })
    fireEvent.change(screen.getByLabelText(/Expected SafeTxHash \(optional\)/i), {
      target: {
        value:
          '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }))

    expect(
      await screen.findByText(/Hash mismatch detected/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/decode failed/i)
    ).toBeInTheDocument()
  })
})
