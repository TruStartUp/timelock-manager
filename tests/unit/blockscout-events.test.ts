import { describe, it, expect, vi, afterEach } from 'vitest'
import { encodeEventTopics, encodeAbiParameters } from 'viem'
import ABI from '@/lib/abis/TimelockController.json'
import { fetchOperationsFromBlockscoutEvents } from '@/services/blockscout/events'

const abi = ABI as any

function findEvent(name: string) {
  return abi.find((x: any) => x.type === 'event' && x.name === name)
}

function makeLog(opts: {
  eventName: string
  args: Record<string, unknown>
  blockNumber: number
  timestamp: string
  txHash: string
  logIndex: number
}) {
  const ev = findEvent(opts.eventName)
  const topics = encodeEventTopics({ abi, eventName: opts.eventName, args: opts.args as any })
  const nonIndexed = ev.inputs.filter((i: any) => !i.indexed)
  const data =
    nonIndexed.length > 0
      ? encodeAbiParameters(
          nonIndexed,
          nonIndexed.map((i: any) => opts.args[i.name])
        )
      : '0x'
  return {
    topics,
    data,
    block_number: opts.blockNumber,
    block_timestamp: opts.timestamp,
    index: opts.logIndex,
    transaction_hash: opts.txHash,
  }
}

function jsonResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    text: async () => JSON.stringify(obj),
  } as unknown as Response
}

const ID1 = ('0x' + '11'.repeat(32)) as `0x${string}`
const ID2 = ('0x' + '22'.repeat(32)) as `0x${string}`
const T1 = '0x0000000000000000000000000000000000000001'
const T2 = '0x0000000000000000000000000000000000000002'
const ZERO32 = ('0x' + '00'.repeat(32)) as `0x${string}`
const TX1 = ('0x' + 'a1'.repeat(32)) as `0x${string}`
const TX2 = ('0x' + 'a2'.repeat(32)) as `0x${string}`
const TX3 = ('0x' + 'a3'.repeat(32)) as `0x${string}`
const PROPOSER1 = '0x00000000000000000000000000000000000000aa'
const EXECUTOR1 = '0x00000000000000000000000000000000000000bb'
const PROPOSER2 = '0x00000000000000000000000000000000000000cc'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchOperationsFromBlockscoutEvents', () => {
  it('reconstructs single + batch ops, parses timestamps, and resolves senders', async () => {
    const logs = [
      // Single op ID1 (scheduled then executed)
      makeLog({
        eventName: 'CallScheduled',
        args: { id: ID1, index: 0n, target: T1, value: 0n, data: '0xdeadbeef', predecessor: ZERO32, delay: 60n },
        blockNumber: 100,
        timestamp: '2026-04-25T22:45:26.000000Z',
        txHash: TX1,
        logIndex: 0,
      }),
      makeLog({
        eventName: 'CallExecuted',
        args: { id: ID1, index: 0n, target: T1, value: 0n, data: '0xdeadbeef' },
        blockNumber: 110,
        timestamp: '2026-04-26T10:00:00.000000Z',
        txHash: TX2,
        logIndex: 0,
      }),
      // Batch op ID2 (two calls)
      makeLog({
        eventName: 'CallScheduled',
        args: { id: ID2, index: 0n, target: T1, value: 0n, data: '0x1111', predecessor: ZERO32, delay: 120n },
        blockNumber: 90,
        timestamp: '2026-04-24T08:00:00.000000Z',
        txHash: TX3,
        logIndex: 0,
      }),
      makeLog({
        eventName: 'CallScheduled',
        args: { id: ID2, index: 1n, target: T2, value: 5n, data: '0x2222', predecessor: ZERO32, delay: 120n },
        blockNumber: 90,
        timestamp: '2026-04-24T08:00:00.000000Z',
        txHash: TX3,
        logIndex: 1,
      }),
    ]

    const txList = {
      items: [
        { hash: TX1, from: { hash: PROPOSER1 } },
        { hash: TX2, from: { hash: EXECUTOR1 } },
        { hash: TX3, from: { hash: PROPOSER2 } },
      ],
      next_page_params: null,
    }

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/transactions')) return jsonResponse(txList)
      return jsonResponse({ items: logs, next_page_params: null })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const ops = await fetchOperationsFromBlockscoutEvents({
      chainId: 30,
      timelockController: '0xcd43d892bd81d1e6249c040d764a5dbd754094c2',
    })

    expect(ops).toHaveLength(2)

    const single = ops.find((o) => o.id === ID1.toLowerCase())!
    const batch = ops.find((o) => o.id === ID2.toLowerCase())!

    // single op
    expect(single.status).toBe('EXECUTED')
    expect(single.target?.toLowerCase()).toBe(T1)
    expect(single.calls).toBeUndefined()
    expect(single.scheduledAt).toBeGreaterThan(0n)
    expect(single.timestamp).toBe(single.scheduledAt + 60n)
    expect(single.scheduledBy).toBe(PROPOSER1)
    expect(single.executedBy).toBe(EXECUTOR1)

    // batch op
    expect(batch.status).toBe('PENDING')
    expect(batch.target).toBeNull()
    expect(batch.calls).toHaveLength(2)
    expect(batch.calls!.map((c) => c.index)).toEqual([0, 1])
    expect(batch.calls![1].target.toLowerCase()).toBe(T2)
    expect(batch.scheduledBy).toBe(PROPOSER2)
  })

  it('filters by target across batch calls', async () => {
    const logs = [
      makeLog({
        eventName: 'CallScheduled',
        args: { id: ID2, index: 0n, target: T1, value: 0n, data: '0x1111', predecessor: ZERO32, delay: 1n },
        blockNumber: 90,
        timestamp: '2026-04-24T08:00:00.000000Z',
        txHash: TX3,
        logIndex: 0,
      }),
      makeLog({
        eventName: 'CallScheduled',
        args: { id: ID2, index: 1n, target: T2, value: 0n, data: '0x2222', predecessor: ZERO32, delay: 1n },
        blockNumber: 90,
        timestamp: '2026-04-24T08:00:00.000000Z',
        txHash: TX3,
        logIndex: 1,
      }),
    ]
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/transactions')) return jsonResponse({ items: [], next_page_params: null })
      return jsonResponse({ items: logs, next_page_params: null })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const matching = await fetchOperationsFromBlockscoutEvents({
      chainId: 30,
      timelockController: '0xcd43d892bd81d1e6249c040d764a5dbd754094c2',
      target: T2 as `0x${string}`,
    })
    expect(matching).toHaveLength(1)

    const nonMatching = await fetchOperationsFromBlockscoutEvents({
      chainId: 30,
      timelockController: '0xcd43d892bd81d1e6249c040d764a5dbd754094c2',
      target: '0x0000000000000000000000000000000000000099' as `0x${string}`,
    })
    expect(nonMatching).toHaveLength(0)
  })
})
