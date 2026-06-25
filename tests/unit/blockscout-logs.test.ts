import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseTimestampSeconds,
  addressHash,
  toBigIntLike,
  toNumberLike,
  fetchAllItems,
} from '@/services/blockscout/logs'

function jsonResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    text: async () => JSON.stringify(obj),
  } as unknown as Response
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseTimestampSeconds', () => {
  it('parses ISO 8601 strings to unix seconds', () => {
    const iso = '2026-04-25T22:45:26.000000Z'
    const expected = BigInt(Math.floor(Date.parse(iso) / 1000))
    expect(parseTimestampSeconds(iso)).toBe(expected)
  })

  it('parses numeric strings and numbers', () => {
    expect(parseTimestampSeconds('1777157126')).toBe(BigInt(1777157126))
    expect(parseTimestampSeconds(1777157126)).toBe(BigInt(1777157126))
  })

  it('returns 0 for invalid input', () => {
    expect(parseTimestampSeconds('not-a-date')).toBe(BigInt(0))
    expect(parseTimestampSeconds(null)).toBe(BigInt(0))
    expect(parseTimestampSeconds(undefined)).toBe(BigInt(0))
  })
})

describe('addressHash', () => {
  it('extracts and lowercases the hash from a Blockscout address object', () => {
    expect(addressHash({ hash: '0xCd43D892Bd81d1E6249c040d764a5dbD754094C2' })).toBe(
      '0xcd43d892bd81d1e6249c040d764a5dbd754094c2'
    )
  })

  it('lowercases a plain string address', () => {
    expect(addressHash('0xABCD')).toBe('0xabcd')
  })

  it('returns null for empty/invalid input', () => {
    expect(addressHash(null)).toBeNull()
    expect(addressHash(undefined)).toBeNull()
    expect(addressHash({})).toBeNull()
  })
})

describe('numeric coercion helpers', () => {
  it('toBigIntLike handles strings, numbers, and garbage', () => {
    expect(toBigIntLike('123')).toBe(BigInt(123))
    expect(toBigIntLike(123)).toBe(BigInt(123))
    expect(toBigIntLike('nope')).toBeNull()
  })

  it('toNumberLike handles strings, numbers, and garbage', () => {
    expect(toNumberLike('5')).toBe(5)
    expect(toNumberLike(5)).toBe(5)
    expect(toNumberLike('nope')).toBeNull()
  })
})

describe('fetchAllItems pagination', () => {
  it('follows next_page_params across pages and concatenates items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ id: 1 }, { id: 2 }], next_page_params: { index: 2 } })
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ id: 3 }], next_page_params: null })
      )
    vi.stubGlobal('fetch', fetchMock)

    const items = await fetchAllItems('mainnet', 'addresses/0xabc/logs')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(items.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('stops after a single page when there is no next page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 1 }], next_page_params: null }))
    vi.stubGlobal('fetch', fetchMock)

    const items = await fetchAllItems('testnet', 'addresses/0xabc/logs')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(items).toHaveLength(1)
  })
})
