# Data Model: Rootstock Timelock Management App

This document defines all entities, their fields, relationships, validation rules, and state transitions for the Rootstock Timelock Management App.

---

## Entity: Operation

**Description**: Represents a scheduled governance action in a TimelockController contract. Can be either a single call (via `schedule()`) or multiple calls (via `scheduleBatch()`).

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | `Bytes` (bytes32) | Yes | 32-byte hash | Unique operation identifier computed by hashOperation() |
| index | `BigInt` | Yes | Positive integer | Sequential index for sorting (blockNumber * 1000000 + logIndex) |
| timelockController | `Address` (bytes) | Yes | Valid Ethereum address | TimelockController contract that owns this operation |
| target | `Address \| null` | No | Valid address if present | Single target for `schedule()`, null for `scheduleBatch()` |
| value | `BigInt \| null` | No | >= 0 if present | Single value in wei for `schedule()`, null for batch |
| data | `Bytes \| null` | No | Valid hex if present | Single encoded calldata for `schedule()`, null for batch |
| predecessor | `Bytes` (bytes32) | Yes | 32 bytes | Predecessor operation that must execute first (0x0 if none) |
| salt | `Bytes` (bytes32) | Yes | 32 bytes | Salt for operation ID uniqueness |
| delay | `BigInt` | Yes | >= minDelay | Delay in seconds before operation becomes executable |
| timestamp | `BigInt` | Yes | > 0 | Ready timestamp (scheduledAt + delay) |
| status | `OperationStatus` | Yes | Enum value | Current status: PENDING, READY, EXECUTED, CANCELLED |
| scheduledAt | `BigInt` | Yes | Block timestamp | When the operation was scheduled |
| scheduledTx | `Bytes` (bytes32) | Yes | Transaction hash | TX that scheduled this operation |
| scheduledBy | `Address` | Yes | Valid address | Proposer who scheduled (must have PROPOSER_ROLE) |
| executedAt | `BigInt \| null` | No | Block timestamp | When executed (null if not executed) |
| executedTx | `Bytes \| null` | No | TX hash | TX that executed (null if not executed) |
| executedBy | `Address \| null` | No | Valid address | Executor who executed (null if not executed) |
| cancelledAt | `BigInt \| null` | No | Block timestamp | When cancelled (null if not cancelled) |
| cancelledTx | `Bytes \| null` | No | TX hash | TX that cancelled (null if not cancelled) |
| cancelledBy | `Address \| null` | No | Valid address | Canceller who cancelled (null if not cancelled) |

**Relationships**:
- One Operation has many Calls (0 for single call stored in operation, 1+ for batch)
- One TimelockController has many Operations

**State Transitions**:

```
                    ┌─────────────┐
                    │  SCHEDULED  │
                    │  (Initial)  │
                    └──────┬──────┘
                           │
                           ▼
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────┐       ┌───────────┐
   │ PENDING │       │  READY  │       │ CANCELLED │
   │timestamp│──────>│timestamp│       │  (Final)  │
   │not reach│       │ reached │       └───────────┘
   └────┬────┘       └────┬────┘             ▲
        │                 │                  │
        │                 ▼                  │
        │           ┌───────────┐            │
        │           │ EXECUTED  │            │
        │           │  (Final)  │            │
        │           └───────────┘            │
        │                                    │
        └────────────────────────────────────┘
              cancel() called
```

**Status Calculation Logic**:
```typescript
function calculateStatus(operation: Operation, currentTimestamp: BigInt): OperationStatus {
  // Check final states first
  if (operation.executedAt !== null) return OperationStatus.EXECUTED;
  if (operation.cancelledAt !== null) return OperationStatus.CANCELLED;

  // Check if ready vs pending
  if (currentTimestamp >= operation.timestamp) {
    return OperationStatus.READY;
  } else {
    return OperationStatus.PENDING;
  }
}
```

**Indexes**:
- `id` (primary key)
- `timelockController` (for filtering by contract)
- `status` (for status filters: pending, ready, etc.)
- `scheduledBy` (for filtering by proposer)
- `scheduledAt` (for date range filters and sorting)
- `timestamp` (for ETA sorting)

**Validation Rules from Requirements**:
- **FR-018**: Status MUST be calculated as: Pending (timestamp not reached), Ready (timestamp reached), Executed (executed), Canceled (cancelled)
- **FR-019**: Display operation ID, status, call count, targets, ETA, scheduled time, proposer
- **FR-022**: Show predecessor, salt, delay, timestamps, operation ID

---

## Entity: Call

**Description**: An individual function call within an operation. For single-call operations, data is often stored in the Operation entity. For batch operations, each call is a separate entity.

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | `Bytes` | Yes | Composite key | operationId-index (e.g., 0x123...abc-0) |
| operation | `Operation` | Yes | Valid operation ID | Parent operation this call belongs to |
| index | `Int` | Yes | >= 0 | Index within batch (from CallScheduled event) |
| target | `Address` | Yes | Valid Ethereum address | Target contract to call |
| value | `BigInt` | Yes | >= 0 | Value to send in wei (can be 0) |
| data | `Bytes` | Yes | Valid hex bytes | Encoded function calldata |
| signature | `String \| null` | No | Function signature format | Decoded function signature (if ABI available) |

**Relationships**:
- Many Calls belong to one Operation

**Indexes**:
- `id` (primary key)
- `operation` (for querying all calls in an operation)
- `target` (for filtering by target contract)

**Validation Rules from Requirements**:
- **FR-023**: Display target address, value in rBTC, raw calldata
- **FR-024**: Decode calldata when ABI available, show function + args

---

## Entity: Role

**Description**: An AccessControl role in the TimelockController contract. Standard roles are PROPOSER, EXECUTOR, CANCELLER, and DEFAULT_ADMIN.

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | `Bytes` (bytes32) | Yes | 32-byte role hash | Keccak256 hash of role name |
| roleHash | `Bytes` (bytes32) | Yes | Same as id | Redundant for convenience |
| timelockController | `Address` | Yes | Valid address | TimelockController this role belongs to |
| adminRole | `Role \| null` | No | Valid role ID | Admin role that can grant/revoke this role |
| memberCount | `Int` | Yes | >= 0 | Current number of members (updated on grant/revoke) |

**Relationships**:
- One Role has many RoleAssignments
- One Role may have one admin Role (self-referential)
- One TimelockController has many Roles (4 standard + any custom)

**Standard Role Constants**:
```typescript
const PROPOSER_ROLE = "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1";
const EXECUTOR_ROLE = "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";
const CANCELLER_ROLE = "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b6223913e945f67199f";
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
```

**Indexes**:
- `id` (primary key)
- `timelockController` (for fetching all roles for a contract)

**Validation Rules from Requirements**:
- **FR-011**: Display four standard roles with their hashes
- **FR-014**: Link to AccessManager if DEFAULT_ADMIN_ROLE held by AccessManager contract

---

## Entity: RoleAssignment

**Description**: Event-sourced record of role grants and revokes. Each RoleGranted or RoleRevoked event creates an immutable RoleAssignment entity.

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | `Bytes` | Yes | Composite | roleHash-account-txHash |
| role | `Role` | Yes | Valid role ID | Role being granted or revoked |
| account | `Address` | Yes | Valid address | Account receiving or losing the role |
| granted | `Boolean` | Yes | true or false | true = RoleGranted, false = RoleRevoked |
| timestamp | `BigInt` | Yes | Block timestamp | When the event occurred |
| blockNumber | `BigInt` | Yes | > 0 | Block number of the event |
| txHash | `Bytes` (bytes32) | Yes | TX hash | Transaction that emitted the event |
| sender | `Address` | Yes | Valid address | Address that called grantRole/revokeRole |

**Relationships**:
- Many RoleAssignments belong to one Role

**Computing Current Members**:
```typescript
function getCurrentMembers(role: Role): Address[] {
  // Get all assignments for this role, sorted by blockNumber ASC
  const assignments = role.assignments.sort((a, b) => a.blockNumber - b.blockNumber);

  const memberMap = new Map<Address, boolean>();

  // Event-source: replay grants and revokes
  for (const assignment of assignments) {
    if (assignment.granted) {
      memberMap.set(assignment.account, true);
    } else {
      memberMap.delete(assignment.account);
    }
  }

  return Array.from(memberMap.keys());
}
```

**Indexes**:
- `id` (primary key)
- `role` (for fetching all events for a role)
- `account` (for fetching all roles for an account)
- `timestamp` (for chronological history display)

**Validation Rules from Requirements**:
- **FR-012**: Fetch role members by querying RoleGranted/RoleRevoked events
- **FR-015**: Show role history with action type, target address, TX hash, timestamp

---

## Entity: TimelockController

**Description**: Metadata about a TimelockController contract instance being explored.

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | `Address` (bytes) | Yes | Valid address | Contract address |
| address | `Address` | Yes | Same as id | Redundant for convenience |
| minDelay | `BigInt` | Yes | > 0 | Current minimum delay in seconds |
| operationCount | `Int` | Yes | >= 0 | Total operations scheduled |

**Relationships**:
- One TimelockController has many Operations
- One TimelockController has many Roles

**Indexes**:
- `id` (primary key)

**Validation Rules from Requirements**:
- **FR-007**: Accept TimelockController address as input
- **FR-008**: Validate contract implements required functions
- **FR-009**: Retrieve and display minDelay via getMinDelay()

---

## Entity: ContractABI

**Description**: Cached ABI for contract interaction and calldata decoding. Stored in sessionStorage (not blockchain/subgraph).

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| address | `Address` | Yes | Valid address | Contract address |
| abi | `ABIDefinition[]` | Yes | Valid JSON ABI | OpenZeppelin ABI format |
| source | `ABISource` | Yes | Enum value | MANUAL, BLOCKSCOUT, KNOWN_REGISTRY, FOURBYTE |
| confidence | `ABIConfidence` | Yes | Enum value | HIGH, MEDIUM, LOW |
| isProxy | `boolean` | Yes | true/false | Whether this is a proxy contract |
| implementationAddress | `Address \| null` | No | Valid address | Implementation address for proxies |
| fetchedAt | `timestamp` | Yes | ISO 8601 | When ABI was fetched |
| ttl | `number` | Yes | Seconds | Time to live (session or 5 minutes) |

**ABISource Enum**:
```typescript
enum ABISource {
  MANUAL = "MANUAL",                  // User-provided
  BLOCKSCOUT = "BLOCKSCOUT",          // Blockscout verified
  KNOWN_REGISTRY = "KNOWN_REGISTRY",  // Pre-configured known contract
  FOURBYTE = "FOURBYTE"               // 4byte directory lookup
}
```

**ABIConfidence Enum**:
```typescript
enum ABIConfidence {
  HIGH = "HIGH",      // Manual, Blockscout verified, Known registry
  MEDIUM = "MEDIUM",  // Blockscout unverified but implementation found
  LOW = "LOW"         // 4byte directory guess
}
```

**ABI Resolution Priority**:
1. Manual (HIGH confidence)
2. Session cache (confidence from original source)
3. Blockscout verified with proxy resolution (HIGH)
4. Known registry (HIGH)
5. 4byte directory (LOW)

**Storage Strategy**:
```typescript
// SessionStorage schema
interface ABICache {
  [address: string]: {
    abi: ABIDefinition[];
    source: ABISource;
    confidence: ABIConfidence;
    isProxy: boolean;
    implementationAddress: string | null;
    fetchedAt: string;
    ttl: number;
  }
}
```

**Validation Rules from Requirements**:
- **FR-035**: Fetch ABI via Blockscout API
- **FR-036**: Detect proxy and fetch implementation ABI
- **FR-037**: Check known contracts registry
- **FR-051**: Priority order for ABI resolution
- **FR-052**: Query 4byte directory as fallback
- **FR-057**: Store user ABIs in sessionStorage

---

## Entity: NetworkConfiguration

**Description**: Configuration for connecting to Rootstock networks. Stored in application config and environment variables.

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| chainId | `number` | Yes | 30 or 31 | Chain ID (30 = mainnet, 31 = testnet) |
| chainName | `string` | Yes | Not empty | Human-readable name |
| rpcUrl | `string` | Yes | Valid URL | RPC endpoint URL |
| blockscoutApiUrl | `string` | Yes | Valid URL | Blockscout API base URL |
| subgraphUrl | `string` | Yes | Valid URL | The Graph subgraph endpoint |
| nativeCurrency | `Currency` | Yes | Valid object | Native currency details |
| blockExplorerUrl | `string` | Yes | Valid URL | Block explorer base URL |

**Currency Object**:
```typescript
interface Currency {
  name: string;      // "Rootstock Bitcoin"
  symbol: string;    // "RBTC"
  decimals: number;  // 18
}
```

**Default Configurations**:
```typescript
const ROOTSTOCK_MAINNET: NetworkConfiguration = {
  chainId: 30,
  chainName: "Rootstock Mainnet",
  rpcUrl: process.env.NEXT_PUBLIC_RSK_MAINNET_RPC_URL || "https://public-node.rsk.co",
  blockscoutApiUrl: "https://explorer.rsk.co/api",
  subgraphUrl: process.env.NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL,
  nativeCurrency: { name: "Rootstock Bitcoin", symbol: "RBTC", decimals: 18 },
  blockExplorerUrl: "https://explorer.rsk.co"
};

const ROOTSTOCK_TESTNET: NetworkConfiguration = {
  chainId: 31,
  chainName: "Rootstock Testnet",
  rpcUrl: process.env.NEXT_PUBLIC_RSK_TESTNET_RPC_URL || "https://public-node.testnet.rsk.co",
  blockscoutApiUrl: "https://explorer.testnet.rsk.co/api",
  subgraphUrl: process.env.NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL,
  nativeCurrency: { name: "Rootstock Bitcoin", symbol: "tRBTC", decimals: 18 },
  blockExplorerUrl: "https://explorer.testnet.rsk.co"
};
```

**Validation Rules from Requirements**:
- **FR-002**: Support chainId 30 and 31
- **FR-006**: Load RPC URLs from environment variables

---

## Enums

### OperationStatus

```typescript
enum OperationStatus {
  PENDING = "PENDING",      // Scheduled, timestamp not reached
  READY = "READY",          // Timestamp reached, executable
  EXECUTED = "EXECUTED",    // Successfully executed
  CANCELLED = "CANCELLED"   // Cancelled before execution
}
```

### ABISource

```typescript
enum ABISource {
  MANUAL = "MANUAL",
  BLOCKSCOUT = "BLOCKSCOUT",
  KNOWN_REGISTRY = "KNOWN_REGISTRY",
  FOURBYTE = "FOURBYTE"
}
```

### ABIConfidence

```typescript
enum ABIConfidence {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW"
}
```

---

## Summary

This data model supports all 69 functional requirements with:
- **6 core entities**: Operation, Call, Role, RoleAssignment, TimelockController, NetworkConfiguration
- **1 cache entity**: ContractABI (sessionStorage)
- **3 enums**: OperationStatus, ABISource, ABIConfidence
- **Immutable event sourcing** for RoleAssignments and Operations
- **Efficient indexing** for all query patterns (status filters, address searches, date ranges)
- **State transitions** clearly defined for operations
- **Validation rules** mapped to functional requirements

All entities align with The Graph subgraph best practices (immutable entities, derived relationships, proper indexing) and support the hybrid data strategy (subgraph + RPC + Blockscout fallback).
