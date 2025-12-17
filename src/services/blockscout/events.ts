/**
 * Blockscout Events Fallback
 *
 * When the subgraph is unavailable, we can derive a best-effort operation list by
 * reading TimelockController event logs from Blockscout v2.
 *
 * Notes:
 * - This is intentionally best-effort. It supports single-call operations well.
 * - READY vs PENDING requires contract timestamp checks; we leave that to the existing
 *   `useOperationStatus` hook (RPC) which can work without the subgraph.
 */

import { decodeEventLog, type Address, type Hex } from 'viem'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { type Operation, type OperationStatus } from '@/types/operation'
import { type BlockscoutNetwork, CHAIN_TO_NETWORK } from './client'

const ABI = TimelockControllerABI as any

const BLOCKSCOUT_V2_API_BASE: Record<BlockscoutNetwork, string> = {
  mainnet: 'https://rootstock.blockscout.com/api/v2',
  testnet: 'https://rootstock-testnet.blockscout.com/api/v2',
} as const

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const ONE = BigInt(1)
const ZERO = BigInt(0)
const INDEX_MULTIPLIER = BigInt(1000000)

type BlockscoutLogItem = {
  address?: string
  contract_address?: string
  transaction_hash?: string
  tx_hash?: string
  block_number?: string | number
  blockNumber?: string | number
  block_timestamp?: string | number
  timestamp?: string | number
  index?: string | number
  log_index?: string | number
  data?: string
  topics?: string[]
}

function toHexTopicArray(topics: unknown): Hex[] {
  if (!Array.isArray(topics)) return []
  return topics
    .filter((t) => typeof t === 'string')
    .map((t) => (t.startsWith('0x') ? t : `0x${t}`) as Hex)
}

function toHexData(data: unknown): Hex {
  if (typeof data !== 'string') return '0x' as Hex
  return (data.startsWith('0x') ? data : `0x${data}`) as Hex
}

function toNumberLike(n: unknown): number | null {
  if (typeof n === 'number') return Number.isFinite(n) ? n : null
  if (typeof n === 'string') {
    const parsed = Number(n)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toBigIntLike(n: unknown): bigint | null {
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

async function fetchBlockscoutJson(
  network: BlockscoutNetwork,
  path: string,
  query: Record<string, string | number | undefined> = {},
  timeoutMs = 10_000
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const normalizedPath = path.replace(/^\//, '')
    const url =
      typeof window !== 'undefined'
        ? new URL(`/api/blockscout/${network}/${normalizedPath}`, window.location.origin)
        : new URL(`${BLOCKSCOUT_V2_API_BASE[network]}/${normalizedPath}`)

    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue
      url.searchParams.set(k, String(v))
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(
        `Blockscout request failed (${res.status}): ${text || res.statusText}`
      )
    }

    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function extractItems(payload: unknown): BlockscoutLogItem[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload as BlockscoutLogItem[]
  if (typeof payload === 'object' && payload !== null) {
    const anyPayload = payload as any
    if (Array.isArray(anyPayload.items)) return anyPayload.items as BlockscoutLogItem[]
    if (Array.isArray(anyPayload.result)) return anyPayload.result as BlockscoutLogItem[]
  }
  return []
}

async function fetchTimelockLogs(params: {
  network: BlockscoutNetwork
  timelock: Address
  topic0?: Hex
  limit?: number
}): Promise<BlockscoutLogItem[]> {
  const { network, timelock, topic0, limit = 200 } = params

  // Blockscout v2 commonly exposes logs under `/addresses/:address/logs`.
  // We try with `topic0` filter first; if rejected, retry without and filter client-side.
  const path = `addresses/${timelock}/logs`

  try {
    const payload = await fetchBlockscoutJson(
      network,
      path,
      {
        topic0,
        // Conservative page size; exact param name varies across deployments.
        // `items_count` is used by many Blockscout v2 endpoints.
        items_count: limit,
      },
      10_000
    )
    const items = extractItems(payload)
    if (topic0) {
      // If server ignored topic filter, enforce client-side anyway.
      return items.filter((i) => toHexTopicArray(i.topics)[0] === topic0)
    }
    return items
  } catch {
    const payload = await fetchBlockscoutJson(
      network,
      path,
      { items_count: limit },
      10_000
    )
    const items = extractItems(payload)
    if (topic0) {
      return items.filter((i) => toHexTopicArray(i.topics)[0] === topic0)
    }
    return items
  }
}

function parseTimestampSeconds(item: BlockscoutLogItem): bigint {
  const ts =
    toBigIntLike(item.block_timestamp) ??
    toBigIntLike(item.timestamp) ??
    null
  return ts ?? ZERO
}

export async function fetchOperationsFromBlockscoutEvents(params: {
  chainId: number
  timelockController: Address
  status?: OperationStatus
  target?: Address
  limit?: number
}): Promise<Operation[]> {
  const { chainId, timelockController, status, target, limit = 200 } = params
  const network = CHAIN_TO_NETWORK[chainId] as BlockscoutNetwork | undefined
  if (!network) {
    throw new Error(`Unsupported chainId for Blockscout fallback: ${chainId}`)
  }

  // We fetch all logs for the timelock address and decode relevant events client-side.
  // This is more robust across Blockscout deployments than relying on topic filters.
  const logs = await fetchTimelockLogs({
    network,
    timelock: timelockController,
    limit,
  })

  // Decode logs by attempting known event decodes. This avoids relying on exact topic0 filtering.
  const operations = new Map<string, Operation>()

  for (const item of logs) {
    const address = (item.address ?? item.contract_address ?? timelockController) as Address
    const topics = toHexTopicArray(item.topics)
    const data = toHexData(item.data)
    if (topics.length === 0) continue

    const txHash = (item.transaction_hash ?? item.tx_hash ?? '') as `0x${string}`
    const blockNumber = toBigIntLike(item.block_number ?? item.blockNumber) ?? ZERO
    const logIndex = BigInt(toNumberLike(item.index ?? item.log_index) ?? 0)
    const index = blockNumber * INDEX_MULTIPLIER + logIndex
    const ts = parseTimestampSeconds(item)

    // Try each relevant Timelock event. `decodeEventLog` will throw if it doesn't match.
    try {
      const decoded = decodeEventLog({
        abi: ABI as any,
        data,
        topics: topics as any,
      }) as any

      if (decoded.eventName === 'CallScheduled') {
        const { id, target: callTarget, value, data: calldata, predecessor, delay } =
          decoded.args as any

        const opId = (id as string).toLowerCase()
        const targetLower = target?.toLowerCase()

        // For batch ops, multiple CallScheduled share the same id with different index values.
        // We keep the first-seen call (usually index=0) as the single-call surface fields,
        // but we do not attempt to fully reconstruct batch parameters here.
        const existing = operations.get(opId)
        const shouldSkipByTarget =
          Boolean(targetLower) &&
          String(callTarget).toLowerCase() !== targetLower
        if (shouldSkipByTarget) continue

        const base: Operation = existing ?? {
          id: opId as `0x${string}`,
          index,
          timelockController: timelockController.toLowerCase() as `0x${string}`,
          target: (callTarget as string).toLowerCase() as `0x${string}`,
          value: BigInt(value as any),
          data: (calldata as string) as `0x${string}`,
          predecessor: (predecessor as string) as `0x${string}`,
          salt: ZERO_BYTES32,
          delay: BigInt(delay as any),
          timestamp: ZERO,
          status: 'PENDING',
          scheduledAt: ts,
          scheduledTx: txHash || (ZERO_BYTES32 as any),
          scheduledBy: ZERO_ADDRESS,
          executedAt: null,
          executedTx: null,
          executedBy: null,
          cancelledAt: null,
          cancelledTx: null,
          cancelledBy: null,
        }

        // Keep the most recent index for sorting (newer logs win)
        if (index > base.index) base.index = index
        // Preserve single-call fields only if we don't already have them
        if (!existing) {
          operations.set(opId, base)
        }
        continue
      }

      if (decoded.eventName === 'CallSalt') {
        const { id, salt } = decoded.args as any
        const opId = (id as string).toLowerCase()
        const existing = operations.get(opId)
        if (existing) {
          existing.salt = (salt as string) as `0x${string}`
          operations.set(opId, existing)
        } else {
          // If salt arrives before CallScheduled in our limited window, stash a minimal record.
          operations.set(opId, {
            id: opId as `0x${string}`,
            index,
            timelockController: timelockController.toLowerCase() as `0x${string}`,
            target: null,
            value: null,
            data: null,
            predecessor: ZERO_BYTES32,
            salt: (salt as string) as `0x${string}`,
            delay: ZERO,
            timestamp: ZERO,
            status: 'PENDING',
            scheduledAt: ZERO,
            scheduledTx: (txHash || ZERO_BYTES32) as any,
            scheduledBy: ZERO_ADDRESS,
            executedAt: null,
            executedTx: null,
            executedBy: null,
            cancelledAt: null,
            cancelledTx: null,
            cancelledBy: null,
          })
        }
        continue
      }

      if (decoded.eventName === 'Cancelled') {
        const { id } = decoded.args as any
        const opId = (id as string).toLowerCase()
        const existing = operations.get(opId)
        if (existing) {
          existing.cancelledAt = ts && ts > ZERO ? ts : ONE
          existing.cancelledTx = txHash || (ZERO_BYTES32 as any)
          existing.status = 'CANCELLED'
          operations.set(opId, existing)
        }
        continue
      }

      if (decoded.eventName === 'CallExecuted') {
        const { id } = decoded.args as any
        const opId = (id as string).toLowerCase()
        const existing = operations.get(opId)
        if (existing) {
          existing.executedAt = ts && ts > ZERO ? ts : ONE
          existing.executedTx = txHash || (ZERO_BYTES32 as any)
          existing.status = 'EXECUTED'
          operations.set(opId, existing)
        }
        continue
      }
    } catch {
      // ignore unrelated logs
    }
  }

  let list = Array.from(operations.values())

  // Best-effort filtering.
  if (status) {
    if (status === 'EXECUTED' || status === 'CANCELLED') {
      list = list.filter((o) => o.status === status)
    } else {
      // READY vs PENDING requires contract checks; treat both as "not final".
      list = list.filter((o) => o.status !== 'EXECUTED' && o.status !== 'CANCELLED')
    }
  }

  // Sort newest first by our computed subgraph-like index.
  list.sort((a, b) => (a.index > b.index ? -1 : a.index < b.index ? 1 : 0))

  // Apply limit.
  return list.slice(0, limit)
}


