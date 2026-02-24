/**
 * Unit tests for the Deploy Timelock compile API.
 * Ensures validation, artifact loading, and encodeDeployData output are correct.
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler, { __resetCompileCacheForTests } from '@/pages/api/deploy-timelock/compile'

const CONSTRUCTOR_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'minDelay', type: 'uint256' },
      { internalType: 'address[]', name: 'proposers', type: 'address[]' },
      { internalType: 'address[]', name: 'executors', type: 'address[]' },
      { internalType: 'address', name: 'admin', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
] as const

/** Minimal valid artifact: bytecode (hex) + abi with constructor. */
const MOCK_ARTIFACT = {
  bytecode:
    '0x6080604052348015600f57600080fd5b5060008060006000806000806000808888f15060808060405260043610605e5760003560e01c80630b61fe6c146063578063' +
    '7e4d7a1c14607d5780639852c43b14609b578063a0a8e4601460b9575b600080fd5b607b6004803603810190605f919060c7565b565b005b609960048036038101906095919060c7565b565b005b60b7600480360381019060b3919060c7565b565b005b60c1600480360381019060bd919060c7565b565b005b600080fd5b600080fd5b600080fd5b600080fd5b50565b600060c78260cf565b9050919050565b600081905091905056',
  abi: CONSTRUCTOR_ABI,
}

const mockReadFile = vi.fn()
vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

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
  minDelay: 86400,
  proposers: ['0x742d35cc6634c0532925a3b844bc9e7595f0beb0'],
  executors: ['0x0000000000000000000000000000000000000000'],
  admin: '0x0000000000000000000000000000000000000000',
}

describe('Deploy Timelock compile API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_ARTIFACT))
    __resetCompileCacheForTests()
  })

  describe('validation', () => {
    it('returns 405 for GET', async () => {
      const req = createReq(null, 'GET')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(res.body).toEqual({ error: 'Method not allowed' })
    })

    it('returns 400 when body is missing', async () => {
      const req = createReq(undefined)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect((res.body as { error?: string })?.error).toContain('Request body')
    })

    it('returns 400 when minDelay is negative', async () => {
      const req = createReq({ ...VALID_BODY, minDelay: -1 })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect((res.body as { error?: string })?.error).toMatch(/minDelay/i)
    })

    it('returns 400 when proposers is empty', async () => {
      const req = createReq({ ...VALID_BODY, proposers: [] })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect((res.body as { error?: string })?.error).toMatch(/proposers/i)
    })

    it('returns 400 when proposers contains invalid address', async () => {
      const req = createReq({ ...VALID_BODY, proposers: ['not-an-address'] })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect((res.body as { error?: string })?.error).toMatch(/proposers|address/i)
    })

    it('returns 400 when executors is empty', async () => {
      const req = createReq({ ...VALID_BODY, executors: [] })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect((res.body as { error?: string })?.error).toMatch(/executors/i)
    })
  })

  describe('compilation output', () => {
    it('returns 200 and valid deploy data when artifact is available', async () => {
      const req = createReq(VALID_BODY)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const data = (res.body as { data?: string })?.data
      expect(typeof data).toBe('string')
      expect(data).toMatch(/^0x[0-9a-fA-F]+$/)
      expect((data as string).length).toBeGreaterThan(100)
    })

    it('returns deploy data that starts with artifact bytecode', async () => {
      const req = createReq(VALID_BODY)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const data = (res.body as { data?: string })?.data as string
      expect(data.startsWith(MOCK_ARTIFACT.bytecode)).toBe(true)
    })

    it('accepts admin as empty string (zero address)', async () => {
      const req = createReq({ ...VALID_BODY, admin: '' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect((res.body as { data?: string })?.data).toMatch(/^0x[0-9a-fA-F]+$/)
    })
  })
})
