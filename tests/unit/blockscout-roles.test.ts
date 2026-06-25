import { describe, it, expect, vi, afterEach } from 'vitest'
import { encodeEventTopics } from 'viem'
import ABI from '@/lib/abis/TimelockController.json'
import {
  getRolesSummaryFromBlockscoutEvents,
  fetchRoleAssignmentsFromBlockscoutEvents,
} from '@/services/blockscout/roles'
import { TIMELOCK_ROLES } from '@/lib/constants'

const abi = ABI as any

function roleLog(opts: {
  eventName: 'RoleGranted' | 'RoleRevoked'
  role: string
  account: string
  sender: string
  blockNumber: number
  logIndex: number
  timestamp: string
  txHash: string
}) {
  const topics = encodeEventTopics({
    abi,
    eventName: opts.eventName,
    args: { role: opts.role, account: opts.account, sender: opts.sender } as any,
  })
  return {
    topics,
    data: '0x',
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

const A = '0x00000000000000000000000000000000000000aa'
const B = '0x00000000000000000000000000000000000000bb'
const SENDER = '0x00000000000000000000000000000000000000ff'
const CUSTOM_ROLE = ('0x' + '77'.repeat(32)) as `0x${string}`

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Blockscout roles event-sourcing', () => {
  it('computes current members from grant/revoke history', async () => {
    const logs = [
      roleLog({ eventName: 'RoleGranted', role: TIMELOCK_ROLES.PROPOSER_ROLE, account: A, sender: SENDER, blockNumber: 1, logIndex: 0, timestamp: '2026-01-01T00:00:00Z', txHash: '0x' + '01'.repeat(32) }),
      roleLog({ eventName: 'RoleGranted', role: TIMELOCK_ROLES.PROPOSER_ROLE, account: B, sender: SENDER, blockNumber: 2, logIndex: 0, timestamp: '2026-01-02T00:00:00Z', txHash: '0x' + '02'.repeat(32) }),
      roleLog({ eventName: 'RoleRevoked', role: TIMELOCK_ROLES.PROPOSER_ROLE, account: A, sender: SENDER, blockNumber: 3, logIndex: 0, timestamp: '2026-01-03T00:00:00Z', txHash: '0x' + '03'.repeat(32) }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: logs, next_page_params: null })))

    const summary = await getRolesSummaryFromBlockscoutEvents({
      chainId: 30,
      timelockController: ('0x' + 'd1'.repeat(20)) as `0x${string}`,
    })

    const proposer = summary.find((r) => r.roleHash === TIMELOCK_ROLES.PROPOSER_ROLE)!
    expect(proposer.memberCount).toBe(1)
    expect(proposer.members.map((m) => m.toLowerCase())).toEqual([B])

    // Untouched standard roles come back empty
    const executor = summary.find((r) => r.roleHash === TIMELOCK_ROLES.EXECUTOR_ROLE)!
    expect(executor.memberCount).toBe(0)
  })

  it('surfaces non-standard roles as CUSTOM_ entries', async () => {
    const logs = [
      roleLog({ eventName: 'RoleGranted', role: CUSTOM_ROLE, account: A, sender: SENDER, blockNumber: 1, logIndex: 0, timestamp: '2026-01-01T00:00:00Z', txHash: '0x' + '01'.repeat(32) }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: logs, next_page_params: null })))

    const summary = await getRolesSummaryFromBlockscoutEvents({
      chainId: 30,
      timelockController: ('0x' + 'd2'.repeat(20)) as `0x${string}`,
    })

    const custom = summary.find((r) => r.roleHash.toLowerCase() === CUSTOM_ROLE.toLowerCase())!
    expect(custom).toBeDefined()
    expect(custom.roleName.startsWith('CUSTOM_')).toBe(true)
    expect(custom.members.map((m) => m.toLowerCase())).toEqual([A])
  })

  it('returns history sorted newest-first', async () => {
    const logs = [
      roleLog({ eventName: 'RoleGranted', role: TIMELOCK_ROLES.PROPOSER_ROLE, account: A, sender: SENDER, blockNumber: 1, logIndex: 0, timestamp: '2026-01-01T00:00:00Z', txHash: '0x' + '01'.repeat(32) }),
      roleLog({ eventName: 'RoleRevoked', role: TIMELOCK_ROLES.PROPOSER_ROLE, account: A, sender: SENDER, blockNumber: 3, logIndex: 0, timestamp: '2026-01-03T00:00:00Z', txHash: '0x' + '03'.repeat(32) }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: logs, next_page_params: null })))

    const history = await fetchRoleAssignmentsFromBlockscoutEvents({
      chainId: 30,
      timelockController: ('0x' + 'd3'.repeat(20)) as `0x${string}`,
      roleHash: TIMELOCK_ROLES.PROPOSER_ROLE,
    })

    expect(history).toHaveLength(2)
    expect(history[0].granted).toBe(false)
    expect(history[1].granted).toBe(true)
    expect(history[0].timestamp).toBeGreaterThan(history[1].timestamp)
  })
})
