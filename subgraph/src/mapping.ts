import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  CallScheduled as CallScheduledEvent,
  CallExecuted as CallExecutedEvent,
  Cancelled as CancelledEvent,
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
} from '../generated/TimelockController/TimelockController'
import {
  TimelockController,
  Operation,
  Call,
  Role,
  RoleAssignment,
} from '../generated/schema'

/**
 * Handle CallScheduled event - creates Operation and Call entities
 *
 * Event signature: CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)
 *
 * For batch operations (scheduleBatch), this event is emitted once per call with incrementing index.
 * For single operations (schedule), this event is emitted once with index = 0.
 */
export function handleCallScheduled(event: CallScheduledEvent): void {
  const operationId = event.params.id
  const callIndex = event.params.index.toI32()
  const timelockAddress = event.address

  // Ensure TimelockController entity exists
  let timelock = TimelockController.load(timelockAddress)
  if (timelock === null) {
    timelock = new TimelockController(timelockAddress)
    timelock.address = timelockAddress
    timelock.minDelay = BigInt.fromI32(0) // Will be updated by contract call or MinDelayChange event
    timelock.operationCount = 0
    timelock.save()
  }

  // Load or create Operation entity
  // Only create new operation on first call (index 0)
  let operation = Operation.load(operationId)
  if (operation === null) {
    operation = new Operation(operationId)
    operation.index = event.block.number
      .times(BigInt.fromI32(1000000))
      .plus(BigInt.fromI32(event.logIndex.toI32()))
    operation.timelockController = timelockAddress
    operation.predecessor = event.params.predecessor
    operation.salt = Bytes.empty() // Salt not available in CallScheduled event
    operation.delay = event.params.delay
    operation.timestamp = event.block.timestamp.plus(event.params.delay)
    operation.status = 'PENDING'
    operation.scheduledAt = event.block.timestamp
    operation.scheduledTx = event.transaction.hash
    operation.scheduledBy = event.transaction.from

    // For single-call operations (index 0 only), store call data in Operation entity
    if (callIndex === 0) {
      operation.target = event.params.target
      operation.value = event.params.value
      operation.data = event.params.data
    }

    operation.save()

    // Increment operation count
    timelock.operationCount = timelock.operationCount + 1
    timelock.save()
  }

  // Create Call entity for batch operations
  // For batch operations, each call gets a separate Call entity
  // For single operations, we also create a Call entity for consistency
  const callId = operationId.concat(Bytes.fromI32(callIndex))
  let call = new Call(callId)
  call.operation = operationId
  call.index = callIndex
  call.target = event.params.target
  call.value = event.params.value
  call.data = event.params.data
  call.signature = null // Will be populated by decoder service
  call.save()
}

/**
 * Handle CallExecuted event - updates Operation.executedAt
 *
 * Event signature: CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data)
 *
 * For batch operations, this event is emitted once per call.
 * We only update the Operation entity once (when index = 0 or first execution detected).
 */
export function handleCallExecuted(event: CallExecutedEvent): void {
  const operationId = event.params.id
  const callIndex = event.params.index.toI32()

  const operation = Operation.load(operationId)
  if (operation === null) {
    // Operation should exist from CallScheduled, but log warning and skip
    return
  }

  // Only update operation on first call execution (index 0 for batch, or if not yet executed)
  if (operation.executedAt === null) {
    operation.executedAt = event.block.timestamp
    operation.executedTx = event.transaction.hash
    operation.executedBy = event.transaction.from
    operation.status = 'EXECUTED'
    operation.save()
  }
}

/**
 * Handle Cancelled event - updates Operation.cancelledAt
 *
 * Event signature: Cancelled(bytes32 indexed id)
 */
export function handleCancelled(event: CancelledEvent): void {
  const operationId = event.params.id

  const operation = Operation.load(operationId)
  if (operation === null) {
    // Operation should exist from CallScheduled, but log warning and skip
    return
  }

  operation.cancelledAt = event.block.timestamp
  operation.cancelledTx = event.transaction.hash
  operation.cancelledBy = event.transaction.from
  operation.status = 'CANCELLED'
  operation.save()
}

/**
 * Handle RoleGranted event - creates RoleAssignment entity
 *
 * Event signature: RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
 *
 * This implements event-sourcing for role membership.
 * Current members are computed by replaying all RoleGranted/RoleRevoked events.
 */
export function handleRoleGranted(event: RoleGrantedEvent): void {
  const roleHash = event.params.role
  const account = event.params.account
  const sender = event.params.sender
  const timelockAddress = event.address

  // Ensure TimelockController entity exists
  let timelock = TimelockController.load(timelockAddress)
  if (timelock === null) {
    timelock = new TimelockController(timelockAddress)
    timelock.address = timelockAddress
    timelock.minDelay = BigInt.fromI32(0)
    timelock.operationCount = 0
    timelock.save()
  }

  // Load or create Role entity
  let role = Role.load(roleHash)
  if (role === null) {
    role = new Role(roleHash)
    role.roleHash = roleHash
    role.timelockController = timelockAddress
    role.memberCount = 0
    role.save()
  }

  // Create RoleAssignment entity (event-sourced record)
  // ID format: roleHash-account-txHash
  const assignmentId = roleHash
    .concat(account)
    .concat(event.transaction.hash)
  const assignment = new RoleAssignment(assignmentId)
  assignment.role = roleHash
  assignment.account = account
  assignment.granted = true
  assignment.timestamp = event.block.timestamp
  assignment.blockNumber = event.block.number
  assignment.txHash = event.transaction.hash
  assignment.sender = sender
  assignment.save()

  // Increment member count (simplified - event sourcing happens client-side)
  // Note: This is a best-effort count and may be inaccurate if revokes happen
  // Client should compute accurate membership by replaying all assignments
  role.memberCount = role.memberCount + 1
  role.save()
}

/**
 * Handle RoleRevoked event - creates RoleAssignment entity
 *
 * Event signature: RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
 *
 * This implements event-sourcing for role membership.
 * Current members are computed by replaying all RoleGranted/RoleRevoked events.
 */
export function handleRoleRevoked(event: RoleRevokedEvent): void {
  const roleHash = event.params.role
  const account = event.params.account
  const sender = event.params.sender
  const timelockAddress = event.address

  // Ensure TimelockController entity exists
  let timelock = TimelockController.load(timelockAddress)
  if (timelock === null) {
    timelock = new TimelockController(timelockAddress)
    timelock.address = timelockAddress
    timelock.minDelay = BigInt.fromI32(0)
    timelock.operationCount = 0
    timelock.save()
  }

  // Load or create Role entity
  let role = Role.load(roleHash)
  if (role === null) {
    role = new Role(roleHash)
    role.roleHash = roleHash
    role.timelockController = timelockAddress
    role.memberCount = 0
    role.save()
  }

  // Create RoleAssignment entity (event-sourced record)
  // ID format: roleHash-account-txHash
  const assignmentId = roleHash
    .concat(account)
    .concat(event.transaction.hash)
  const assignment = new RoleAssignment(assignmentId)
  assignment.role = roleHash
  assignment.account = account
  assignment.granted = false
  assignment.timestamp = event.block.timestamp
  assignment.blockNumber = event.block.number
  assignment.txHash = event.transaction.hash
  assignment.sender = sender
  assignment.save()

  // Decrement member count (simplified - event sourcing happens client-side)
  // Note: This is a best-effort count and may be inaccurate
  // Client should compute accurate membership by replaying all assignments
  if (role.memberCount > 0) {
    role.memberCount = role.memberCount - 1
  }
  role.save()
}
