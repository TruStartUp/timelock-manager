/**
 * Shared Blockscout v2 HTTP + log parsing helpers.
 */

import { type Hex } from 'viem'
import { type BlockscoutNetwork } from './client'

export const BLOCKSCOUT_V2_API_BASE: Record<BlockscoutNetwork, string> = {
  mainnet: 'https://rootstock.blockscout.com/api/v2',
  testnet: 'https://rootstock-testnet.blockscout.com/api/v2',
} as const

export const MAX_PAGES = 50
export const PAGE_DELAY_MS = 120

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function toHexTopicArray(topics: unknown): Hex[] {
  if (!Array.isArray(topics)) return []
  return topics
    .filter((t) => typeof t === 'string')
    .map((t) => (t.startsWith('0x') ? t : `0x${t}`) as Hex)
}

export function toHexData(data: unknown): Hex {
  if (typeof data !== 'string') return '0x' as Hex
  return (data.startsWith('0x') ? data : `0x${data}`) as Hex
}

export function toNumberLike(n: unknown): number | null {
  if (typeof n === 'number') return Number.isFinite(n) ? n : null
  if (typeof n === 'string') {
    const parsed = Number(n)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function toBigIntLike(n: unknown): bigint | null {
  if (typeof n === 'bigint') return n
  if (typeof n === 'number' && Number.isFinite(n)) return BigInt(Math.floor(n))
  if (typeof n === 'string') {
    try {
      return BigInt(n)
    } catch {
      return null
    }
  }
  return null
}

export function parseTimestampSeconds(raw: unknown): bigint {
  if (raw == null) return BigInt(0)
  if (typeof raw === 'number' && Number.isFinite(raw)) return BigInt(Math.floor(raw))
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (/^\d+$/.test(trimmed)) return BigInt(trimmed)
    const ms = Date.parse(trimmed)
    if (Number.isFinite(ms)) return BigInt(Math.floor(ms / 1000))
  }
  return BigInt(0)
}

export function addressHash(v: unknown): `0x${string}` | null {
  if (!v) return null
  if (typeof v === 'string') return v.toLowerCase() as `0x${string}`
  if (typeof v === 'object' && typeof (v as any).hash === 'string') {
    return (v as any).hash.toLowerCase() as `0x${string}`
  }
  return null
}

export async function fetchJson(
  network: BlockscoutNetwork,
  path: string,
  query: Record<string, string | number | undefined> = {},
  timeoutMs = 10_000
): Promise<any> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const url = new URL(`${BLOCKSCOUT_V2_API_BASE[network]}/${path.replace(/^\//, '')}`)
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (res.status === 429 && attempt < 3) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt)
        continue
      }

      const text = await res.text()
      if (!res.ok) {
        throw new Error(`Blockscout request failed (${res.status}): ${text || res.statusText}`)
      }
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }
  throw new Error('Blockscout request failed after retries')
}

export async function fetchAllItems(
  network: BlockscoutNetwork,
  path: string,
  shouldStop?: (items: any[]) => boolean
): Promise<any[]> {
  const items: any[] = []
  let pageParams: Record<string, string | number> = {}

  for (let page = 0; page < MAX_PAGES; page++) {
    const payload = await fetchJson(network, path, pageParams)
    const pageItems = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : []
    items.push(...pageItems)

    if (shouldStop && shouldStop(items)) break

    const next = payload?.next_page_params
    if (!next || typeof next !== 'object') break
    pageParams = next
    await sleep(PAGE_DELAY_MS)
  }

  return items
}
