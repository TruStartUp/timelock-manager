# Advanced Topics

In-depth guides for power users and advanced governance workflows.

## Overview

This section covers advanced features and concepts that go beyond basic operation of Timelock Manager. These topics are for users who need to:
- Create complex batch operations
- Manage operation dependencies
- Handle high-risk governance actions
- Understand transaction simulation
- Manage custom ABIs
- Work across multiple networks

## Advanced Guides

1. [Batch Operations](batch-operations.md) - Creating and managing multi-call proposals
2. [Operation Dependencies](operation-dependencies.md) - Using the predecessor field
3. [High-Risk Functions](high-risk-functions.md) - Understanding dangerous operations
4. [Transaction Simulation](transaction-simulation.md) - How pre-execution simulation works
5. [Custom ABI Management](custom-abi-management.md) - Managing ABIs for unverified contracts
6. [Network Switching](network-switching.md) - Multi-network workflows
7. [Blockchain Indexing](blockchain-indexing.md) - Understanding subgraph indexing internals

## Who Should Read This?

### Protocol Administrators
Advanced features for managing complex protocols:
- Batch operations for atomic multi-step upgrades
- Operation dependencies for sequenced changes
- Custom ABI management for proprietary contracts

### Security Researchers
Deep dives into security mechanisms:
- High-risk function detection
- Transaction simulation internals
- Calldata verification techniques

### Power Users
Advanced workflows and optimization:
- Network switching for testing
- Custom ABI libraries
- Blockchain indexing for custom queries

## Quick Reference

### I want to...

**Execute multiple calls atomically**
→ [Batch Operations](batch-operations.md)

**Ensure operations run in order**
→ [Operation Dependencies](operation-dependencies.md)

**Understand upgrade risks**
→ [High-Risk Functions](high-risk-functions.md)

**Know if my transaction will succeed**
→ [Transaction Simulation](transaction-simulation.md)

**Use unverified contracts**
→ [Custom ABI Management](custom-abi-management.md)

**Test on testnet before mainnet**
→ [Network Switching](network-switching.md)

**Query operations myself**
→ [Blockchain Indexing](blockchain-indexing.md)

## Key Concepts

### Batch Operations

Schedule multiple function calls that execute atomically (all-or-nothing).

**Use cases**:
- Multi-step protocol upgrades
- Treasury operations with multiple transfers
- Coordinated parameter updates across contracts

**Example**: Upgrade contract AND set new parameters in one operation

See: [Batch Operations](batch-operations.md)

---

### Operation Dependencies

Use the `predecessor` field to enforce execution order.

**Use case**: Operation B can only execute after Operation A

**Example**: Set new config BEFORE upgrading to implementation that requires it

See: [Operation Dependencies](operation-dependencies.md)

---

### High-Risk Functions

Automatically detected dangerous operations that require extra confirmation.

**Detected functions**:
- `upgradeTo(address)` - Proxy upgrades
- `transferOwnership(address)` - Ownership transfers
- `updateDelay(uint256)` - Timelock delay changes
- `setImplementation(address)` - Implementation changes

**Protection**: Requires typing "CONFIRM" to proceed

See: [High-Risk Functions](high-risk-functions.md)

---

### Transaction Simulation

Pre-execution validation using `eth_call`.

**How it works**:
1. App calls `eth_call` with operation parameters
2. RPC simulates execution without sending transaction
3. Result shows if transaction would succeed or revert

**Benefits**:
- Catch errors before spending gas
- Verify permission before attempting
- Understand revert reasons

See: [Transaction Simulation](transaction-simulation.md)

---

### Custom ABI Management

Upload and manage ABIs for unverified contracts.

**When needed**:
- Contract not verified on Blockscout
- Proprietary or private contracts
- Custom or non-standard implementations

**Features**:
- Import ABI JSON
- Associate with contract address
- Export ABI library
- Session persistence

See: [Custom ABI Management](custom-abi-management.md)

---

### Network Switching

Work with multiple networks and timelocks.

**Workflows**:
- Test proposal on testnet first
- Manage timelocks on both mainnet and testnet
- Switch between networks without losing config

**Features**:
- Network-specific timelock configurations
- Automatic subgraph switching
- RPC endpoint per network

See: [Network Switching](network-switching.md)

---

### Blockchain Indexing

Understanding how data flows from blockchain to UI.

**Topics**:
- How subgraphs index events
- GraphQL query optimization
- Indexing lag and freshness
- Custom queries for analytics

See: [Blockchain Indexing](blockchain-indexing.md)

## Advanced Workflows

### Atomic Multi-Step Upgrade

**Scenario**: Upgrade proxy and set new configuration

**Steps**:
1. Create batch operation with 2 calls:
   - Call 1: `upgradeTo(newImplementation)`
   - Call 2: `setConfig(newParams)`
2. Set appropriate delay
3. Schedule batch
4. Review during delay period
5. Execute atomically

If either call fails, both revert.

---

### Sequenced Parameter Changes

**Scenario**: Change parameter A, wait, then change parameter B

**Steps**:
1. Schedule Operation A with salt `0x01...`
2. Note Operation A's ID
3. Schedule Operation B with:
   - `predecessor = Operation A's ID`
   - `salt = 0x02...`
4. Execute Operation A when ready
5. Operation B becomes executable only after A succeeds

---

### Testing Protocol Upgrade

**Workflow**:
1. Deploy upgrade to testnet
2. Configure testnet timelock in Settings
3. Switch to testnet network
4. Schedule upgrade operation
5. Test execution on testnet
6. Verify behavior
7. Switch to mainnet
8. Schedule same operation on mainnet

---

### Custom Contract Integration

**Scenario**: Interact with unverified proprietary contract

**Steps**:
1. Obtain contract ABI from developers
2. Settings → ABI Management → Import
3. Paste ABI JSON
4. Enter contract address
5. Create proposal → Contract address auto-loads ABI
6. Select function and configure parameters

## Best Practices

### Batch Operations
- Keep batches small (< 10 calls)
- Test each call individually first
- Verify batch atomicity is needed
- Document batch purpose

### Operation Dependencies
- Don't create circular dependencies
- Document dependency reason
- Test predecessor execution first
- Consider delay between operations

### High-Risk Operations
- Always decode and verify
- Test on testnet first
- Require multiple approvals
- Document risk assessment

### Transaction Simulation
- Don't rely solely on simulation
- Simulation may not match exactly
- State may change between simulation and execution
- Always verify on-chain state

### Custom ABIs
- Keep ABI library organized
- Export backups regularly
- Verify ABI matches contract
- Document ABI sources

## Common Pitfalls

### Batch Operation Failures
**Problem**: One call in batch fails, entire batch reverts

**Solution**: Test each call individually first, verify all can succeed

---

### Predecessor Deadlock
**Problem**: Operation A depends on B, B depends on A

**Solution**: Avoid circular dependencies, plan execution order

---

### Simulation False Positives
**Problem**: Simulation succeeds but real transaction fails

**Causes**:
- State changed between simulation and execution
- Block number/timestamp dependencies
- External contract state changes

**Solution**: Execute promptly after simulation, verify state

---

### ABI Mismatch
**Problem**: Uploaded ABI doesn't match contract

**Solution**: Verify ABI source, test with known functions first

## Performance Optimization

### For Batch Operations
- Fetch all ABIs in parallel
- Cache ABI resolution
- Use session storage for manual ABIs

### For Custom Queries
- Use subgraph for complex filters
- Cache query results
- Implement pagination

### For Multi-Network
- Configure RPC per network
- Use network-specific caching
- Minimize network switches

## Related Documentation

- **User Guide**: [Creating Proposals](../user-guide/creating-proposals.md)
- **Architecture**: [Recursive Decoder](../architecture/recursive-decoder.md)
- **Security**: [Best Practices](../security/best-practices.md)
- **Reference**: [GraphQL Schema](../reference/graphql-schema.md)

---

**Dive deeper**: [Batch Operations](batch-operations.md) | [High-Risk Functions](high-risk-functions.md) | [Transaction Simulation](transaction-simulation.md)
