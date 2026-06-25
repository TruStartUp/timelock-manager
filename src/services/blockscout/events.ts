/**
 * Blockscout Events Fallback
 *
 * Derives the operation list from TimelockController event logs on Blockscout v2
 * when no subgraph is configured. Paginates fully, reconstructs batch operations,
 * and resolves proposer/executor/canceller from transaction senders.
 */

import { decodeEventLog, type Address, type Hex } from 'viem'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { type Operation, type Call, type OperationStatus } from '@/types/operation'
import { type BlockscoutNetwork, CHAIN_TO_NETWORK } from './client'
import {
  MAX_PAGES,
  PAGE_DELAY_MS,
  sleep,
  toHexTopicArray,
  toHexData,
  toNumberLike,
  toBigIntLike,
  parseTimestampSeconds,
  addressHash,
  fetchJson,
  fetchAllItems,
} from './logs'

const ABI = TimelockControllerABI as any

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const ZERO = BigInt(0)
const ONE = BigInt(1)
const INDEX_MULTIPLIER = BigInt(1000000)

type CallAcc = { index: number; target: Address; value: bigint; data: Hex }

type OperationAcc = {
  calls: Map<number, CallAcc>
  predecessor: Hex
  delay: bigint
  salt: Hex
  scheduledAt: bigint
  scheduledTx: Hex
  sortIndex: bigint
  hasScheduled: boolean
  executedAt: bigint | null
  executedTx: Hex | null
  cancelledAt: bigint | null
  cancelledTx: Hex | null
}

function newAcc(): OperationAcc {
  return {
    calls: new Map(),
    predecessor: ZERO_BYTES32,
    delay: ZERO,
    salt: ZERO_BYTES32,
    scheduledAt: ZERO,
    scheduledTx: ZERO_BYTES32,
    sortIndex: ZERO,
    hasScheduled: false,
    executedAt: null,
    executedTx: null,
    cancelledAt: null,
    cancelledTx: null,
  }
}

async function fetchTxFromMap(
  network: BlockscoutNetwork,
  timelock: Address,
  needed: Set<string>
): Promise<Map<string, `0x${string}`>> {
  const map = new Map<string, `0x${string}`>()
  if (needed.size === 0) return map

  const remaining = new Set(Array.from(needed).map((h) => h.toLowerCase()))
  let pageParams: Record<string, string | number> = {}

  for (let page = 0; page < MAX_PAGES && remaining.size > 0; page++) {
    const payload = await fetchJson(network, `addresses/${timelock}/transactions`, pageParams)
    const items = Array.isArray(payload?.items) ? payload.items : []
    for (const it of items) {
      const hash = String(it?.hash || '').toLowerCase()
      if (!hash) continue
      const from = addressHash(it?.from)
      if (from) {
        map.set(hash, from)
        remaining.delete(hash)
      }
    }
    const next = payload?.next_page_params
    if (!next || typeof next !== 'object' || remaining.size === 0) break
    pageParams = next
    await sleep(PAGE_DELAY_MS)
  }

  // Ops scheduled through another contract (e.g. a governor) don't appear in the
  // timelock's address tx list; resolve those senders one by one.
  for (const hash of Array.from(remaining)) {
    try {
      const tx = await fetchJson(network, `transactions/${hash}`)
      const from = addressHash(tx?.from)
      if (from) map.set(hash, from)
    } catch {
      // best-effort
    }
  }

  return map
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

  const tlLower = timelockController.toLowerCase() as `0x${string}`
  const logs = await fetchAllItems(network, `addresses/${timelockController}/logs`)

  const accs = new Map<string, OperationAcc>()
  const getAcc = (id: string) => {
    let acc = accs.get(id)
    if (!acc) {
      acc = newAcc()
      accs.set(id, acc)
    }
    return acc
  }

  for (const item of logs) {
    const topics = toHexTopicArray(item?.topics)
    if (topics.length === 0) continue
    const data = toHexData(item?.data)

    const txHash = (item?.transaction_hash ?? item?.tx_hash ?? ZERO_BYTES32) as Hex
    const blockNumber = toBigIntLike(item?.block_number ?? item?.blockNumber) ?? ZERO
    const logIndex = BigInt(toNumberLike(item?.index ?? item?.log_index) ?? 0)
    const sortIndex = blockNumber * INDEX_MULTIPLIER + logIndex
    const ts = parseTimestampSeconds(item?.block_timestamp ?? item?.timestamp)

    let decoded: any
    try {
      decoded = decodeEventLog({ abi: ABI, data, topics: topics as any })
    } catch {
      continue
    }

    const args = decoded?.args as any
    const opId = args?.id ? String(args.id).toLowerCase() : null
    if (!opId) continue
    const acc = getAcc(opId)

    switch (decoded.eventName) {
      case 'CallScheduled': {
        const callIndex = Number(args.index ?? 0)
        acc.calls.set(callIndex, {
          index: callIndex,
          target: String(args.target).toLowerCase() as Address,
          value: BigInt(args.value ?? 0),
          data: String(args.data) as Hex,
        })
        acc.predecessor = String(args.predecessor) as Hex
        acc.delay = BigInt(args.delay ?? 0)
        if (!acc.hasScheduled) {
          acc.scheduledAt = ts
          acc.scheduledTx = txHash
          acc.sortIndex = sortIndex
          acc.hasScheduled = true
        }
        break
      }
      case 'CallSalt':
        acc.salt = String(args.salt) as Hex
        break
      case 'CallExecuted':
        acc.executedAt = ts > ZERO ? ts : ONE
        acc.executedTx = txHash
        break
      case 'Cancelled':
        acc.cancelledAt = ts > ZERO ? ts : ONE
        acc.cancelledTx = txHash
        break
    }
  }

  const targetLower = target?.toLowerCase()
  let operations: Operation[] = []

  for (const [opId, acc] of Array.from(accs.entries())) {
    if (!acc.hasScheduled) continue

    const sortedCalls = Array.from(acc.calls.values()).sort((a, b) => a.index - b.index)
    const isBatch = sortedCalls.length > 1

    if (targetLower) {
      const matches = sortedCalls.some((c) => c.target.toLowerCase() === targetLower)
      if (!matches) continue
    }

    const opStatus: OperationStatus = acc.cancelledAt
      ? 'CANCELLED'
      : acc.executedAt
        ? 'EXECUTED'
        : 'PENDING'

    const calls: Call[] | undefined = isBatch
      ? sortedCalls.map((c) => ({
          id: `${opId}-${c.index}`,
          operation: opId,
          index: c.index,
          target: c.target,
          value: c.value,
          data: c.data,
          signature: null,
        }))
      : undefined

    const single = sortedCalls[0]

    operations.push({
      id: opId as `0x${string}`,
      index: acc.sortIndex,
      timelockController: tlLower,
      target: isBatch ? null : (single?.target ?? null),
      value: isBatch ? null : (single?.value ?? null),
      data: isBatch ? null : (single?.data ?? null),
      predecessor: acc.predecessor,
      salt: acc.salt,
      delay: acc.delay,
      timestamp: acc.scheduledAt > ZERO ? acc.scheduledAt + acc.delay : ZERO,
      status: opStatus,
      scheduledAt: acc.scheduledAt,
      scheduledTx: acc.scheduledTx,
      scheduledBy: ZERO_ADDRESS,
      executedAt: acc.executedAt,
      executedTx: acc.executedTx,
      executedBy: null,
      cancelledAt: acc.cancelledAt,
      cancelledTx: acc.cancelledTx,
      cancelledBy: null,
      calls,
    })
  }

  if (status) {
    if (status === 'EXECUTED' || status === 'CANCELLED') {
      operations = operations.filter((o) => o.status === status)
    } else {
      operations = operations.filter((o) => o.status !== 'EXECUTED' && o.status !== 'CANCELLED')
    }
  }

  operations.sort((a, b) => (a.index > b.index ? -1 : a.index < b.index ? 1 : 0))
  operations = operations.slice(0, limit)

  const neededTxs = new Set<string>()
  for (const op of operations) {
    if (op.scheduledTx && op.scheduledTx !== ZERO_BYTES32) neededTxs.add(op.scheduledTx)
    if (op.executedTx) neededTxs.add(op.executedTx)
    if (op.cancelledTx) neededTxs.add(op.cancelledTx)
  }

  const fromMap = await fetchTxFromMap(network, timelockController, neededTxs)
  for (const op of operations) {
    const scheduledFrom = fromMap.get(op.scheduledTx.toLowerCase())
    if (scheduledFrom) op.scheduledBy = scheduledFrom
    if (op.executedTx) {
      const executedFrom = fromMap.get(op.executedTx.toLowerCase())
      if (executedFrom) op.executedBy = executedFrom
    }
    if (op.cancelledTx) {
      const cancelledFrom = fromMap.get(op.cancelledTx.toLowerCase())
      if (cancelledFrom) op.cancelledBy = cancelledFrom
    }
  }

  return operations
}
