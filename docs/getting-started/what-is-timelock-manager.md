# What is Timelock Manager?

Timelock Manager is a comprehensive Web3 application for interacting with OpenZeppelin TimelockController contracts on Rootstock networks.

## Overview

In blockchain governance, **timelocks** are smart contracts that enforce a delay between scheduling an operation and executing it. This delay provides transparency and gives stakeholders time to review proposed changes before they take effect.

Timelock Manager provides a user-friendly interface to:

* Schedule new governance operations
* Browse and filter scheduled operations
* Execute ready operations
* Cancel pending operations
* Manage roles and permissions
* Decode and verify operation calldata

<figure><img src="../.gitbook/assets/Screenshot 2025-12-19 at 4.32.56 PM.png" alt=""><figcaption></figcaption></figure>

## Why Timelocks Matter

Timelocks are critical for secure governance because they:

1. **Provide Transparency**: All operations are publicly visible before execution
2. **Enable Review**: Stakeholders can examine proposals during the delay period
3. **Allow Response**: Malicious proposals can be cancelled before execution
4. **Build Trust**: Predictable process increases confidence in governance

### Real-World Example

Imagine a DAO wants to upgrade its treasury contract:

```
Without Timelock:
Admin calls upgradeTo() → Immediate execution → No review possible

With Timelock:
1. Proposer schedules upgrade → 48-hour delay begins
2. Community reviews the upgrade during delay
3. After 48 hours, executor can execute the upgrade
4. If issues found, canceller can cancel before execution
```

## Key Features

### 1. Operations Explorer

Browse all operations with powerful filtering:

* Filter by status (Pending, Ready, Executed, Cancelled)
* Search by operation ID or address
* Date range filtering
* View operation details and decoded calldata

\[Screenshot placeholder: Operations Explorer with filters]

### 2. Proposal Creation Wizard

Step-by-step interface for scheduling operations:

* **Step 1**: Select target contract and fetch ABI
* **Step 2**: Configure function calls with parameters
* **Step 3**: Review and schedule with delay settings

Supports both single operations and batch operations (multiple calls executed atomically).

\[Screenshot placeholder: Proposal wizard Step 2]

### 3. Calldata Decoder

Decode and verify operation calldata:

* Recursive decoding of nested operations
* ABI verification (Blockscout verified vs guessed)
* AI-powered explanations (optional)
* Human-readable parameter display

\[Screenshot placeholder: Decoder showing decoded operation]

### 4. Role Management

View and audit governance permissions:

* See all role grants and members
* View role grant/revoke history
* Check your own permissions
* Links to Blockscout for detailed exploration

### 5. Multi-Timelock Support

Manage multiple TimelockController contracts:

* Configure multiple timelocks
* Switch between networks (mainnet/testnet)
* Network-specific settings
* Per-timelock subgraph URLs

### 6. Dual Data Sources

Resilient data fetching with automatic fallback:

* **Primary**: The Graph subgraphs (fast, indexed)
* **Fallback**: Blockscout API (always available)
* Transparent switching based on availability

### 7. Security Features

Built-in safety mechanisms:

* High-risk function detection
* Transaction simulation before execution
* Role-based access control
* ABI verification and confidence levels

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Timelock Manager UI               │
└────────────┬───────────────┬────────────────┘
             │               │
        ┌────▼────┐     ┌────▼────┐
        │Subgraph │     │ wagmi   │
        │(indexed)│     │  (RPC)  │
        └────┬────┘     └────┬────┘
             │               │
        ┌────▼───────────────▼────┐
        │    Rootstock Network    │
        │  (TimelockController)   │
        └─────────────────────────┘
```

1. **Data Layer**: The Graph subgraph indexes timelock events into queryable entities
2. **Application Layer**: Next.js app provides UI and business logic
3. **Blockchain Layer**: wagmi/viem connects to Rootstock RPC for transactions

### User Roles

TimelockController defines four key roles:

| Role          | Permission                | Risk Level |
| ------------- | ------------------------- | ---------- |
| **Proposer**  | Schedule operations       | High       |
| **Executor**  | Execute ready operations  | Medium     |
| **Canceller** | Cancel pending operations | Low        |
| **Admin**     | Grant/revoke roles        | Critical   |

Each operation requires specific roles at different stages:

* **Scheduling**: Requires PROPOSER role
* **Execution**: Requires EXECUTOR role
* **Cancellation**: Requires CANCELLER role

See: [Understanding Roles](../user-guide/understanding-roles.md)

## Use Cases

### Protocol Governance

**Scenario**: DAO managing DeFi protocol

**Workflow**:

1. DAO member proposes parameter change
2. Proposal scheduled through Timelock Manager
3. Community reviews during delay period
4. Trusted executor executes if approved
5. All actions recorded on-chain for audit

### Treasury Management

**Scenario**: Multi-sig controlling treasury

**Workflow**:

1. Treasury operator schedules batch payment
2. Batch includes multiple transfers
3. Other signers review in Operations Explorer
4. After delay, batch executes atomically
5. All transfers succeed or all revert

### Protocol Upgrades

**Scenario**: Upgrading proxy contract

**Workflow**:

1. Developer schedules `upgradeTo(newImplementation)`
2. Decoder shows upgrade target and parameters
3. Security team reviews new implementation
4. After delay, upgrade executes
5. High-risk warning requires explicit confirmation

### Emergency Response

**Scenario**: Malicious proposal discovered

**Workflow**:

1. Security team monitors Operations Explorer
2. Suspicious operation detected
3. Canceller role used to cancel operation
4. Compromised proposer role revoked
5. Incident documented in audit trail

## Technology Stack

Built with modern Web3 technologies:

* **Frontend**: Next.js 14, TypeScript, Tailwind CSS
* **Web3**: wagmi, viem, RainbowKit
* **Data**: The Graph, Blockscout API
* **State**: TanStack Query, React Context
* **Blockchain**: Rootstock (Bitcoin-secured EVM)

## Rootstock Integration

### Why Rootstock?

Rootstock is an EVM-compatible smart contract platform secured by Bitcoin's proof-of-work:

* **Bitcoin Security**: Inherits Bitcoin's hash power
* **EVM Compatible**: Run Ethereum smart contracts
* **Low Fees**: Cost-effective transactions
* **Fast Blocks**: \~30 second block time

### Supported Networks

* **Mainnet** (Chain ID 30): Production deployments
* **Testnet** (Chain ID 31): Development and testing

Get testnet RBTC: [Rootstock Faucet](https://faucet.rootstock.io/)

## Core Concepts

### Operations

An **operation** is a scheduled function call (or batch of calls) in the TimelockController:

```solidity
struct Operation {
  bytes32 id;           // Unique identifier
  address target;       // Contract to call
  uint256 value;        // ETH to send
  bytes data;           // Encoded function call
  bytes32 predecessor;  // Must execute after this operation
  bytes32 salt;         // For uniqueness
}
```

### Operation Lifecycle

```
Schedule → Pending → Ready → Executed
                       ↓
                   Cancelled
```

1. **Schedule**: Proposer schedules operation
2. **Pending**: Waiting for delay to pass
3. **Ready**: Delay passed, can be executed
4. **Executed**: Successfully executed
5. **Cancelled**: Cancelled before execution

### Delay

The **delay** is the waiting period (in seconds) between scheduling and execution:

* Set at TimelockController deployment
* Can be updated through governance
* Typical delays: 24-72 hours
* Balances security vs agility

## Benefits

### For Governance Participants

* **User-Friendly**: No need to interact with contracts directly
* **Transparent**: See all operations and their status
* **Safe**: Built-in verification and simulation
* **Efficient**: Fast queries with subgraph indexing

### For Protocol Administrators

* **Comprehensive**: All governance features in one place
* **Flexible**: Supports complex batch operations
* **Auditable**: Full on-chain history
* **Resilient**: Automatic fallback if services are down

### For Security Teams

* **Visibility**: Monitor all proposals in real-time
* **Verification**: Decode and verify calldata
* **Control**: Cancel malicious proposals quickly
* **Traceability**: Immutable audit trail

## Comparison with Alternatives

| Feature                | Timelock Manager | Block Explorer | Direct Contract Calls |
| ---------------------- | ---------------- | -------------- | --------------------- |
| User-friendly          | ✅ Yes            | ❌ No           | ❌ No                  |
| Decode calldata        | ✅ Automatic      | ⚠️ Manual      | ❌ No                  |
| Filter operations      | ✅ Yes            | ⚠️ Limited     | ❌ No                  |
| Batch operations       | ✅ UI support     | ❌ No           | ⚠️ Manual             |
| Transaction simulation | ✅ Built-in       | ❌ No           | ❌ No                  |
| Multi-timelock         | ✅ Yes            | ❌ No           | ❌ No                  |
| AI explanations        | ✅ Optional       | ❌ No           | ❌ No                  |

## Getting Started

Ready to use Timelock Manager?

1. [Check Prerequisites](prerequisites.md) - Ensure you have what you need
2. [Quick Start Guide](quick-start.md) - Get up and running fast
3. [Connect Your Wallet](../user-guide/connecting-wallet.md) - Set up wallet connection
4. [Explore Operations](../user-guide/operations-explorer.md) - Start browsing operations

## Next Steps

* **New User**: Start with [Quick Start](quick-start.md)
* **Developer**: See [Installation](../developer-guide/installation.md)
* **Administrator**: Check [Subgraph Deployment](../subgraph-deployment/subgraph-deployment.md)

***

**Continue reading**: [Prerequisites](prerequisites.md) → [Quick Start](quick-start.md)
