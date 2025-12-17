import {
  CallExecuted as CallExecutedEvent,
  CallSalt as CallSaltEvent,
  CallScheduled as CallScheduledEvent,
  Cancelled as CancelledEvent,
  MinDelayChange as MinDelayChangeEvent,
  RoleAdminChanged as RoleAdminChangedEvent,
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent
} from "../generated/TimelockController/TimelockController"
import {
  Operation,
  Call,
  Role,
  RoleAssignment,
  CallExecuted,
  CallSalt,
  CallScheduled,
  Cancelled,
  MinDelayChange,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked
} from "../generated/schema"
import { Bytes, BigInt, log } from "@graphprotocol/graph-ts"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate operation status based on timestamps and execution/cancellation state
 */
function calculateStatus(
  operation: Operation,
  currentTimestamp: BigInt
): string {
  // Check final states first
  if (operation.executedAt !== null) {
    return "EXECUTED"
  }
  if (operation.cancelledAt !== null) {
    return "CANCELLED"
  }

  // Check if ready vs pending
  if (currentTimestamp >= operation.timestamp) {
    return "READY"
  } else {
    return "PENDING"
  }
}

// Helper removed - AssemblyScript doesn't support union types
// Use event.address directly in handlers

// ============================================================================
// Operation Event Handlers
// ============================================================================

export function handleCallScheduled(event: CallScheduledEvent): void {
  // Save raw event entity (immutable audit trail)
  let rawEvent = new CallScheduled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  rawEvent.internal_id = event.params.id
  rawEvent.index = event.params.index
  rawEvent.target = event.params.target
  rawEvent.value = event.params.value
  rawEvent.data = event.params.data
  rawEvent.predecessor = event.params.predecessor
  rawEvent.delay = event.params.delay
  rawEvent.blockNumber = event.block.number
  rawEvent.blockTimestamp = event.block.timestamp
  rawEvent.transactionHash = event.transaction.hash
  rawEvent.save()

  // Create or update Operation entity
  let operationId = event.params.id
  let operation = Operation.load(operationId)
  
  if (operation == null) {
    operation = new Operation(operationId)
    
    // Sequential index for sorting (blockNumber * 1000000 + logIndex)
    operation.index = event.block.number.times(BigInt.fromI32(1000000)).plus(BigInt.fromI32(event.logIndex.toI32()))
    
    // Core operation data
    operation.timelockController = event.address
    operation.predecessor = event.params.predecessor
    // Initialize salt with zero bytes (will be updated by CallSalt event)
    operation.salt = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000')
    operation.delay = event.params.delay
    
    // Calculate ready timestamp (scheduledAt + delay)
    operation.scheduledAt = event.block.timestamp
    operation.timestamp = event.block.timestamp.plus(event.params.delay)
    
    // Scheduling metadata
    operation.scheduledTx = event.transaction.hash
    operation.scheduledBy = event.transaction.from
    
    // For single-call operations (index = 0), store call data in operation
    // For batch operations, individual calls are stored as Call entities
    if (event.params.index.equals(BigInt.fromI32(0))) {
      operation.target = event.params.target
      operation.value = event.params.value
      operation.data = event.params.data
    }
    
    // Initial status calculation
    operation.status = calculateStatus(operation, event.block.timestamp)
    
    operation.save()
    
    log.info('Created Operation {} with status {}', [
      operationId.toHexString(),
      operation.status
    ])
  }
  
  // For batch operations, create Call entities for each call
  if (event.params.index.gt(BigInt.fromI32(0))) {
    let callId = operationId.concat(Bytes.fromI32(event.params.index.toI32()))
    let call = new Call(callId)
    
    call.operation = operationId
    call.index = event.params.index.toI32()
    call.target = event.params.target
    call.value = event.params.value
    call.data = event.params.data
    call.signature = null // Will be populated by off-chain indexer if ABI available
    
    call.save()
    
    log.info('Created Call {} for Operation {}', [
      callId.toHexString(),
      operationId.toHexString()
    ])
  }
}

export function handleCallExecuted(event: CallExecutedEvent): void {
  // Save raw event entity (immutable audit trail)
  let rawEvent = new CallExecuted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  rawEvent.internal_id = event.params.id
  rawEvent.index = event.params.index
  rawEvent.target = event.params.target
  rawEvent.value = event.params.value
  rawEvent.data = event.params.data
  rawEvent.blockNumber = event.block.number
  rawEvent.blockTimestamp = event.block.timestamp
  rawEvent.transactionHash = event.transaction.hash
  rawEvent.save()

  // Update Operation entity (only update once, when index = 0)
  if (event.params.index.equals(BigInt.fromI32(0))) {
    let operation = Operation.load(event.params.id)
    
    if (operation != null) {
      operation.executedAt = event.block.timestamp
      operation.executedTx = event.transaction.hash
      operation.executedBy = event.transaction.from
      operation.status = "EXECUTED"
      
      operation.save()
      
      log.info('Executed Operation {} at block {}', [
        event.params.id.toHexString(),
        event.block.number.toString()
      ])
    } else {
      log.warning('CallExecuted event for unknown Operation {}', [
        event.params.id.toHexString()
      ])
    }
  }
}

export function handleCancelled(event: CancelledEvent): void {
  // Save raw event entity (immutable audit trail)
  let rawEvent = new Cancelled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  rawEvent.internal_id = event.params.id
  rawEvent.blockNumber = event.block.number
  rawEvent.blockTimestamp = event.block.timestamp
  rawEvent.transactionHash = event.transaction.hash
  rawEvent.save()

  // Update Operation entity
  let operation = Operation.load(event.params.id)
  
  if (operation != null) {
    operation.cancelledAt = event.block.timestamp
    operation.cancelledTx = event.transaction.hash
    operation.cancelledBy = event.transaction.from
    operation.status = "CANCELLED"
    
    operation.save()
    
    log.info('Cancelled Operation {} at block {}', [
      event.params.id.toHexString(),
      event.block.number.toString()
    ])
  } else {
    log.warning('Cancelled event for unknown Operation {}', [
      event.params.id.toHexString()
    ])
  }
}

export function handleCallSalt(event: CallSaltEvent): void {
  // Save raw event entity
  let entity = new CallSalt(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.internal_id = event.params.id
  entity.salt = event.params.salt

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
  
  // Update Operation with salt if it exists
  let operation = Operation.load(event.params.id)
  if (operation != null) {
    operation.salt = event.params.salt
    operation.save()
    
    log.info('Updated Operation {} with salt', [
      event.params.id.toHexString()
    ])
  }
}

// ============================================================================
// Access Control Event Handlers
// ============================================================================

export function handleRoleGranted(event: RoleGrantedEvent): void {
  // Save raw event entity
  let rawEvent = new RoleGranted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  rawEvent.role = event.params.role
  rawEvent.account = event.params.account
  rawEvent.sender = event.params.sender
  rawEvent.blockNumber = event.block.number
  rawEvent.blockTimestamp = event.block.timestamp
  rawEvent.transactionHash = event.transaction.hash
  rawEvent.save()

  // Create or load Role entity
  let role = Role.load(event.params.role)
  if (role == null) {
    role = new Role(event.params.role)
    role.timelockController = event.address
    role.memberCount = 0
    role.adminRole = null // Will be set by RoleAdminChanged event
  }
  
  // Increment member count
  role.memberCount = role.memberCount + 1
  role.save()
  
  // Create RoleAssignment entity
  let assignmentId = event.params.role
    .concat(event.params.account)
    .concat(event.transaction.hash)
    .concatI32(event.logIndex.toI32())
  
  let assignment = new RoleAssignment(assignmentId)
  assignment.role = event.params.role
  assignment.account = event.params.account
  assignment.granted = true
  assignment.timestamp = event.block.timestamp
  assignment.blockNumber = event.block.number
  assignment.txHash = event.transaction.hash
  assignment.sender = event.params.sender
  assignment.save()
  
  log.info('Granted role {} to account {}', [
    event.params.role.toHexString(),
    event.params.account.toHexString()
  ])
}

export function handleRoleRevoked(event: RoleRevokedEvent): void {
  // Save raw event entity
  let rawEvent = new RoleRevoked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  rawEvent.role = event.params.role
  rawEvent.account = event.params.account
  rawEvent.sender = event.params.sender
  rawEvent.blockNumber = event.block.number
  rawEvent.blockTimestamp = event.block.timestamp
  rawEvent.transactionHash = event.transaction.hash
  rawEvent.save()

  // Update Role entity
  let role = Role.load(event.params.role)
  if (role != null) {
    // Decrement member count (don't go below 0)
    if (role.memberCount > 0) {
      role.memberCount = role.memberCount - 1
    }
    role.save()
  }
  
  // Create RoleAssignment entity
  let assignmentId = event.params.role
    .concat(event.params.account)
    .concat(event.transaction.hash)
    .concatI32(event.logIndex.toI32())
  
  let assignment = new RoleAssignment(assignmentId)
  assignment.role = event.params.role
  assignment.account = event.params.account
  assignment.granted = false
  assignment.timestamp = event.block.timestamp
  assignment.blockNumber = event.block.number
  assignment.txHash = event.transaction.hash
  assignment.sender = event.params.sender
  assignment.save()
  
  log.info('Revoked role {} from account {}', [
    event.params.role.toHexString(),
    event.params.account.toHexString()
  ])
}

export function handleRoleAdminChanged(event: RoleAdminChangedEvent): void {
  // Save raw event entity
  let rawEvent = new RoleAdminChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  rawEvent.role = event.params.role
  rawEvent.previousAdminRole = event.params.previousAdminRole
  rawEvent.newAdminRole = event.params.newAdminRole
  rawEvent.blockNumber = event.block.number
  rawEvent.blockTimestamp = event.block.timestamp
  rawEvent.transactionHash = event.transaction.hash
  rawEvent.save()

  // Update Role entity
  let role = Role.load(event.params.role)
  if (role == null) {
    role = new Role(event.params.role)
    role.timelockController = event.address
    role.memberCount = 0
  }
  
  role.adminRole = event.params.newAdminRole
  role.save()
  
  log.info('Changed admin role for {} to {}', [
    event.params.role.toHexString(),
    event.params.newAdminRole.toHexString()
  ])
}

// ============================================================================
// Other Event Handlers
// ============================================================================

export function handleMinDelayChange(event: MinDelayChangeEvent): void {
  let entity = new MinDelayChange(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oldDuration = event.params.oldDuration
  entity.newDuration = event.params.newDuration

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
  
  log.info('MinDelay changed from {} to {} seconds', [
    event.params.oldDuration.toString(),
    event.params.newDuration.toString()
  ])
}
