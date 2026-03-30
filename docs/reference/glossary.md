# Glossary

Comprehensive definitions of terms and concepts used in Timelock Manager.

## A

**ABI (Application Binary Interface)**
JSON specification that describes how to interact with a smart contract. Contains function names, parameter types, and return types. Required for decoding calldata and displaying human-readable function calls.

**AccessControl**
OpenZeppelin pattern for managing permissions through roles. TimelockController uses AccessControl to implement PROPOSER, EXECUTOR, CANCELLER, and ADMIN roles.

**Admin Role** → See DEFAULT_ADMIN_ROLE

---

## B

**Batch Operation**
Multiple function calls scheduled together as a single operation. All calls execute atomically (all succeed or all fail). Scheduled via `scheduleBatch()` and executed via `executeBatch()`.

**Blockscout**
Open-source blockchain explorer for Rootstock. Timelock Manager uses Blockscout API for:
- Verifying contracts and fetching ABIs
- Fallback data source when subgraph unavailable
- Viewing transactions and addresses

**Bytes32**
32-byte (256-bit) hexadecimal value. Used for:
- Operation IDs (keccak256 hash)
- Role identifiers
- Salt values
- Predecessor references

Format: `0x` + 64 hex characters

---

## C

**Calldata**
Hex-encoded data sent with a transaction. For function calls, calldata contains:
- Function selector (first 4 bytes)
- Encoded parameters (remaining bytes)

Example: `0xa9059cbb000000000000000000000000...` (transfer function)

**Canceller Role (CANCELLER_ROLE)**
Permission to cancel pending or ready operations. Role hash: `0xfd643c...`. Low risk defensive role.

**Chain ID**
Unique identifier for a blockchain network:
- Rootstock Mainnet: 30
- Rootstock Testnet: 31

**Checksummed Address**
Ethereum address with mixed case (uppercase/lowercase) for error detection. Example: `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`

---

## D

**DAO (Decentralized Autonomous Organization)**
Organization governed by smart contracts and token holders rather than traditional management. Often uses timelocks for transparent governance.

**Decoder**
Tool that converts hex calldata into human-readable function calls and parameters. Timelock Manager's decoder supports recursive decoding of nested operations.

**Default Admin Role (DEFAULT_ADMIN_ROLE)**
Highest privilege role in TimelockController. Can grant/revoke all other roles. Role hash: `0x0000...` (zero bytes). MUST be multi-sig or governance contract.

**Delay**
Waiting period (in seconds) between scheduling an operation and when it becomes executable. Set per-operation but must be ≥ minDelay.

Typical values:
- 24 hours: 86,400 seconds
- 48 hours: 172,800 seconds
- 72 hours: 259,200 seconds

---

## E

**EOA (Externally Owned Account)**
Wallet controlled by a private key (e.g., MetaMask address). Contrasts with contract accounts. EOAs should NOT have DEFAULT_ADMIN_ROLE in production.

**Ethereum Virtual Machine (EVM)**
Runtime environment for smart contracts. Rootstock is EVM-compatible, allowing Ethereum contracts to run on Rootstock.

**eth_call**
RPC method that simulates a transaction without submitting it to the blockchain. Used for transaction simulation to check if execution will succeed.

**Executor Role (EXECUTOR_ROLE)**
Permission to execute operations that have passed their delay period. Role hash: `0xd8aa0f...`. Medium risk operational role.

---

## F

**Fallback**
Alternative data source or method when primary fails. Timelock Manager falls back to Blockscout API when The Graph subgraph is unavailable.

**4byte Directory**
Community database mapping 4-byte function selectors to function signatures. Used as last-resort fallback for decoding unverified contracts. Low confidence.

**Function Selector**
First 4 bytes of keccak256 hash of function signature. Identifies which function to call.

Example: `transfer(address,uint256)` → selector `0xa9059cbb`

---

## G

**Gas**
Computational fee for executing transactions on Rootstock. Paid in RBTC.

**GraphQL**
Query language used by The Graph for querying indexed blockchain data. More flexible than REST APIs.

**Grant (Role Grant)**
Action of giving a role to an address. Done via `grantRole(role, address)`. Requires DEFAULT_ADMIN_ROLE.

---

## H

**Hash**
Fixed-size output of a cryptographic hash function. Operation IDs are keccak256 hashes of operation parameters.

**High-Risk Function**
Functions that can have severe consequences if misused:
- `upgradeTo()`: Contract upgrades
- `transferOwnership()`: Ownership changes
- `updateDelay()`: Delay changes
- `setImplementation()`: Implementation changes

Timelock Manager flags these with warnings and requires typing "CONFIRM".

---

## I

**Implementation Address**
For proxy contracts, the address of the contract containing the actual logic. Proxies delegate all calls to implementation.

**Indexing**
Process of organizing blockchain data for efficient querying. The Graph indexes events into entities (operations, role grants, etc.).

---

## K

**Keccak256**
Cryptographic hash function used by Ethereum. Produces 32-byte hash. Used for operation IDs, function selectors, and more.

---

## M

**Mainnet**
Production blockchain network. Rootstock Mainnet (Chain ID 30) uses real RBTC with economic value.

**MinDelay**
Minimum delay enforced by TimelockController. Set at contract deployment. All operations must have delay ≥ minDelay. Cannot be changed without governance.

**Multi-sig (Multi-signature Wallet)**
Wallet requiring multiple signatures to execute transactions. Recommended for high-privilege roles. Example: 3-of-5 (3 signatures required out of 5 total signers).

---

## O

**On-chain**
Data or actions recorded on the blockchain. All timelock operations are fully on-chain for transparency.

**Operation**
Scheduled governance action in TimelockController. Contains:
- Target contract address(es)
- Function calldata
- Value (RBTC to send)
- Delay
- Predecessor
- Salt

**Operation ID**
Unique identifier (bytes32) for an operation. Calculated as keccak256 hash of operation parameters:
```solidity
keccak256(abi.encode(target, value, data, predecessor, salt))
```

**Operation Status**
Current state of an operation:
- **PENDING**: Scheduled but delay hasn't passed
- **READY**: Delay passed, can be executed
- **EXECUTED**: Successfully executed
- **CANCELLED**: Cancelled before execution

---

## P

**Predecessor**
Operation ID that must be executed before current operation. Used to enforce execution order. `0x0000...` (zero bytes) means no prerequisite.

**Proposer Role (PROPOSER_ROLE)**
Permission to schedule new operations. Role hash: `0xb09aa5...`. High risk role - can schedule any operation.

**Proxy Contract**
Contract that delegates calls to another contract (implementation). Common in upgradeable contracts. Types:
- EIP-1967: Transparent proxy
- EIP-1822: Universal upgradeable proxy
- EIP-1167: Minimal proxy (clone)

---

## R

**RBTC (Rootstock Bitcoin)**
Native currency of Rootstock. Pegged 1:1 with Bitcoin. Used for gas fees and value transfers. Symbol: RBTC.

**tRBTC**: Testnet RBTC (no real value)

**RainbowKit**
React library providing wallet connection UI. Supports MetaMask, WalletConnect, and more.

**Rate Limit**
Maximum number of requests allowed per time period. Blockscout API limits to ~10 requests/second. Timelock Manager enforces 6.6 RPS client-side.

**Ready Timestamp (Ready At)**
Unix timestamp when an operation becomes executable. Calculated as: scheduledTimestamp + delay.

**Revoke (Role Revoke)**
Action of removing a role from an address. Done via `revokeRole(role, address)`. Requires DEFAULT_ADMIN_ROLE.

**Role**
Permission level in AccessControl system. See PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE, DEFAULT_ADMIN_ROLE.

**Role Hash**
Bytes32 identifier for a role. Well-known roles have specific hashes (e.g., `0xb09aa5...` for PROPOSER_ROLE).

**Rootstock (RSK)**
Bitcoin-secured EVM-compatible smart contract platform. Two networks:
- Mainnet (Chain ID 30)
- Testnet (Chain ID 31)

**RPC (Remote Procedure Call)**
Protocol for communicating with blockchain nodes. RPC endpoints allow reading blockchain state and submitting transactions.

---

## S

**Salt**
Random bytes32 value for making operation IDs unique. Allows scheduling multiple operations with identical target/data.

**Simulation**
Pre-execution check using `eth_call` to verify transaction will succeed. Timelock Manager simulates before executing operations.

**Smart Contract**
Self-executing code deployed on blockchain. TimelockController is a smart contract.

**Subgraph**
The Graph's indexer for specific blockchain data. Timelock Manager uses subgraphs to query operations and role grants efficiently.

**Sync**
Process of indexing blockchain data into subgraph. "Synced" means subgraph is up-to-date with blockchain.

---

## T

**TanStack Query (React Query)**
React library for data fetching, caching, and synchronization. Timelock Manager uses it for all blockchain data queries.

**Target Contract**
Contract address being called by an operation. Can be different from TimelockController.

**Testnet**
Test blockchain network. Rootstock Testnet (Chain ID 31) uses test RBTC with no economic value. For development and testing.

**The Graph**
Decentralized protocol for indexing blockchain data. Provides GraphQL API for querying. Timelock Manager's primary data source.

**Timelock**
Delay mechanism enforcing waiting period between scheduling and execution. Provides transparency and opportunity for review.

**TimelockController**
OpenZeppelin smart contract implementing timelock with role-based access control. Core contract that Timelock Manager interfaces with.

**Transaction Hash (Tx Hash)**
Unique identifier for a blockchain transaction. Example: `0xabc123...`

**TTL (Time To Live)**
How long data is cached before being considered stale. Timelock Manager uses 30s-24h TTLs depending on data type.

---

## V

**Verification**
Process of publishing contract source code to block explorer. Verified contracts provide ABI automatically. Timelock Manager shows verification status.

**viem**
TypeScript library for Ethereum interactions. Modern alternative to ethers.js. Used by wagmi.

**Virtualization**
Rendering only visible items in long lists for performance. Operations Explorer uses virtualization for large operation lists.

---

## W

**wagmi**
React hooks library for Ethereum. Built on viem. Timelock Manager uses wagmi for all blockchain interactions.

**WalletConnect**
Protocol for connecting mobile wallets to dapps via QR code. Supported by RainbowKit.

**Wei**
Smallest unit of RBTC. 1 RBTC = 10^18 wei. All on-chain values are in wei.

---

## Z

**Zero Address**
`0x0000000000000000000000000000000000000000` - Special address meaning "null" or "none". Used for:
- No predecessor (operation has no dependency)
- Burn address (sending tokens to destroy them)

**Zero Bytes**
`0x0000000000000000000000000000000000000000000000000000000000000000` (32 bytes of zeros). Used for:
- DEFAULT_ADMIN_ROLE hash
- No predecessor
- Default salt values

---

## See Also

- [TimelockController Contract](timelockcontroller-contract.md) - Technical contract reference
- [Operation Statuses](operation-statuses.md) - Status definitions
- [Role Types](role-types.md) - Detailed role documentation
- [Environment Variables](environment-variables.md) - Configuration reference

---

**Confused by a term?** Check this glossary first. If still unclear, see the related documentation links above.
