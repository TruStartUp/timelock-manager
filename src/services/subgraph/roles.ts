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
    id: string // id is the roleHash (bytes32)
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
    role: string | { id: string; timelockController?: string }
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
  role: {
    id: string
    timelockController: string
    adminRole: string | null
    memberCount: number
  } | null
}

/**
 * Transform subgraph response to typed Role
 * Note: In the deployed subgraph, `id` is the roleHash (bytes32)
 */
function transformRole(raw: RolesQueryResponse['roles'][0]): Role {
  return {
    id: raw.id as `0x${string}`,
    roleHash: raw.id as `0x${string}`, // id is the roleHash in deployed subgraph
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
  // Extract role hash from either string or nested object
  const roleHash =
    typeof raw.role === 'string'
      ? raw.role
      : typeof raw.role === 'object' && raw.role !== null && 'id' in raw.role
      ? raw.role.id
      : ''

  return {
    id: raw.id,
    role: roleHash,
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
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Array of roles
 */
export async function fetchRoles(
  timelockController: Address,
  chainIdOrSubgraphUrl: ChainId | string
): Promise<Role[]> {
  const query = `
    query GetRoles($timelockController: Bytes!) {
      roles(
        where: { timelockController: $timelockController }
        orderBy: id
        orderDirection: asc
      ) {
        id
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
    chainIdOrSubgraphUrl
  )

  return response.roles.map(transformRole)
}

/**
 * Fetch a single role by role hash
 *
 * @param roleHash - Role hash (bytes32)
 * @param timelockController - TimelockController contract address
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Role or null if not found
 */
export async function fetchRoleByHash(
  roleHash: `0x${string}`,
  timelockController: Address,
  chainIdOrSubgraphUrl: ChainId | string
): Promise<Role | null> {
  const query = `
    query GetRole($id: Bytes!) {
      role(id: $id) {
        id
        timelockController
        adminRole
        memberCount
      }
    }
  `

  // Role ID is just the role hash (bytes32), not a composite
  const variables = {
    id: roleHash.toLowerCase(),
  }

  const response = await executeGraphQLQueryWithRetry<RoleQueryResponse>(
    query,
    variables,
    chainIdOrSubgraphUrl
  )

  return response.role ? transformRole(response.role) : null
}

/**
 * Fetch role assignments (grant/revoke history) for a role
 *
 * @param roleHash - Role hash
 * @param timelockController - TimelockController contract address
 * @param pagination - Pagination parameters
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Array of role assignments ordered by timestamp descending
 */
export async function fetchRoleAssignments(
  roleHash: `0x${string}`,
  timelockController: Address,
  pagination: PaginationParams = {},
  chainIdOrSubgraphUrl: ChainId | string
): Promise<RoleAssignment[]> {
  const { first = DEFAULT_PAGE_SIZE, skip = 0 } = pagination

  const query = `
    query GetRoleAssignments($roleHash: Bytes!, $timelockController: Bytes!, $first: Int!, $skip: Int!) {
      roleAssignments(
        where: {
          role_: { id: $roleHash, timelockController: $timelockController }
        }
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        role {
          id
        }
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
      chainIdOrSubgraphUrl
    )

  return response.roleAssignments.map(transformRoleAssignment)
}

/**
 * Fetch all role assignments for a specific account
 *
 * @param account - Account address
 * @param timelockController - TimelockController contract address
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Array of role assignments for this account
 */
export async function fetchRoleAssignmentsByAccount(
  account: Address,
  timelockController: Address,
  chainIdOrSubgraphUrl: ChainId | string
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
        role {
          id
          timelockController
        }
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
      chainIdOrSubgraphUrl
    )

  return response.roleAssignments.map(transformRoleAssignment)
}

/**
 * Compute current role members from event-sourced assignments
 *
 * @param roleHash - Role hash
 * @param timelockController - TimelockController contract address
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Array of current member addresses
 */
export async function getCurrentRoleMembers(
  roleHash: `0x${string}`,
  timelockController: Address,
  chainIdOrSubgraphUrl: ChainId | string
): Promise<Address[]> {
  // Fetch all assignments for this role
  // Role ID is just the role hash (bytes32)
  const query = `
    query GetAllRoleAssignments($roleHash: Bytes!, $timelockController: Bytes!) {
      roleAssignments(
        where: {
          role_: { id: $roleHash, timelockController: $timelockController }
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
      chainIdOrSubgraphUrl
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
 * @param chainIdOrSubgraphUrl - Network chain ID or direct subgraph URL
 * @returns Summary of all standard roles with member counts
 */
export async function getRolesSummary(
  timelockController: Address,
  chainIdOrSubgraphUrl: ChainId | string
): Promise<
  Array<{
    roleHash: `0x${string}`
    roleName: string
    memberCount: number
    members: Address[]
  }>
> {
  // Always ensure we have the 4 standard roles, even if subgraph hasn't indexed them yet
  const standardRoles: Array<{ roleHash: `0x${string}`; roleName: string }> = [
    { roleHash: TIMELOCK_ROLES.ADMIN, roleName: 'DEFAULT_ADMIN' },
    { roleHash: TIMELOCK_ROLES.PROPOSER, roleName: 'PROPOSER' },
    { roleHash: TIMELOCK_ROLES.EXECUTOR, roleName: 'EXECUTOR' },
    { roleHash: TIMELOCK_ROLES.CANCELLER, roleName: 'CANCELLER' },
  ]

  // Try to fetch roles from subgraph, but don't fail if none exist yet
  let roles: Role[] = []
  try {
    roles = await fetchRoles(timelockController, chainIdOrSubgraphUrl)
  } catch (error) {
    // If fetchRoles fails (e.g., no roles indexed yet), continue with empty array
    // We'll still return the standard roles with empty members
    console.warn('Failed to fetch roles from subgraph, using standard roles:', error)
  }

  // Create a map of found roles for quick lookup
  const foundRolesMap = new Map<string, Role>()
  for (const role of roles) {
    foundRolesMap.set(role.roleHash.toLowerCase(), role)
  }

  // Build summary for all standard roles, using subgraph data if available
  // Use Promise.allSettled to ensure one failure doesn't break all roles
  const summaryResults = await Promise.allSettled(
    standardRoles.map(async ({ roleHash, roleName }) => {
      // Try to get members from subgraph (even if role entity doesn't exist yet)
      let members: Address[] = []
      try {
        members = await getCurrentRoleMembers(
          roleHash,
          timelockController,
          chainIdOrSubgraphUrl
        )
      } catch (error) {
        // If getCurrentRoleMembers fails, just use empty array
        // This can happen if no RoleGranted events have been indexed yet
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `Failed to fetch members for role ${roleName}, using empty array:`,
            error
          )
        }
      }

      return {
        roleHash,
        roleName,
        memberCount: members.length,
        members,
      }
    })
  )

  // Extract successful results, use empty array for failed ones
  const summary = summaryResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      // If a role fetch failed, return it with empty members
      const { roleHash, roleName } = standardRoles[index]
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          `Failed to process role ${roleName}, using empty members:`,
          result.reason
        )
      }
      return {
        roleHash,
        roleName,
        memberCount: 0,
        members: [],
      }
    }
  })

  // Add any custom roles found in subgraph that aren't in the standard list
  // Also filter out the old incorrect CANCELLER hash if it exists
  const oldCancellerHash = '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b6223913e945f67199f'
  
  for (const role of roles) {
    const isStandard = standardRoles.some(
      (sr) => sr.roleHash.toLowerCase() === role.roleHash.toLowerCase()
    )
    const isOldCanceller = role.roleHash.toLowerCase() === oldCancellerHash.toLowerCase()
    
    // Skip if it's a standard role OR if it's the old incorrect CANCELLER hash
    if (!isStandard && !isOldCanceller) {
      let members: Address[] = []
      try {
        members = await getCurrentRoleMembers(
          role.roleHash,
          timelockController,
          chainIdOrSubgraphUrl
        )
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `Failed to fetch members for custom role ${role.roleHash}:`,
            error
          )
        }
      }
      summary.push({
        roleHash: role.roleHash,
        roleName: `CUSTOM_${role.roleHash.slice(0, 10)}`,
        memberCount: members.length,
        members,
      })
    }
  }

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
