import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchSafeVerificationPayload } from '@/services/safe/client'

describe('fetchSafeVerificationPayload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('normalizes Safe Gateway responses into verification payload', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                safeTxHash:
                  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                transaction: { id: 'tx-123' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1.4.1+L2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            txData: {
              to: { value: '0x1111111111111111111111111111111111111111' },
              value: '0',
              hexData: '0x1234',
              operation: 1,
            },
            detailedExecutionInfo: {
              nonce: 9,
              safeTxGas: '1000',
              baseGas: '2000',
              gasPrice: '0',
              gasToken: '0x0000000000000000000000000000000000000000',
              refundReceiver: {
                value: '0x0000000000000000000000000000000000000000',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    const payload = await fetchSafeVerificationPayload(
      'mainnet',
      '0x1234567890abcdef1234567890abcdef12345678',
      '9'
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(payload.expectedSafeTxHash).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
    expect(payload.transaction.version).toBe('1.4.1')
    expect(payload.transaction.operation).toBe('1')
    expect(payload.transaction.chainId).toBe(30)
    expect(payload.transaction.nonce).toBe('9')
    expect(payload.transaction.data).toBe('0x1234')
  })

  test('throws when no transaction exists for the nonce', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(
      fetchSafeVerificationPayload(
        'mainnet',
        '0x1234567890abcdef1234567890abcdef12345678',
        '9'
      )
    ).rejects.toThrow('No Safe transaction found for that nonce.')
  })
})
