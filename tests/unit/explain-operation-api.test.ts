/**
 * Unit tests for the explain_operation API.
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/explain_operation'

function createMockRes(): NextApiResponse & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    setHeader: vi.fn(function (this: NextApiResponse) {
      return this
    }),
    json(body: unknown) {
      this.body = body
      return this
    },
  }

  return res as NextApiResponse & { statusCode: number; body: unknown }
}

function createReq(body: unknown, method = 'POST'): NextApiRequest {
  return { method, body } as NextApiRequest
}

const VALID_BODY = {
  chainId: 30,
  operationId:
    '0xab1234567890abcdef1234567890abcdef1234567890abcdef1234567890c456',
  calls: [
    {
      index: 0,
      target: '0x1234567890abcdef1234567890abcdef1234a7b8',
      nativeValue: '1.5 RBTC',
      signature: 'transfer(address,uint256)',
      functionName: 'transfer',
      params: [
        {
          name: 'to',
          type: 'address',
          value: '0x4567890abcdef1234567890abcdef1234567890a',
        },
        {
          name: 'amount',
          type: 'uint256',
          value: '1500000000000000000',
          display: '1.5 RBTC',
        },
      ],
    },
  ],
}

describe('explain_operation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('returns 405 for non-POST requests', async () => {
    const req = createReq(null, 'GET')
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ error: 'Method not allowed' })
  })

  it('returns 400 when calls are missing', async () => {
    const req = createReq({ chainId: 30, calls: [] })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Missing calls' })
  })

  it('returns summary and per-call output for valid requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            output_text: JSON.stringify({
              summary:
                'This operation transfers 1.5 RBTC to the destination address.',
              perCall: ['Call 1 transfers 1.5 RBTC to the specified recipient.'],
            }),
          }),
      })
    )

    const req = createReq(VALID_BODY)
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      summary: 'This operation transfers 1.5 RBTC to the destination address.',
      perCall: ['Call 1 transfers 1.5 RBTC to the specified recipient.'],
      cacheHit: false,
    })
  })

  it('returns a safe upstream error when the OpenAI request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      })
    )

    const req = createReq({
      ...VALID_BODY,
      fingerprint: 'test-upstream-error-fingerprint',
      operationId:
        '0xbb1234567890abcdef1234567890abcdef1234567890abcdef1234567890c456',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({
      error: 'OpenAI request failed',
      status: 502,
      message: 'bad gateway',
    })
  })

  it('serves cached responses on repeated fingerprints', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            summary: 'Cached summary',
            perCall: ['Cached call'],
          }),
        }),
    })
    vi.stubGlobal('fetch', upstreamFetch)

    const body = {
      ...VALID_BODY,
      fingerprint: 'test-cache-hit-fingerprint',
      operationId:
        '0xcc1234567890abcdef1234567890abcdef1234567890abcdef1234567890c456',
    }

    const req1 = createReq(body)
    const res1 = createMockRes()
    await handler(req1, res1)
    expect(res1.statusCode).toBe(200)
    expect((res1.body as any).cacheHit).toBe(false)

    const req2 = createReq(body)
    const res2 = createMockRes()
    await handler(req2, res2)
    expect(res2.statusCode).toBe(200)
    expect((res2.body as any).cacheHit).toBe(true)
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
  })
})
