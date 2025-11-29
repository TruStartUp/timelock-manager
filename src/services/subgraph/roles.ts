/**
 * Role Queries for The Graph Subgraph
 *
 * Provides GraphQL queries to fetch roles and role assignments from TimelockController
 * contracts indexed by The Graph subgraph.
 *
 * Features:
 * - Fetch roles for a TimelockController
 * - Fetch role assignments (grant/revoke history)
 * - Compute current role members via event sourcing
 * - Type-safe responses matching data-model.md entities
 */

import { type Address } from 'viem'
import {
  executeGraphQLQuery,
  executeGraphQLQueryWithRetry,
  type ChainId,
  type PaginationParams,
  DEFAULT_PAGE_SIZE,
} from './client'
import {
  type Role,
  type RoleAssignment,
  TIMELOCK_ROLES,
} from '@/types/role'

/**
 * Response from roles query
 */
interface RolesQueryResponse {
  roles: Array<{
    id: string
    roleHash: string
    timelockController: string
    adminRole: string | null
    memberCount: number
  }>
}

/**
 * Response from role assignments query
 */
interface RoleAssignmentsQueryResponse {
  roleAssignments: Array<{
    id: string
    role: string
    account: string
    granted: boolean
    timestamp: string
    blockNumber: string
    txHash: string
    sender: string
  }>
}

/**
 * Response from single role query
 */
interface RoleQueryResponse {
  role: RolesQueryResponse['roles'][0] | null
}

/**
 * Transform subgraph response to typed Role
 */
function transformRole(raw: RolesQueryResponse['roles'][0]): Role {
  return {
    id: raw.id as `0x${string}`,
    roleHash: raw.roleHash as `0x${string}`,
    timelockController: raw.timelockController as `0x${string}`,
    adminRole: raw.adminRole as `0x${string}` | null,
    memberCount: raw.memberCount,
  }
}

/**
 * Transform subgraph response to typed RoleAssignment
 */
function transformRoleAssignment(
  raw: RoleAssignmentsQueryResponse['roleAssignments'][0]
): RoleAssignment {
  return {
    id: raw.id,
    role: raw.role,
    account: raw.account as `0x${string}`,
    granted: raw.granted,
    timestamp: BigInt(raw.timestamp),
    blockNumber: BigInt(raw.blockNumber),
    txHash: raw.txHash as `0x${string}`,
    sender: raw.sender as `0x${string}`,
  }
}

/**
 * Fetch all roles for a TimelockController
 *
 * @param timelockController - TimelockController contract address
 * @param chainId - Network chain ID
 * @returns Array of roles
 */
export async function fetchRoles(
  timelockController: Address,
  chainId: ChainId
): Promise<Role[]> {
  const query = `
    query GetRoles($timelockController: Bytes!) {
      roles(
        where: { timelockController: $timelockController }
        orderBy: roleHash
        orderDirection: asc
      ) {
        id
        roleHash
        timelockController
        adminRole
        memberCount
      }
    }
  `

  const variables = {
    timelockController: timelockController.toLowerCase(),
  }

  const response = await executeGraphQLQueryWithRetry<RolesQueryResponse>(
    query,
    variables,
    chainId
  )

  return response.roles.map(transformRole)
}

/**
 * Fetch a single role by role hash
 *
 * @param roleHash - Role hash (bytes32)
 * @param timelockController - TimelockController contract address
 * @param chainId - Network chain ID
 * @returns Role or null if not found
 */
export async function fetchRoleByHash(
  roleHash: `0x${string}`,
  timelockController: Address,
  chainId: ChainId
): Promise<Role | null> {
  const query = `
    query GetRole($id: Bytes!) {
      role(id: $id) {
        id
        roleHash
        timelockController
        adminRole
        memberCount
      }
    }
  `

  // Role ID is typically roleHash-timelockController
  const roleId = `${roleHash.toLowerCase()}-${timelockController.toLowerCase()}`

  const variables = {
    id: roleId,
  }

  const response = await executeGraphQLQueryWithRetry<RoleQueryResponse>(
    query,
    variables,
    chainId
  )

  return response.role ? transformRole(response.role) : null
}

/**
 * Fetch role assignments (grant/revoke history) for a role
 *
 * @param roleHash - Role hash
 * @param timelockController - TimelockController contract address
 * @param pagination - Pagination parameters
 * @param chainId - Network chain ID
 * @returns Array of role assignments ordered by timestamp descending
 */
export async function fetchRoleAssignments(
  roleHash: `0x${string}`,
  timelockController: Address,
  pagination: PaginationParams = {},
  chainId: ChainId
): Promise<RoleAssignment[]> {
  const { first = DEFAULT_PAGE_SIZE, skip = 0 } = pagination

  const query = `
    query GetRoleAssignments($roleHash: Bytes!, $first: Int!, $skip: Int!) {
      roleAssignments(
        where: { role_: { roleHash: $roleHash, timelockController: $timelockController } }
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        role
        account
        granted
        timestamp
        blockNumber
        txHash
        sender
      }
    }
  `

  const variables = {
    roleHash: roleHash.toLowerCase(),
    timelockController: timelockController.toLowerCase(),
    first,
    skip,
  }

  const response =
    await executeGraphQLQueryWithRetry<RoleAssignmentsQueryResponse>(
      query,
      variables,
      chainId
    )

  return response.roleAssignments.map(transformRoleAssignment)
}

/**
 * Fetch all role assignments for a specific account
 *
 * @param account - Account address
 * @param timelockController - TimelockController contract address
 * @param chainId - Network chain ID
 * @returns Array of role assignments for this account
 */
export async function fetchRoleAssignmentsByAccount(
  account: Address,
  timelockController: Address,
  chainId: ChainId
): Promise<RoleAssignment[]> {
  const query = `
    query GetRoleAssignmentsByAccount($account: Bytes!, $timelockController: Bytes!) {
      roleAssignments(
        where: {
          account: $account,
          role_: { timelockController: $timelockController }
        }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        role
        account
        granted
        timestamp
        blockNumber
        txHash
        sender
      }
    }
  `

  const variables = {
    account: account.toLowerCase(),
    timelockController: timelockController.toLowerCase(),
  }

  const response =
    await executeGraphQLQueryWithRetry<RoleAssignmentsQueryResponse>(
      query,
      variables,
      chainId
    )

  return response.roleAssignments.map(transformRoleAssignment)
}

/**
 * Compute current role members from event-sourced assignments
 *
 * @param roleHash - Role hash
 * @param timelockController - TimelockController contract address
 * @param chainId - Network chain ID
 * @returns Array of current member addresses
 */
export async function getCurrentRoleMembers(
  roleHash: `0x${string}`,
  timelockController: Address,
  chainId: ChainId
): Promise<Address[]> {
  // Fetch all assignments for this role
  const query = `
    query GetAllRoleAssignments($roleHash: Bytes!, $timelockController: Bytes!) {
      roleAssignments(
        where: {
          role_: { roleHash: $roleHash, timelockController: $timelockController }
        }
        orderBy: blockNumber
        orderDirection: asc
        first: 1000
      ) {
        account
        granted
        blockNumber
      }
    }
  `

  const variables = {
    roleHash: roleHash.toLowerCase(),
    timelockController: timelockController.toLowerCase(),
  }

  const response =
    await executeGraphQLQueryWithRetry<RoleAssignmentsQueryResponse>(
      query,
      variables,
      chainId
    )

  // Event-source: replay grants and revokes
  const memberMap = new Map<string, boolean>()

  for (const assignment of response.roleAssignments) {
    const accountLower = assignment.account.toLowerCase()
    if (assignment.granted) {
      memberMap.set(accountLower, true)
    } else {
      memberMap.delete(accountLower)
    }
  }

  // Return current members as checksummed addresses
  return Array.from(memberMap.keys()) as Address[]
}

/**
 * Get role summary for dashboard
 *
 * @param timelockController - TimelockController contract address
 * @param chainId - Network chain ID
 * @returns Summary of all standard roles with member counts
 */
export async function getRolesSummary(
  timelockController: Address,
  chainId: ChainId
): Promise<
  Array<{
    roleHash: `0x${string}`
    roleName: string
    memberCount: number
    members: Address[]
  }>
> {
  const roles = await fetchRoles(timelockController, chainId)

  // Map standard role hashes to names
  const roleNames: Record<string, string> = {
    [TIMELOCK_ROLES.ADMIN.toLowerCase()]: 'DEFAULT_ADMIN',
    [TIMELOCK_ROLES.PROPOSER.toLowerCase()]: 'PROPOSER',
    [TIMELOCK_ROLES.EXECUTOR.toLowerCase()]: 'EXECUTOR',
    [TIMELOCK_ROLES.CANCELLER.toLowerCase()]: 'CANCELLER',
  }

  const summary = await Promise.all(
    roles.map(async (role) => {
      const members = await getCurrentRoleMembers(
        role.roleHash,
        timelockController,
        chainId
      )
      return {
        roleHash: role.roleHash,
        roleName:
          roleNames[role.roleHash.toLowerCase()] ||
          `CUSTOM_${role.roleHash.slice(0, 10)}`,
        memberCount: members.length,
        members,
      }
    })
  )

  return summary
}

/**
 * Check if an account has a specific role
 *
 * @param account - Account address
 * @param roleHash - Role hash
 * @param timelockController - TimelockController contract address
 * @param chainId - Network chain ID
 * @returns True if account currently has the role
 */
export async function hasRole(
  account: Address,
  roleHash: `0x${string}`,
  timelockController: Address,
  chainId: ChainId
): Promise<boolean> {
  const members = await getCurrentRoleMembers(
    roleHash,
    timelockController,
    chainId
  )
  return members.some(
    (member) => member.toLowerCase() === account.toLowerCase()
  )
}
