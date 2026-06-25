/**
 * Blockscout Roles Fallback
 *
 * Derives current role members and grant/revoke history from RoleGranted /
 * RoleRevoked event logs when no subgraph is configured.
 */

import { decodeEventLog, type Address, type Hex } from 'viem'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { type RoleAssignment } from '@/types/role'
import { TIMELOCK_ROLES } from '@/lib/constants'
import { type BlockscoutNetwork, CHAIN_TO_NETWORK } from './client'
import {
  toHexTopicArray,
  toHexData,
  toBigIntLike,
  toNumberLike,
  parseTimestampSeconds,
  addressHash,
  fetchAllItems,
} from './logs'

const ABI = TimelockControllerABI as any
const ZERO = BigInt(0)
const CACHE_TTL_MS = 30_000

const STANDARD_ROLES: Array<{ roleHash: `0x${string}`; roleName: string }> = [
  { roleHash: TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE, roleName: 'DEFAULT_ADMIN' },
  { roleHash: TIMELOCK_ROLES.PROPOSER_ROLE, roleName: 'PROPOSER' },
  { roleHash: TIMELOCK_ROLES.EXECUTOR_ROLE, roleName: 'EXECUTOR' },
  { roleHash: TIMELOCK_ROLES.CANCELLER_ROLE, roleName: 'CANCELLER' },
]

const assignmentsCache = new Map<string, { at: number; data: Promise<RoleAssignment[]> }>()

function resolveNetwork(chainId: number): BlockscoutNetwork {
  const network = CHAIN_TO_NETWORK[chainId] as BlockscoutNetwork | undefined
  if (!network) throw new Error(`Unsupported chainId for Blockscout fallback: ${chainId}`)
  return network
}

async function loadAllRoleAssignments(
  network: BlockscoutNetwork,
  timelock: Address
): Promise<RoleAssignment[]> {
  const logs = await fetchAllItems(network, `addresses/${timelock}/logs`)
  const assignments: RoleAssignment[] = []

  for (const item of logs) {
    const topics = toHexTopicArray(item?.topics)
    if (topics.length === 0) continue

    let decoded: any
    try {
      decoded = decodeEventLog({ abi: ABI, data: toHexData(item?.data), topics: topics as any })
    } catch {
      continue
    }
    if (decoded.eventName !== 'RoleGranted' && decoded.eventName !== 'RoleRevoked') continue

    const args = decoded.args as any
    const role = String(args.role).toLowerCase()
    const account = String(args.account).toLowerCase() as `0x${string}`
    const sender = String(args.sender).toLowerCase() as `0x${string}`
    const txHash = (item?.transaction_hash ?? item?.tx_hash ?? '') as `0x${string}`
    const blockNumber = toBigIntLike(item?.block_number ?? item?.blockNumber) ?? ZERO
    const logIndex = BigInt(toNumberLike(item?.index ?? item?.log_index) ?? 0)

    assignments.push({
      id: `${role}-${account}-${txHash}-${logIndex}`,
      role,
      account,
      granted: decoded.eventName === 'RoleGranted',
      timestamp: parseTimestampSeconds(item?.block_timestamp ?? item?.timestamp),
      blockNumber,
      txHash,
      sender,
    })
  }

  return assignments
}

function getAssignments(network: BlockscoutNetwork, timelock: Address): Promise<RoleAssignment[]> {
  const key = `${network}:${timelock.toLowerCase()}`
  const cached = assignmentsCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data

  const data = loadAllRoleAssignments(network, timelock)
  assignmentsCache.set(key, { at: Date.now(), data })
  return data
}

function membersFromAssignments(assignments: RoleAssignment[], roleHash: string): Address[] {
  const ordered = assignments
    .filter((a) => (a.role as string).toLowerCase() === roleHash.toLowerCase())
    .sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? 1 : -1
      return 0
    })

  const members = new Set<string>()
  for (const a of ordered) {
    const account = a.account.toLowerCase()
    if (a.granted) members.add(account)
    else members.delete(account)
  }
  return Array.from(members) as Address[]
}

export async function getRolesSummaryFromBlockscoutEvents(params: {
  chainId: number
  timelockController: Address
}): Promise<Array<{ roleHash: `0x${string}`; roleName: string; memberCount: number; members: Address[] }>> {
  const network = resolveNetwork(params.chainId)
  const assignments = await getAssignments(network, params.timelockController)

  const summary = STANDARD_ROLES.map(({ roleHash, roleName }) => {
    const members = membersFromAssignments(assignments, roleHash)
    return { roleHash, roleName, memberCount: members.length, members }
  })

  const standardSet = new Set(STANDARD_ROLES.map((r) => r.roleHash.toLowerCase()))
  const customHashes = new Set(
    assignments
      .map((a) => (a.role as string).toLowerCase())
      .filter((h) => !standardSet.has(h))
  )
  for (const roleHash of Array.from(customHashes)) {
    const members = membersFromAssignments(assignments, roleHash)
    summary.push({
      roleHash: roleHash as `0x${string}`,
      roleName: `CUSTOM_${roleHash.slice(0, 10)}`,
      memberCount: members.length,
      members,
    })
  }

  return summary
}

export async function fetchRoleAssignmentsFromBlockscoutEvents(params: {
  chainId: number
  timelockController: Address
  roleHash?: `0x${string}`
}): Promise<RoleAssignment[]> {
  const network = resolveNetwork(params.chainId)
  const assignments = await getAssignments(network, params.timelockController)

  const filtered = params.roleHash
    ? assignments.filter(
        (a) => (a.role as string).toLowerCase() === params.roleHash!.toLowerCase()
      )
    : assignments

  return filtered.sort((a, b) => {
    if (a.timestamp > b.timestamp) return -1
    if (a.timestamp < b.timestamp) return 1
    return 0
  })
}
