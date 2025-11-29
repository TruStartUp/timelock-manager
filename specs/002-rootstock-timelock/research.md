# Rootstock Timelock Management App - Technical Research

This document outlines key technology decisions, patterns, and best practices for building the Rootstock Timelock Management App. Each section addresses a specific technical challenge with actionable recommendations.

---

## 1. The Graph Subgraph Best Practices for TimelockController

### Decision

Structure the subgraph schema with separate entities for `Operation`, `Call`, `Role`, and `RoleAssignment`. Use immutable entities for event-driven data (CallScheduled, CallExecuted, Cancelled) with derived relationships from the one side.

### Rationale

- **Immutable Entities**: TimelockController events (CallScheduled, CallExecuted, Cancelled, RoleGranted, RoleRevoked) represent one-time blockchain occurrences that should never be modified, making them ideal candidates for immutable entities marked with `(immutable: true)`
- **Performance Optimization**: The Graph best practices recommend storing relationships on the "one" side (Operation) and deriving the "many" side (Calls) to dramatically increase both indexing and querying performance
- **Batch Operations Support**: When `scheduleBatch` is called, OpenZeppelin's TimelockController emits one CallScheduled event per transaction in the batch. Each event includes an `index` parameter to maintain order within the batch
- **Event Processing Order**: The Graph processes events in the order they appear in blocks, ensuring that CallScheduled events from the same transaction are processed sequentially with their correct indices

### Alternatives Considered

- **Single Entity Approach**: Storing all operation data (including multiple calls) in a single entity with array fields was rejected because The Graph's best practices explicitly warn against large arrays, which hurt performance and create copies on updates
- **Storing Relationships on Both Sides**: This was rejected because it creates redundant data and reduces performance compared to using derived fields
- **Using Non-Immutable Entities**: This was rejected because TimelockController events never change once emitted, and immutable entities provide faster indexing

### Implementation Notes

**Schema Structure:**

```graphql
type Operation @entity(immutable: true) {
  id: Bytes! # Operation hash (bytes32)
  index: BigInt! # Sequential index for sorting
  target: Bytes # Single target (for schedule) or null (for batch)
  value: BigInt # Single value (for schedule) or null (for batch)
  data: Bytes # Single data (for schedule) or null (for batch)
  predecessor: Bytes! # bytes32 predecessor hash
  salt: Bytes! # bytes32 salt
  delay: BigInt! # Delay in seconds
  timestamp: BigInt! # Ready timestamp (block.timestamp + delay)
  status: OperationStatus! # PENDING, READY, EXECUTED, CANCELLED
  scheduledAt: BigInt! # Block timestamp when scheduled
  scheduledTx: Bytes! # Transaction hash
  executedAt: BigInt # Block timestamp when executed (if applicable)
  executedTx: Bytes # Transaction hash (if executed)
  cancelledAt: BigInt # Block timestamp when cancelled (if applicable)
  cancelledTx: Bytes # Transaction hash (if cancelled)
  calls: [Call!]! @derivedFrom(field: "operation") # Derived relationship
}

type Call @entity(immutable: true) {
  id: Bytes! # Composite: operationId-index
  operation: Operation! # Parent operation
  index: Int! # Index within batch (from event)
  target: Bytes! # Target contract address
  value: BigInt! # Value in wei
  data: Bytes! # Encoded function call data
  signature: String # Decoded function signature (if available)
}

type Role @entity {
  id: Bytes! # Role hash (PROPOSER_ROLE, EXECUTOR_ROLE, etc.)
  roleHash: Bytes! # bytes32 role identifier
  adminRole: Role # Admin role that can grant/revoke this role
  members: [RoleAssignment!]! @derivedFrom(field: "role")
}

type RoleAssignment @entity(immutable: true) {
  id: Bytes! # Composite: roleHash-account-txHash
  role: Role! # Parent role
  account: Bytes! # Account address
  granted: Boolean! # true = granted, false = revoked
  timestamp: BigInt! # Block timestamp
  txHash: Bytes! # Transaction hash
}

enum OperationStatus {
  PENDING
  READY
  EXECUTED
  CANCELLED
}
```

**Handling Batch Operations in Mappings:**

```typescript
export function handleCallScheduled(event: CallScheduled): void {
  const operationId = event.params.id
  const index = event.params.index

  // Create or load Operation entity
  let operation = Operation.load(operationId)
  if (operation == null) {
    operation = new Operation(operationId)
    operation.predecessor = event.params.predecessor
    operation.salt = event.params.salt
    operation.delay = event.params.delay
    operation.timestamp = event.block.timestamp.plus(event.params.delay)
    operation.status = 'PENDING'
    operation.scheduledAt = event.block.timestamp
    operation.scheduledTx = event.transaction.hash
    operation.index = event.block.number
      .times(BigInt.fromI32(1000000))
      .plus(event.logIndex)
  }

  // Check if this is a batch operation (index > 0) or single operation
  if (index.isZero()) {
    // Single operation
    operation.target = event.params.target
    operation.value = event.params.value
    operation.data = event.params.data
  }

  operation.save()

  // Create Call entity for both single and batch operations
  const callId = operationId.concat(Bytes.fromI32(index.toI32()))
  let call = new Call(callId)
  call.operation = operation.id
  call.index = index.toI32()
  call.target = event.params.target
  call.value = event.params.value
  call.data = event.params.data
  // Optionally decode signature from data
  call.signature = decodeSignature(event.params.data)
  call.save()
}
```

**Handling Chain Reorganizations:**
Use The Graph's built-in support for reorgs by ensuring all entities are properly indexed with block numbers. The Graph automatically handles reorgs by reverting entities created in reverted blocks.

**Query Optimization Patterns:**

```graphql
# Query operations with their calls efficiently (derived field)
query GetOperationWithCalls($operationId: Bytes!) {
  operation(id: $operationId) {
    id
    status
    timestamp
    scheduledAt
    calls {
      index
      target
      value
      data
      signature
    }
  }
}

# Query pending operations sorted by ready timestamp
query GetPendingOperations {
  operations(
    where: { status: PENDING }
    orderBy: timestamp
    orderDirection: asc
  ) {
    id
    timestamp
    calls {
      target
      signature
    }
  }
}
```

**Using indexerHints for Pruning:**
Add to subgraph manifest to enable automatic pruning of old data:

```yaml
features:
  - ipfsOnEthereumContracts
indexerHints:
  prune: auto
```

### References

- [The Graph Best Practice Cookbook](https://thegraph.academy/developers/best-practice/)
- [The Graph Advanced Features](https://thegraph.com/docs/en/subgraphs/developing/creating/advanced/)
- [OpenZeppelin Subgraphs](https://github.com/OpenZeppelin/openzeppelin-subgraphs)
- [OpenZeppelin TimelockController Source](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/TimelockController.sol)
- [Avoiding Large Arrays in Subgraphs](https://thegraph.com/blog/improve-subgraph-performance-avoiding-large-arrays/)

---

## 2. Proxy Contract Detection (EIP-1967 & EIP-1822)

### Decision

Use the `evm-proxy-detection` library with viem's public client to automatically detect and handle multiple proxy patterns (EIP-1967, EIP-1822, EIP-1167, etc.) with graceful fallbacks.

### Rationale

- **Multiple Standards Support**: Real-world contracts use various proxy patterns. The `evm-proxy-detection` library handles EIP-1967 (Transparent Proxy), EIP-1822 (UUPS), EIP-1167 (Minimal Proxy/Clone), and other patterns automatically
- **Viem Integration**: The library accepts any EIP-1193-compatible provider, making it seamless to integrate with viem's public client
- **Batch RPC Support**: By using viem's HTTP transport with `batch: true`, proxy detection can make multiple storage slot reads efficiently in a single RPC batch
- **Type Safety**: The library returns structured results including proxy type and implementation address, enabling type-safe handling downstream

### Alternatives Considered

- **Manual Storage Slot Reading**: Implementing manual `getStorageAt` calls for each proxy standard was rejected due to complexity, maintenance burden, and lack of support for edge cases
- **Only Supporting EIP-1967**: This was rejected because many contracts use UUPS (EIP-1822) or other patterns, and limiting support would reduce app utility
- **Contract Calls to Implementation Getters**: Some proxies don't expose public getters, making this approach unreliable

### Implementation Notes

**Installation:**

```bash
npm install evm-proxy-detection viem
```

**Basic Implementation:**

```typescript
import { createPublicClient, http, type Address } from 'viem'
import { detectProxy } from 'evm-proxy-detection'
import { rootstock } from 'wagmi/chains'

// Create viem public client with batch support
const publicClient = createPublicClient({
  chain: rootstock,
  transport: http(undefined, { batch: true }),
})

/**
 * Detects if an address is a proxy and returns implementation address
 * @param address Contract address to check
 * @returns Implementation address if proxy, original address if not
 */
export async function resolveImplementation(address: Address): Promise<{
  isProxy: boolean
  implementation: Address
  proxyType?: string
}> {
  try {
    const result = await detectProxy(address, publicClient.request)

    if (result) {
      return {
        isProxy: true,
        implementation: result.target as Address,
        proxyType: result.type,
      }
    }

    // Not a proxy, return original address
    return {
      isProxy: false,
      implementation: address,
    }
  } catch (error) {
    console.error('Proxy detection failed:', error)
    // Fallback: assume not a proxy
    return {
      isProxy: false,
      implementation: address,
    }
  }
}
```

**Storage Slots for Manual Detection (Fallback):**
If the library is unavailable, here are the key storage slots:

```typescript
// EIP-1967 Storage Slots
const EIP1967_SLOTS = {
  // keccak256('eip1967.proxy.implementation') - 1
  IMPLEMENTATION:
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  // keccak256('eip1967.proxy.admin') - 1
  ADMIN: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  // keccak256('eip1967.proxy.beacon') - 1
  BEACON: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
} as const

// EIP-1822 (UUPS) Storage Slot
const EIP1822_SLOT =
  '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7' // keccak256("PROXIABLE")

/**
 * Manual fallback for detecting EIP-1967 proxies
 */
async function detectEIP1967Manually(
  address: Address
): Promise<Address | null> {
  try {
    const implementationSlot = await publicClient.getStorageAt({
      address,
      slot: EIP1967_SLOTS.IMPLEMENTATION,
    })

    if (implementationSlot && implementationSlot !== '0x' + '0'.repeat(64)) {
      // Remove leading zeros and format as address
      return ('0x' + implementationSlot.slice(-40)) as Address
    }

    return null
  } catch {
    return null
  }
}
```

**Integration with ABI Fetching:**

```typescript
/**
 * Fetches ABI for a contract, resolving proxies first
 */
export async function fetchContractABI(address: Address): Promise<any[]> {
  // Step 1: Resolve proxy to implementation
  const { implementation, proxyType } = await resolveImplementation(address)

  console.log(
    proxyType
      ? `Detected ${proxyType} proxy, fetching ABI for implementation: ${implementation}`
      : `No proxy detected, fetching ABI for: ${address}`
  )

  // Step 2: Fetch ABI from Blockscout using implementation address
  const abi = await fetchABIFromBlockscout(implementation)

  return abi
}
```

**Edge Cases and Fallbacks:**

1. **Storage Read Failures**: If storage reads fail (node doesn't support it), fall back to assuming no proxy
2. **Invalid Implementation Address**: Validate that the resolved address is a valid checksummed address
3. **Beacon Proxies**: For EIP-1967 beacon proxies, the implementation is stored in the beacon contract, requiring a second resolution step
4. **Metamorphic Contracts**: Some contracts can change their code; cache with short TTL and provide manual refresh option

**Caching Strategy:**

```typescript
// Cache proxy detection results (5 minute TTL)
const proxyCache = new Map<
  Address,
  {
    result: { isProxy: boolean; implementation: Address; proxyType?: string }
    timestamp: number
  }
>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function resolveImplementationCached(address: Address) {
  const cached = proxyCache.get(address)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result
  }

  const result = await resolveImplementation(address)
  proxyCache.set(address, { result, timestamp: Date.now() })
  return result
}
```

### References

- [evm-proxy-detection on GitHub](https://github.com/abipub/evm-proxy-detection)
- [EIP-1967: Standard Proxy Storage Slots](https://eips.ethereum.org/EIPS/eip-1967)
- [EIP-1822: Universal Upgradeable Proxy Standard (UUPS)](https://eips.ethereum.org/EIPS/eip-1822)
- [EIP-1167: Minimal Proxy Contract](https://eips.ethereum.org/EIPS/eip-1167)
- [Viem getStorageAt Documentation](https://viem.sh/docs/contract/getStorageAt.html)
- [OpenZeppelin Proxy Documentation](https://docs.openzeppelin.com/contracts/4.x/api/proxy)

---

## 3. Blockscout API Integration Patterns

### Decision

Use Blockscout's v2 REST API with IP-based rate limiting awareness (10 RPS default), implement exponential backoff retry logic, and cache ABI responses in localStorage with TTL-based invalidation.

### Rationale

- **v2 REST API Stability**: Blockscout's v2 API provides stable endpoints for contract verification status and ABI retrieval with clear response formats
- **Rate Limiting Reality**: The default 10 requests/second limit is shared across all users on the same IP. API keys don't help for REST endpoints (only JSON RPC), so client-side rate limiting and caching are essential
- **Rootstock Support**: Blockscout is the primary block explorer for Rootstock (rootstock.blockscout.com and rootstock-testnet.blockscout.com), making it the authoritative source for verified contract ABIs
- **Graceful Degradation**: When Blockscout is unavailable, the app should fall back to manual ABI input rather than failing completely

### Alternatives Considered

- **Etherscan API**: Not applicable for Rootstock network
- **On-Chain ABI Storage**: Very few contracts store ABIs on-chain; this would have extremely limited utility
- **Sourcify Integration**: Could be added as a secondary fallback, but Blockscout integration is more critical for Rootstock

### Implementation Notes

**Blockscout v2 API Endpoints for Rootstock:**

```typescript
const BLOCKSCOUT_API_BASE = {
  mainnet: 'https://rootstock.blockscout.com/api/v2',
  testnet: 'https://rootstock-testnet.blockscout.com/api/v2',
} as const

/**
 * Blockscout v2 API client with rate limiting and caching
 */
export class BlockscoutClient {
  private baseUrl: string
  private requestQueue: Array<() => Promise<void>> = []
  private processing = false
  private lastRequestTime = 0
  private readonly REQUEST_INTERVAL = 150 // 150ms = ~6.6 RPS (conservative)

  constructor(network: 'mainnet' | 'testnet') {
    this.baseUrl = BLOCKSCOUT_API_BASE[network]
  }

  /**
   * Rate-limited request wrapper
   */
  private async rateLimitedRequest<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < this.REQUEST_INTERVAL) {
            await new Promise((r) =>
              setTimeout(r, this.REQUEST_INTERVAL - timeSinceLastRequest)
            )
          }

          const response = await fetch(url, options)
          this.lastRequestTime = Date.now()

          if (!response.ok) {
            if (response.status === 429) {
              throw new Error('RATE_LIMITED')
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()
          resolve(data)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    this.processing = true
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) await request()
    }
    this.processing = false
  }

  /**
   * Fetch contract ABI from Blockscout with retries
   */
  async getContractABI(
    address: Address,
    maxRetries = 3
  ): Promise<{ abi: any[]; verified: boolean }> {
    const cacheKey = `blockscout_abi_${address}_${this.baseUrl}`

    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    let lastError: Error | null = null
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const data = await this.rateLimitedRequest<{
          is_verified: boolean
          abi?: any[]
          message?: string
        }>(`${this.baseUrl}/smart-contracts/${address}`)

        if (!data.is_verified) {
          return { abi: [], verified: false }
        }

        if (!data.abi) {
          throw new Error('ABI not found in verified contract response')
        }

        const result = { abi: data.abi, verified: true }
        this.saveToCache(cacheKey, result)
        return result
      } catch (error) {
        lastError = error as Error

        if (error.message === 'RATE_LIMITED') {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000
          await new Promise((r) => setTimeout(r, backoffMs))
          continue
        }

        // Don't retry on 404 (contract not found)
        if (error.message.includes('404')) {
          return { abi: [], verified: false }
        }

        // Retry other errors
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('Failed to fetch ABI from Blockscout')
  }

  /**
   * Get contract verification status (lightweight check)
   */
  async isContractVerified(address: Address): Promise<boolean> {
    try {
      const data = await this.rateLimitedRequest<{ is_verified: boolean }>(
        `${this.baseUrl}/smart-contracts/${address}`
      )
      return data.is_verified
    } catch {
      return false
    }
  }

  /**
   * Cache helpers with TTL
   */
  private getFromCache(key: string): any | null {
    try {
      const cached = localStorage.getItem(key)
      if (!cached) return null

      const { data, timestamp } = JSON.parse(cached)
      const TTL = 24 * 60 * 60 * 1000 // 24 hours

      if (Date.now() - timestamp < TTL) {
        return data
      }

      localStorage.removeItem(key)
      return null
    } catch {
      return null
    }
  }

  private saveToCache(key: string, data: any): void {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      )
    } catch (error) {
      console.warn('Failed to cache ABI:', error)
    }
  }
}
```

**Usage Example:**

```typescript
// In your React component or service
const blockscout = new BlockscoutClient(chainId === 30 ? 'mainnet' : 'testnet')

try {
  const { abi, verified } = await blockscout.getContractABI(contractAddress)

  if (!verified) {
    // Show manual ABI input UI
    setShowManualABIInput(true)
  } else {
    // Use the ABI
    setContractABI(abi)
  }
} catch (error) {
  console.error('Blockscout API error:', error)
  // Fallback: show manual ABI input
  setShowManualABIInput(true)
}
```

**Error Handling Strategy:**

1. **429 Rate Limit**: Exponential backoff (1s, 2s, 4s) then show user message
2. **404 Not Found**: Assume unverified contract, offer manual ABI input
3. **500 Server Error**: Retry with backoff, then show "Blockscout unavailable" message
4. **Network Error**: Retry once, then show offline message
5. **Invalid Response**: Log error, fall back to manual input

**Cache Invalidation:**

```typescript
// Clear ABI cache for specific address (user-triggered)
export function clearABICache(
  address: Address,
  network: 'mainnet' | 'testnet'
) {
  const baseUrl = BLOCKSCOUT_API_BASE[network]
  const cacheKey = `blockscout_abi_${address}_${baseUrl}`
  localStorage.removeItem(cacheKey)
}

// Clear all expired cache entries (run on app startup)
export function clearExpiredCache() {
  const TTL = 24 * 60 * 60 * 1000
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('blockscout_abi_')) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const { timestamp } = JSON.parse(cached)
          if (Date.now() - timestamp >= TTL) {
            localStorage.removeItem(key)
          }
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
  }
}
```

**Batch ABI Fetching Pattern:**
When loading multiple operations that target different contracts:

```typescript
async function fetchABIsForOperations(operations: Operation[]) {
  // Extract unique contract addresses
  const uniqueAddresses = [
    ...new Set(operations.flatMap((op) => op.calls.map((call) => call.target))),
  ]

  // Fetch ABIs in parallel with rate limiting built-in
  const abiResults = await Promise.allSettled(
    uniqueAddresses.map((address) => blockscout.getContractABI(address))
  )

  // Build address -> ABI map
  const abiMap = new Map<Address, any[]>()
  uniqueAddresses.forEach((address, i) => {
    const result = abiResults[i]
    if (result.status === 'fulfilled' && result.value.verified) {
      abiMap.set(address, result.value.abi)
    }
  })

  return abiMap
}
```

### References

- [Blockscout Smart Contract Verification API](https://docs.blockscout.com/devs/verification/blockscout-smart-contract-verification-api)
- [Blockscout API Requests & Limits](https://docs.blockscout.com/devs/apis/requests-and-limits)
- [Rootstock Mainnet Blockscout](https://rootstock.blockscout.com/)
- [Rootstock Testnet Blockscout](https://rootstock-testnet.blockscout.com/)

---

## 4. ABI-Driven Dynamic Form Generation

### Decision

Build a React Hook Form + Zod-based dynamic form generator that parses ABI function inputs and generates typed form fields with comprehensive validation for Solidity types (address, uint*, int*, bytes\*, string, bool, arrays, tuples).

### Rationale

- **Type Safety**: Zod provides runtime validation that catches errors before submission, preventing failed transactions due to invalid inputs
- **Developer Experience**: React Hook Form offers excellent performance with minimal re-renders and simple integration patterns
- **Solidity Type Coverage**: The system must handle all common Solidity types including complex ones (arrays, tuples/structs) to support arbitrary contract interactions
- **User Feedback**: Real-time validation with clear error messages improves UX and reduces transaction failures

### Alternatives Considered

- **Formik + Yup**: More verbose than React Hook Form, slower performance with large forms
- **Uncontrolled Forms**: No validation until submission, poor UX
- **Manual Validation**: Error-prone, doesn't scale to complex types

### Implementation Notes

**Core Types and Validation:**

```typescript
import { z } from 'zod'
import { isAddress, getAddress } from 'viem'

/**
 * Zod validators for Solidity types
 */
export const solidityValidators = {
  // Address with EIP-55 checksum validation
  address: z
    .string()
    .refine((val) => isAddress(val), { message: 'Invalid Ethereum address' })
    .transform((val) => getAddress(val)), // Normalize to checksummed

  // uint8 to uint256
  uint: (bits: number = 256) => {
    const max = BigInt(2 ** bits) - BigInt(1)
    return z.string().refine(
      (val) => {
        try {
          const n = BigInt(val)
          return n >= BigInt(0) && n <= max
        } catch {
          return false
        }
      },
      { message: `Must be a valid uint${bits} (0 to ${max.toString()})` }
    )
  },

  // int8 to int256
  int: (bits: number = 256) => {
    const max = BigInt(2 ** (bits - 1)) - BigInt(1)
    const min = -BigInt(2 ** (bits - 1))
    return z.string().refine(
      (val) => {
        try {
          const n = BigInt(val)
          return n >= min && n <= max
        } catch {
          return false
        }
      },
      {
        message: `Must be a valid int${bits} (${min.toString()} to ${max.toString()})`,
      }
    )
  },

  // bytes (dynamic) - hex string
  bytes: z
    .string()
    .refine((val) => /^0x[0-9a-fA-F]*$/.test(val) && val.length % 2 === 0, {
      message: 'Must be a valid hex string (0x...)',
    }),

  // bytesN (fixed) - hex string with exact length
  bytesFixed: (size: number) =>
    z
      .string()
      .refine(
        (val) => /^0x[0-9a-fA-F]*$/.test(val) && val.length === 2 + size * 2,
        {
          message: `Must be a ${size}-byte hex string (${2 + size * 2} chars including 0x)`,
        }
      ),

  // string (UTF-8)
  string: z.string().min(0),

  // bool
  bool: z.boolean(),

  // array (dynamic) - JSON array string
  array: (elementSchema: z.ZodTypeAny) => z.array(elementSchema),

  // tuple (struct) - JSON object or array
  tuple: (components: z.ZodTypeAny[]) => z.tuple(components as any),
}

/**
 * Parse ABI type string into Zod schema
 */
export function parseABITypeToZod(
  type: string,
  components?: any[]
): z.ZodTypeAny {
  // Handle arrays: uint256[], address[3]
  const arrayMatch = type.match(/^(.+?)\[(\d*)\]$/)
  if (arrayMatch) {
    const [, baseType, size] = arrayMatch
    const elementSchema = parseABITypeToZod(baseType)

    if (size) {
      // Fixed-size array: address[3]
      return z.array(elementSchema).length(parseInt(size), {
        message: `Array must have exactly ${size} elements`,
      })
    } else {
      // Dynamic array: uint256[]
      return z.array(elementSchema).min(0)
    }
  }

  // Handle tuple (struct)
  if (type === 'tuple' && components) {
    const schemas = components.map((comp) =>
      parseABITypeToZod(comp.type, comp.components)
    )
    return solidityValidators.tuple(schemas)
  }

  // Handle uint variants
  if (type.startsWith('uint')) {
    const bits = parseInt(type.slice(4)) || 256
    return solidityValidators.uint(bits)
  }

  // Handle int variants
  if (type.startsWith('int')) {
    const bits = parseInt(type.slice(3)) || 256
    return solidityValidators.int(bits)
  }

  // Handle bytes variants
  if (type.startsWith('bytes')) {
    const size = parseInt(type.slice(5))
    return size ? solidityValidators.bytesFixed(size) : solidityValidators.bytes
  }

  // Handle primitive types
  switch (type) {
    case 'address':
      return solidityValidators.address
    case 'string':
      return solidityValidators.string
    case 'bool':
      return solidityValidators.bool
    default:
      throw new Error(`Unsupported ABI type: ${type}`)
  }
}
```

**Dynamic Form Generator Component:**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface ABIInput {
  name: string;
  type: string;
  components?: ABIInput[];
  internalType?: string;
}

interface DynamicFormProps {
  inputs: ABIInput[];
  onSubmit: (values: Record<string, any>) => void;
}

export function DynamicABIForm({ inputs, onSubmit }: DynamicFormProps) {
  // Build Zod schema from ABI inputs
  const schema = z.object(
    inputs.reduce((acc, input) => {
      acc[input.name] = parseABITypeToZod(input.type, input.components);
      return acc;
    }, {} as Record<string, z.ZodTypeAny>)
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {inputs.map((input) => (
        <FormField
          key={input.name}
          input={input}
          register={register}
          error={errors[input.name]}
          setValue={setValue}
          value={watch(input.name)}
        />
      ))}
      <button
        type="submit"
        className="btn-primary"
      >
        Submit
      </button>
    </form>
  );
}
```

**Form Field Component with Type-Specific Inputs:**

```typescript
function FormField({ input, register, error, setValue, value }: FormFieldProps) {
  const { name, type } = input;

  // Handle bool (checkbox)
  if (type === 'bool') {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          {...register(name)}
          className="form-checkbox"
        />
        <span>{name}</span>
        {error && <span className="text-red-500 text-sm">{error.message}</span>}
      </label>
    );
  }

  // Handle arrays (JSON input or multi-field)
  if (type.includes('[')) {
    return (
      <div className="space-y-2">
        <label className="block font-medium">{name} ({type})</label>
        <textarea
          {...register(name, {
            setValueAs: (v) => {
              try {
                return JSON.parse(v);
              } catch {
                return v;
              }
            }
          })}
          placeholder={`["value1", "value2"]`}
          className="form-textarea"
          rows={3}
        />
        <p className="text-sm text-gray-500">
          Enter as JSON array: ["value1", "value2"]
        </p>
        {error && <span className="text-red-500 text-sm">{error.message}</span>}
      </div>
    );
  }

  // Handle tuple/struct (JSON input)
  if (type === 'tuple') {
    return (
      <div className="space-y-2">
        <label className="block font-medium">{name} (struct)</label>
        <textarea
          {...register(name, {
            setValueAs: (v) => {
              try {
                return JSON.parse(v);
              } catch {
                return v;
              }
            }
          })}
          placeholder={`{"field1": "value1", "field2": "value2"}`}
          className="form-textarea"
          rows={4}
        />
        <div className="text-sm text-gray-500">
          <p>Enter as JSON object with fields:</p>
          <ul className="list-disc list-inside">
            {input.components?.map(comp => (
              <li key={comp.name}>{comp.name}: {comp.type}</li>
            ))}
          </ul>
        </div>
        {error && <span className="text-red-500 text-sm">{error.message}</span>}
      </div>
    );
  }

  // Handle address (with checksum icon)
  if (type === 'address') {
    return (
      <div className="space-y-2">
        <label className="block font-medium">{name}</label>
        <div className="relative">
          <input
            type="text"
            {...register(name)}
            placeholder="0x..."
            className="form-input font-mono"
          />
          {value && isAddress(value) && (
            <span className="absolute right-2 top-2 text-green-500">✓</span>
          )}
        </div>
        {error && <span className="text-red-500 text-sm">{error.message}</span>}
      </div>
    );
  }

  // Handle uint/int (with range hint)
  if (type.startsWith('uint') || type.startsWith('int')) {
    const bits = parseInt(type.match(/\d+/)?.[0] || '256');
    const isSigned = type.startsWith('int');
    const max = isSigned
      ? BigInt(2 ** (bits - 1)) - BigInt(1)
      : BigInt(2 ** bits) - BigInt(1);
    const min = isSigned ? -(BigInt(2 ** (bits - 1))) : BigInt(0);

    return (
      <div className="space-y-2">
        <label className="block font-medium">{name} ({type})</label>
        <input
          type="text"
          {...register(name)}
          placeholder={`${min.toString()} to ${max.toString()}`}
          className="form-input font-mono"
        />
        <p className="text-xs text-gray-500">
          Range: {min.toString()} to {max.toString()}
        </p>
        {error && <span className="text-red-500 text-sm">{error.message}</span>}
      </div>
    );
  }

  // Handle bytes (hex input)
  if (type.startsWith('bytes')) {
    const size = parseInt(type.slice(5));
    return (
      <div className="space-y-2">
        <label className="block font-medium">{name} ({type})</label>
        <input
          type="text"
          {...register(name)}
          placeholder={size ? `0x... (${size * 2} hex chars)` : "0x..."}
          className="form-input font-mono"
        />
        {error && <span className="text-red-500 text-sm">{error.message}</span>}
      </div>
    );
  }

  // Default: string input
  return (
    <div className="space-y-2">
      <label className="block font-medium">{name} ({type})</label>
      <input
        type="text"
        {...register(name)}
        className="form-input"
      />
      {error && <span className="text-red-500 text-sm">{error.message}</span>}
    </div>
  );
}
```

**Usage in Schedule Operation Flow:**

```typescript
function ScheduleOperationForm({ targetContract }: Props) {
  const [abi, setABI] = useState<any[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<any>(null);

  // Fetch ABI from Blockscout
  useEffect(() => {
    async function loadABI() {
      const { abi } = await blockscout.getContractABI(targetContract);
      setABI(abi);
    }
    loadABI();
  }, [targetContract]);

  // Filter to write functions only
  const writeFunctions = abi.filter(
    item => item.type === 'function' && item.stateMutability !== 'view' && item.stateMutability !== 'pure'
  );

  async function handleSubmit(formData: Record<string, any>) {
    // Encode function call data
    const encodedData = encodeFunctionData({
      abi: abi,
      functionName: selectedFunction.name,
      args: Object.values(formData)
    });

    // Schedule operation via TimelockController
    await scheduleOperation({
      target: targetContract,
      value: 0n,
      data: encodedData,
      predecessor: '0x' + '0'.repeat(64),
      salt: generateSalt(),
      delay: minDelay
    });
  }

  return (
    <div>
      {/* Function selector */}
      <select
        value={selectedFunction?.name || ''}
        onChange={(e) => {
          const fn = writeFunctions.find(f => f.name === e.target.value);
          setSelectedFunction(fn);
        }}
      >
        <option value="">Select function...</option>
        {writeFunctions.map(fn => (
          <option key={fn.name} value={fn.name}>
            {fn.name}({fn.inputs.map(i => i.type).join(', ')})
          </option>
        ))}
      </select>

      {/* Dynamic form for selected function */}
      {selectedFunction && (
        <DynamicABIForm
          inputs={selectedFunction.inputs}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
```

### References

- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [Solidity ABI Specification](https://docs.soliditylang.org/en/latest/abi-spec.html)
- [Viem encodeFunctionData](https://viem.sh/docs/contract/encodeFunctionData.html)
- [EIP-55: Mixed-case checksum address encoding](https://eips.ethereum.org/EIPS/eip-55)

---

## 5. Rootstock Network Configuration with wagmi

### Decision

Configure custom Rootstock chains (mainnet: 30, testnet: 31) using wagmi's `defineChain` with official RPC endpoints and Blockscout explorers, integrate with RainbowKit for wallet connection UI, and implement network switching with fallback to `wallet_addEthereumChain`.

### Rationale

- **Official Starter Kit Reference**: Rootstock provides an official wagmi starter kit with pre-configured chain settings, ensuring compatibility
- **Wagmi v2 Pattern**: The `defineChain` function provides type-safe chain configuration with built-in validation
- **RainbowKit Integration**: RainbowKit's custom chain support allows seamless integration of Rootstock with popular wallet connectors
- **Network Switching UX**: Proactive network detection with one-click switching reduces user friction

### Alternatives Considered

- **Hardcoded Chain Objects**: Less maintainable than using `defineChain` with proper typing
- **Only Supporting Mainnet**: Developers need testnet access; conditional testnet support is essential
- **Manual Network Addition**: Showing instructions instead of programmatic addition creates poor UX

### Implementation Notes

**Chain Configuration (src/chains.ts):**

```typescript
import { defineChain } from 'viem'

/**
 * Rootstock Mainnet (Chain ID: 30)
 */
export const rootstock = defineChain({
  id: 30,
  name: 'Rootstock',
  nativeCurrency: {
    decimals: 18,
    name: 'Smart Bitcoin',
    symbol: 'RBTC',
  },
  rpcUrls: {
    default: {
      http: ['https://public-node.rsk.co'],
    },
    public: {
      http: ['https://public-node.rsk.co'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://rootstock.blockscout.com',
    },
  },
  contracts: {
    // Add common Rootstock contracts here if needed
    // multicall3: {
    //   address: '0x...',
    //   blockCreated: 0,
    // },
  },
})

/**
 * Rootstock Testnet (Chain ID: 31)
 */
export const rootstockTestnet = defineChain({
  id: 31,
  name: 'Rootstock Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Test Smart Bitcoin',
    symbol: 'tRBTC',
  },
  rpcUrls: {
    default: {
      http: ['https://public-node.testnet.rsk.co'],
    },
    public: {
      http: ['https://public-node.testnet.rsk.co'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://rootstock-testnet.blockscout.com',
    },
  },
  testnet: true,
})
```

**Wagmi Configuration (src/wagmi.ts):**

```typescript
import { http, createConfig } from 'wagmi'
import { rootstock, rootstockTestnet } from './chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Determine which chains to support
const chains = [
  rootstock,
  ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
    ? [rootstockTestnet]
    : []),
] as const

export const config = createConfig({
  chains,
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    }),
  ],
  transports: {
    [rootstock.id]: http(),
    [rootstockTestnet.id]: http(),
  },
  ssr: true,
})

// Export for easy access
export { rootstock, rootstockTestnet }
```

**RainbowKit Configuration (src/rainbowkit.ts):**

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { rootstock, rootstockTestnet } from './chains'

export const rainbowkitConfig = getDefaultConfig({
  appName: 'Rootstock Timelock Manager',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [
    rootstock,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
      ? [rootstockTestnet]
      : []),
  ] as const,
  ssr: true,
})
```

**Network Switching Component:**

```typescript
import { useSwitchChain, useAccount, useChainId } from 'wagmi';
import { rootstock, rootstockTestnet } from './chains';

export function NetworkSwitcher({ requiredChainId }: { requiredChainId: number }) {
  const { switchChain, isPending } = useSwitchChain();
  const { isConnected } = useAccount();
  const currentChainId = useChainId();

  if (!isConnected || currentChainId === requiredChainId) {
    return null;
  }

  const requiredChain = requiredChainId === 30 ? rootstock : rootstockTestnet;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="font-semibold text-yellow-900 mb-2">
        Wrong Network
      </h3>
      <p className="text-sm text-yellow-800 mb-3">
        Please switch to {requiredChain.name} to continue.
      </p>
      <button
        onClick={() => switchChain({ chainId: requiredChainId })}
        disabled={isPending}
        className="btn-primary"
      >
        {isPending ? 'Switching...' : `Switch to ${requiredChain.name}`}
      </button>
    </div>
  );
}
```

**Programmatic Network Addition (Fallback):**

```typescript
import { rootstock, rootstockTestnet } from './chains'

/**
 * Add Rootstock network to MetaMask if not present
 */
export async function addRootstockToMetaMask(chainId: 30 | 31) {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not installed')
  }

  const chain = chainId === 30 ? rootstock : rootstockTestnet

  try {
    // Try to switch first
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
  } catch (switchError: any) {
    // Chain not added, add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${chainId.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpcUrls.default.http[0]],
            blockExplorerUrls: [chain.blockExplorers.default.url],
          },
        ],
      })
    } else {
      throw switchError
    }
  }
}
```

**Usage in App Provider:**

```typescript
// src/pages/_app.tsx
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { rainbowkitConfig } from '../rainbowkit';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={rainbowkitConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Environment Variables (.env.local):**

```bash
# Enable Rootstock Testnet in addition to Mainnet
NEXT_PUBLIC_ENABLE_TESTNETS=true

# WalletConnect Project ID (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

**Network Detection Hook:**

```typescript
import { useChainId } from 'wagmi'
import { rootstock, rootstockTestnet } from './chains'

export function useRootstockNetwork() {
  const chainId = useChainId()

  const isRootstock =
    chainId === rootstock.id || chainId === rootstockTestnet.id
  const isMainnet = chainId === rootstock.id
  const isTestnet = chainId === rootstockTestnet.id

  const currentChain = isMainnet
    ? rootstock
    : isTestnet
      ? rootstockTestnet
      : null

  return {
    isRootstock,
    isMainnet,
    isTestnet,
    chainId,
    currentChain,
  }
}
```

### References

- [Rootstock Wagmi Starter Kit](https://github.com/rsksmart/rsk-wagmi-starter-kit)
- [Rootstock Developer Portal - Wagmi Quickstart](https://dev.rootstock.io/developers/quickstart/wagmi/)
- [Wagmi defineChain](https://wagmi.sh/core/api/chains)
- [RainbowKit Custom Chains](https://rainbowkit.com/docs/custom-chains)
- [EIP-3085: wallet_addEthereumChain](https://eips.ethereum.org/EIPS/eip-3085)
- [EIP-3326: wallet_switchEthereumChain](https://eips.ethereum.org/EIPS/eip-3326)

---

## 6. Real-Time Role Permission Verification

### Decision

Use wagmi's `useReadContract` hook with TanStack Query's `staleTime` and `gcTime` configuration, implement optimistic caching with 5-minute TTL, and provide manual refresh triggers for critical permission checks.

### Rationale

- **Built-in Caching**: TanStack Query (integrated with wagmi) provides automatic caching with stale-time management, eliminating need for custom cache implementation
- **Minimal RPC Calls**: With proper `staleTime`, permission checks are read from cache unless data is stale, dramatically reducing RPC overhead
- **Real-Time Updates**: Query invalidation on role change events ensures UI reflects current permissions
- **User Experience**: Loading states and optimistic updates prevent UI flicker while maintaining accuracy

### Alternatives Considered

- **Direct RPC Polling**: High network overhead, poor performance, potential rate limiting
- **WebSocket Subscriptions**: Not widely supported by Rootstock public nodes, added complexity
- **No Caching**: Every UI component would trigger separate RPC calls, unacceptable performance
- **Local State Only**: Would become stale, causing security issues with outdated permissions

### Implementation Notes

**Permission Check Hook with Caching:**

```typescript
import { useReadContract, useAccount } from 'wagmi'
import { Address, zeroHash } from 'viem'

// AccessControl ABI fragment
const ACCESS_CONTROL_ABI = [
  {
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Common roles for TimelockController
export const TIMELOCK_ROLES = {
  ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000', // DEFAULT_ADMIN_ROLE
  PROPOSER:
    '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1', // keccak256("PROPOSER_ROLE")
  EXECUTOR:
    '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63', // keccak256("EXECUTOR_ROLE")
  CANCELLER:
    '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783', // keccak256("CANCELLER_ROLE")
} as const

interface UseHasRoleOptions {
  enabled?: boolean
  staleTime?: number // How long data is considered fresh (default: 5 minutes)
  gcTime?: number // How long to keep in cache (default: 10 minutes)
}

/**
 * Check if an account has a specific role in a contract
 */
export function useHasRole(
  contractAddress: Address,
  role: string,
  accountAddress?: Address,
  options: UseHasRoleOptions = {}
) {
  const { address: connectedAddress } = useAccount()
  const account = accountAddress || connectedAddress

  const {
    data: hasRole,
    isLoading,
    isError,
    error,
    refetch,
    queryKey,
  } = useReadContract({
    address: contractAddress,
    abi: ACCESS_CONTROL_ABI,
    functionName: 'hasRole',
    args: [role as `0x${string}`, account!],
    query: {
      enabled: !!account && options.enabled !== false,
      staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes default
      gcTime: options.gcTime || 10 * 60 * 1000, // 10 minutes default
      retry: 2,
    },
  })

  return {
    hasRole: hasRole ?? false,
    isLoading,
    isError,
    error,
    refetch,
    queryKey,
  }
}
```

**Multi-Role Check Hook (Batch Optimization):**

```typescript
import { useReadContracts } from 'wagmi'

/**
 * Check multiple roles at once (more efficient)
 */
export function useHasRoles(
  contractAddress: Address,
  roles: string[],
  accountAddress?: Address,
  options: UseHasRoleOptions = {}
) {
  const { address: connectedAddress } = useAccount()
  const account = accountAddress || connectedAddress

  const contracts = roles.map((role) => ({
    address: contractAddress,
    abi: ACCESS_CONTROL_ABI,
    functionName: 'hasRole' as const,
    args: [role as `0x${string}`, account!] as const,
  }))

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: !!account && options.enabled !== false,
      staleTime: options.staleTime || 5 * 60 * 1000,
      gcTime: options.gcTime || 10 * 60 * 1000,
    },
  })

  const roleResults = roles.reduce(
    (acc, role, index) => {
      acc[role] = data?.[index]?.result ?? false
      return acc
    },
    {} as Record<string, boolean>
  )

  return {
    roles: roleResults,
    hasAnyRole: Object.values(roleResults).some(Boolean),
    hasAllRoles: Object.values(roleResults).every(Boolean),
    isLoading,
    isError,
    error,
    refetch,
  }
}
```

**Convenience Hooks for Timelock Roles:**

```typescript
/**
 * Check if connected account can propose operations
 */
export function useCanPropose(timelockAddress: Address) {
  return useHasRole(timelockAddress, TIMELOCK_ROLES.PROPOSER)
}

/**
 * Check if connected account can execute operations
 */
export function useCanExecute(timelockAddress: Address) {
  return useHasRole(timelockAddress, TIMELOCK_ROLES.EXECUTOR)
}

/**
 * Check if connected account can cancel operations
 */
export function useCanCancel(timelockAddress: Address) {
  return useHasRole(timelockAddress, TIMELOCK_ROLES.CANCELLER)
}

/**
 * Check if connected account is admin
 */
export function useIsAdmin(timelockAddress: Address) {
  return useHasRole(timelockAddress, TIMELOCK_ROLES.ADMIN)
}

/**
 * Get all timelock permissions at once
 */
export function useTimelockPermissions(timelockAddress: Address) {
  return useHasRoles(timelockAddress, [
    TIMELOCK_ROLES.ADMIN,
    TIMELOCK_ROLES.PROPOSER,
    TIMELOCK_ROLES.EXECUTOR,
    TIMELOCK_ROLES.CANCELLER,
  ])
}
```

**Automatic Invalidation on Role Changes:**

```typescript
import { useQueryClient } from '@tanstack/react-query'
import { useWatchContractEvent } from 'wagmi'

// RoleGranted/RoleRevoked event ABI
const ROLE_CHANGE_EVENTS_ABI = [
  {
    type: 'event',
    name: 'RoleGranted',
    inputs: [
      { name: 'role', type: 'bytes32', indexed: true },
      { name: 'account', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'RoleRevoked',
    inputs: [
      { name: 'role', type: 'bytes32', indexed: true },
      { name: 'account', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
    ],
  },
] as const

/**
 * Watch for role changes and invalidate queries
 */
export function useInvalidateRolesOnChange(timelockAddress: Address) {
  const queryClient = useQueryClient()

  // Watch RoleGranted events
  useWatchContractEvent({
    address: timelockAddress,
    abi: ROLE_CHANGE_EVENTS_ABI,
    eventName: 'RoleGranted',
    onLogs() {
      // Invalidate all hasRole queries for this contract
      queryClient.invalidateQueries({
        queryKey: [
          'readContract',
          { address: timelockAddress, functionName: 'hasRole' },
        ],
      })
    },
  })

  // Watch RoleRevoked events
  useWatchContractEvent({
    address: timelockAddress,
    abi: ROLE_CHANGE_EVENTS_ABI,
    eventName: 'RoleRevoked',
    onLogs() {
      queryClient.invalidateQueries({
        queryKey: [
          'readContract',
          { address: timelockAddress, functionName: 'hasRole' },
        ],
      })
    },
  })
}
```

**UI Component with Permission Gates:**

```typescript
function OperationControls({ timelockAddress, operation }: Props) {
  const { hasRole: canExecute, isLoading: loadingExecute } = useCanExecute(timelockAddress);
  const { hasRole: canCancel, isLoading: loadingCancel } = useCanCancel(timelockAddress);

  // Watch for role changes
  useInvalidateRolesOnChange(timelockAddress);

  if (loadingExecute || loadingCancel) {
    return <div className="text-sm text-gray-500">Checking permissions...</div>;
  }

  return (
    <div className="flex gap-2">
      {canExecute && operation.status === 'READY' && (
        <button onClick={() => executeOperation(operation)} className="btn-primary">
          Execute
        </button>
      )}
      {canCancel && operation.status === 'PENDING' && (
        <button onClick={() => cancelOperation(operation)} className="btn-danger">
          Cancel
        </button>
      )}
      {!canExecute && !canCancel && (
        <div className="text-sm text-gray-500">
          No permissions for this operation
        </div>
      )}
    </div>
  );
}
```

**Manual Refresh Pattern:**

```typescript
function PermissionSettings({ timelockAddress }: Props) {
  const { roles, isLoading, refetch } = useTimelockPermissions(timelockAddress);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Permissions</h2>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="btn-secondary text-sm"
        >
          {isLoading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      <ul className="space-y-2">
        <li>
          Admin: {roles[TIMELOCK_ROLES.ADMIN] ? '✓' : '✗'}
        </li>
        <li>
          Proposer: {roles[TIMELOCK_ROLES.PROPOSER] ? '✓' : '✗'}
        </li>
        <li>
          Executor: {roles[TIMELOCK_ROLES.EXECUTOR] ? '✓' : '✗'}
        </li>
        <li>
          Canceller: {roles[TIMELOCK_ROLES.CANCELLER] ? '✓' : '✗'}
        </li>
      </ul>
    </div>
  );
}
```

**Graceful Degradation on RPC Failure:**

```typescript
function useHasRoleWithFallback(
  contractAddress: Address,
  role: string,
  accountAddress?: Address
) {
  const result = useHasRole(contractAddress, role, accountAddress)

  if (result.isError) {
    console.warn(
      'Permission check failed, assuming no permission:',
      result.error
    )
    // Fail closed: assume no permission on error
    return {
      ...result,
      hasRole: false,
      errorMessage: 'Unable to verify permissions. Please refresh.',
    }
  }

  return result
}
```

### References

- [Wagmi useReadContract](https://wagmi.sh/react/api/hooks/useReadContract)
- [Wagmi useReadContracts (batching)](https://wagmi.sh/react/api/hooks/useReadContracts)
- [TanStack Query staleTime & gcTime](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [OpenZeppelin AccessControl](https://docs.openzeppelin.com/contracts/4.x/api/access#AccessControl)

---

## 7. Operation Status Calculation

### Decision

Implement a deterministic status calculation using TimelockController's `getTimestamp`, `isOperationReady`, and `isOperationDone` functions, with client-side timestamp comparison for "Ready" detection and real-time countdown timers.

### Rationale

- **Contract Authority**: The TimelockController contract is the source of truth for operation states. Using its view functions ensures accuracy
- **Four-State Model**: OpenZeppelin's model (Unset, Pending, Ready, Done) maps cleanly to UI states with clear transitions
- **Block Timestamp Reliability**: Ethereum/Rootstock block timestamps are monotonically increasing and safe for timelock comparisons
- **Real-Time UX**: Client-side countdown timers provide better UX than static "ready at" timestamps

### Alternatives Considered

- **Polling Contract State**: Too many RPC calls, poor performance
- **Server-Side Status Calculation**: Adds latency, requires backend infrastructure
- **Relying Only on Events**: Misses status transitions (e.g., Pending → Ready) that occur passively

### Implementation Notes

**TimelockController View Functions:**

```typescript
const TIMELOCK_CONTROLLER_ABI = [
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getTimestamp',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'isOperationReady',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'isOperationDone',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'isOperationPending',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMinDelay',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
```

**Operation Status Type:**

```typescript
export type OperationStatus =
  | 'UNSET'
  | 'PENDING'
  | 'READY'
  | 'EXECUTED'
  | 'CANCELLED'

export interface OperationStatusInfo {
  status: OperationStatus
  timestamp: bigint // Ready timestamp (0 for UNSET, 1 for DONE/CANCELLED)
  isReady: boolean
  isDone: boolean
  isPending: boolean
  secondsUntilReady: number | null // null if not pending
}
```

**Status Calculation Hook:**

```typescript
import { useReadContracts, useBlockNumber } from 'wagmi'
import { useEffect, useState } from 'react'

const _DONE_TIMESTAMP = 1n // OpenZeppelin uses timestamp=1 for done operations

/**
 * Get comprehensive operation status from TimelockController
 */
export function useOperationStatus(
  timelockAddress: Address,
  operationId: `0x${string}`
): OperationStatusInfo & { isLoading: boolean; error: Error | null } {
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Batch fetch all status data
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'getTimestamp',
        args: [operationId],
      },
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'isOperationReady',
        args: [operationId],
      },
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'isOperationDone',
        args: [operationId],
      },
      {
        address: timelockAddress,
        abi: TIMELOCK_CONTROLLER_ABI,
        functionName: 'isOperationPending',
        args: [operationId],
      },
    ],
    query: {
      staleTime: 30_000, // 30 seconds
      refetchInterval: 30_000, // Refetch every 30 seconds
    },
  })

  if (isLoading || !data) {
    return {
      status: 'UNSET',
      timestamp: 0n,
      isReady: false,
      isDone: false,
      isPending: false,
      secondsUntilReady: null,
      isLoading,
      error: error || null,
    }
  }

  const timestamp = data[0]?.result ?? 0n
  const isReady = data[1]?.result ?? false
  const isDone = data[2]?.result ?? false
  const isPending = data[3]?.result ?? false

  // Determine status
  let status: OperationStatus
  if (timestamp === 0n) {
    status = 'UNSET'
  } else if (isDone) {
    // Check if cancelled (from events) or executed
    // Note: Contract doesn't distinguish; we need event data for this
    status = 'EXECUTED' // Default assumption
  } else if (isReady) {
    status = 'READY'
  } else if (isPending) {
    status = 'PENDING'
  } else {
    status = 'UNSET'
  }

  // Calculate seconds until ready (for pending operations)
  let secondsUntilReady: number | null = null
  if (status === 'PENDING' && timestamp > 0n) {
    const timestampSeconds = Number(timestamp)
    secondsUntilReady = Math.max(0, timestampSeconds - currentTime)

    // If countdown reached zero, status should be READY
    if (secondsUntilReady === 0 && !isReady) {
      status = 'READY'
    }
  }

  return {
    status,
    timestamp,
    isReady,
    isDone,
    isPending,
    secondsUntilReady,
    isLoading: false,
    error: null,
  }
}
```

**Enhanced Status with Event Data (Cancelled Detection):**

```typescript
import { useQuery } from '@tanstack/react-query'

/**
 * Fetch operation events from subgraph to distinguish EXECUTED vs CANCELLED
 */
export function useOperationStatusEnhanced(
  timelockAddress: Address,
  operationId: `0x${string}`
) {
  const baseStatus = useOperationStatus(timelockAddress, operationId)

  // Query subgraph for event data
  const { data: events } = useQuery({
    queryKey: ['operation-events', operationId],
    queryFn: async () => {
      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetOperation($id: Bytes!) {
              operation(id: $id) {
                id
                status
                cancelledAt
                executedAt
              }
            }
          `,
          variables: { id: operationId },
        }),
      })
      const json = await response.json()
      return json.data.operation
    },
    enabled: baseStatus.isDone,
    staleTime: Infinity, // Done operations never change
  })

  // Override status if we have event data showing cancellation
  if (baseStatus.isDone && events?.cancelledAt) {
    return {
      ...baseStatus,
      status: 'CANCELLED' as OperationStatus,
    }
  }

  return baseStatus
}
```

**Countdown Timer Component:**

```typescript
function OperationCountdown({ secondsUntilReady }: { secondsUntilReady: number }) {
  if (secondsUntilReady <= 0) {
    return <span className="text-green-600 font-semibold">Ready to execute!</span>;
  }

  const days = Math.floor(secondsUntilReady / 86400);
  const hours = Math.floor((secondsUntilReady % 86400) / 3600);
  const minutes = Math.floor((secondsUntilReady % 3600) / 60);
  const seconds = secondsUntilReady % 60;

  return (
    <div className="text-sm">
      <span className="text-gray-600">Ready in: </span>
      <span className="font-mono font-semibold">
        {days > 0 && `${days}d `}
        {hours > 0 && `${hours}h `}
        {minutes}m {seconds}s
      </span>
    </div>
  );
}
```

**Status Badge Component:**

```typescript
function OperationStatusBadge({ status }: { status: OperationStatus }) {
  const styles = {
    UNSET: 'bg-gray-100 text-gray-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    READY: 'bg-green-100 text-green-800',
    EXECUTED: 'bg-blue-100 text-blue-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const icons = {
    UNSET: '○',
    PENDING: '⏳',
    READY: '✓',
    EXECUTED: '✓✓',
    CANCELLED: '✗',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]} {status}
    </span>
  );
}
```

**Operation List with Status:**

```typescript
function OperationsList({ timelockAddress, operations }: Props) {
  return (
    <div className="space-y-4">
      {operations.map(operation => {
        const status = useOperationStatusEnhanced(timelockAddress, operation.id);

        return (
          <div key={operation.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Operation {operation.id.slice(0, 10)}...</h3>
              <OperationStatusBadge status={status.status} />
            </div>

            {status.status === 'PENDING' && status.secondsUntilReady !== null && (
              <OperationCountdown secondsUntilReady={status.secondsUntilReady} />
            )}

            {status.status === 'READY' && (
              <div className="mt-2">
                <ExecuteButton operationId={operation.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Edge Cases Handled:**

1. **Clock Skew**: Client time may differ from block time by a few seconds. We use block timestamps from contract as source of truth
2. **Block Timestamp Lag**: Latest block may be a few seconds old. Status checks refetch every 30 seconds to catch transitions
3. **Concurrent Execution**: If operation is executed between status check and button click, transaction will revert gracefully
4. **Cancelled Operations**: Detected via subgraph event data, not just contract state

### References

- [OpenZeppelin TimelockController Source](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/TimelockController.sol)
- [Ethereum Block Timestamp Documentation](https://ethereum.org/en/developers/docs/blocks/#block-time)
- [Wagmi useReadContracts](https://wagmi.sh/react/api/hooks/useReadContracts)

---

## 8. Tailwind + Rootstock Design System Integration

### Decision

Configure Tailwind CSS with custom Rootstock brand colors in the theme extension, implement a dark-first design system with semantic color tokens, and use CSS custom properties for theming with the new `@theme` directive in Tailwind v4 (when migrating).

### Rationale

- **Brand Consistency**: Custom color palette ensures the app visually aligns with Rootstock's brand identity
- **Dark Mode Native**: Rootstock's brand aesthetic is dark-themed; building dark-first reduces complexity
- **Semantic Tokens**: Using role-based color names (e.g., `bg-brand-primary`) instead of literal colors improves maintainability
- **Tailwind v4 Ready**: Using CSS custom properties prepares for easy migration to Tailwind v4's native variable support

### Alternatives Considered

- **CSS-in-JS (styled-components)**: Adds bundle size, conflicts with Tailwind's utility-first approach
- **Material-UI**: Heavy framework, doesn't match Rootstock's aesthetic
- **Custom CSS Only**: Loses Tailwind's utility classes and responsive design benefits

### Implementation Notes

**Rootstock Brand Colors (Inferred):**
Since specific brand guidelines weren't found in search, here's a typical approach based on Rootstock's website aesthetic:

```typescript
// Common Rootstock brand colors (to be confirmed with brand guidelines)
const rootstockColors = {
  // Primary - Orange (Rootstock accent color)
  primary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316', // Main orange
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  // Secondary - Cyan/Teal (Bitcoin/blockchain association)
  secondary: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4', // Main cyan
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  // Dark (backgrounds)
  dark: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b', // Main dark bg
    900: '#0f172a', // Darker bg
    950: '#020617', // Darkest
  },
}
```

**Tailwind Configuration (tailwind.config.js):**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Rootstock brand colors
        brand: {
          primary: rootstockColors.primary,
          secondary: rootstockColors.secondary,
          dark: rootstockColors.dark,
        },
        // Semantic color tokens
        'bg-primary': rootstockColors.dark[900],
        'bg-secondary': rootstockColors.dark[800],
        'bg-tertiary': rootstockColors.dark[700],
        'text-primary': rootstockColors.dark[50],
        'text-secondary': rootstockColors.dark[300],
        'accent-primary': rootstockColors.primary[500],
        'accent-secondary': rootstockColors.secondary[500],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        editor:
          '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'editor-lg':
          '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
        'button-3d': '0 4px 0 0 rgba(0, 0, 0, 0.3)',
        'button-3d-pressed': '0 2px 0 0 rgba(0, 0, 0, 0.3)',
      },
      borderRadius: {
        editor: '8px',
      },
      animation: {
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(249, 115, 22, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(249, 115, 22, 0.8)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Better form styling
  ],
}
```

**Global Styles (src/styles/globals.css):**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Root variables for theming */
  :root {
    --color-bg-primary: 15 23 42; /* dark.900 */
    --color-bg-secondary: 30 41 59; /* dark.800 */
    --color-bg-tertiary: 51 65 85; /* dark.700 */
    --color-text-primary: 248 250 252; /* dark.50 */
    --color-text-secondary: 203 213 225; /* dark.300 */
    --color-accent-primary: 249 115 22; /* orange.500 */
    --color-accent-secondary: 6 182 212; /* cyan.500 */
  }

  /* Always use dark theme */
  body {
    @apply bg-brand-dark-900 text-brand-dark-50;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Code/address styling */
  code,
  .font-mono {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
  }
}

@layer components {
  /* Button components with 3D editor aesthetic */
  .btn-primary {
    @apply bg-brand-primary-500 hover:bg-brand-primary-600
           text-white font-semibold py-2 px-4 rounded-editor
           shadow-button-3d active:shadow-button-3d-pressed
           active:translate-y-1 transition-all duration-100
           disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0;
  }

  .btn-secondary {
    @apply bg-brand-secondary-500 hover:bg-brand-secondary-600
           text-white font-semibold py-2 px-4 rounded-editor
           shadow-button-3d active:shadow-button-3d-pressed
           active:translate-y-1 transition-all duration-100
           disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0;
  }

  .btn-danger {
    @apply bg-red-600 hover:bg-red-700
           text-white font-semibold py-2 px-4 rounded-editor
           shadow-button-3d active:shadow-button-3d-pressed
           active:translate-y-1 transition-all duration-100;
  }

  .btn-outline {
    @apply border-2 border-brand-primary-500 text-brand-primary-500
           hover:bg-brand-primary-500 hover:text-white
           font-semibold py-2 px-4 rounded-editor
           transition-colors duration-150;
  }

  /* Card components with editor aesthetic */
  .card {
    @apply bg-brand-dark-800 border border-brand-dark-700
           rounded-editor shadow-editor p-6;
  }

  .card-highlight {
    @apply card border-brand-primary-500/30 shadow-editor-lg;
  }

  /* Form inputs */
  .form-input {
    @apply bg-brand-dark-800 border border-brand-dark-600
           text-brand-dark-50 rounded-md px-3 py-2
           focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500
           placeholder:text-brand-dark-400;
  }

  .form-textarea {
    @apply form-input min-h-[100px] resize-y;
  }

  .form-select {
    @apply form-input cursor-pointer;
  }

  .form-checkbox {
    @apply bg-brand-dark-800 border-brand-dark-600
           text-brand-primary-500 rounded
           focus:ring-brand-primary-500;
  }

  /* Status indicators */
  .status-dot {
    @apply inline-block w-2 h-2 rounded-full mr-2;
  }

  .status-dot-pending {
    @apply status-dot bg-yellow-400 animate-pulse;
  }

  .status-dot-ready {
    @apply status-dot bg-green-400 animate-glow;
  }

  .status-dot-executed {
    @apply status-dot bg-blue-400;
  }

  .status-dot-cancelled {
    @apply status-dot bg-red-400;
  }

  /* Code blocks */
  .code-block {
    @apply bg-brand-dark-950 border border-brand-dark-700
           rounded-editor p-4 font-mono text-sm
           overflow-x-auto;
  }
}

@layer utilities {
  /* Custom utilities */
  .text-gradient-primary {
    @apply bg-gradient-to-r from-brand-primary-400 to-brand-primary-600
           bg-clip-text text-transparent;
  }

  .text-gradient-secondary {
    @apply bg-gradient-to-r from-brand-secondary-400 to-brand-secondary-600
           bg-clip-text text-transparent;
  }

  .border-glow-primary {
    @apply border border-brand-primary-500 shadow-[0_0_15px_rgba(249,115,22,0.3)];
  }
}
```

**Component Example with Rootstock Styling:**

```tsx
function TimelockDashboard() {
  return (
    <div className="min-h-screen bg-brand-dark-900 p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gradient-primary mb-2">
          Rootstock Timelock Manager
        </h1>
        <p className="text-brand-dark-300">
          Manage governance operations on Rootstock
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-brand-dark-400 text-sm mb-1">
            Pending Operations
          </div>
          <div className="text-3xl font-bold text-brand-primary-500">12</div>
        </div>
        <div className="card">
          <div className="text-brand-dark-400 text-sm mb-1">
            Ready to Execute
          </div>
          <div className="text-3xl font-bold text-green-400">3</div>
        </div>
        <div className="card">
          <div className="text-brand-dark-400 text-sm mb-1">Min Delay</div>
          <div className="text-3xl font-bold text-brand-secondary-500">48h</div>
        </div>
      </div>

      {/* Operations List */}
      <div className="card-highlight">
        <h2 className="text-2xl font-semibold mb-4">Active Operations</h2>
        {/* Operation items */}
        <div className="space-y-3">
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="status-dot-ready" />
              <div>
                <div className="font-mono text-sm text-brand-dark-200">
                  0x1234...abcd
                </div>
                <div className="text-xs text-brand-dark-400">
                  Ready to execute
                </div>
              </div>
            </div>
            <button className="btn-primary">Execute</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Responsive Design Pattern:**

```tsx
// Mobile-first responsive design
<div
  className="
  grid grid-cols-1        /* Mobile: 1 column */
  sm:grid-cols-2          /* Small: 2 columns */
  md:grid-cols-3          /* Medium: 3 columns */
  lg:grid-cols-4          /* Large: 4 columns */
  gap-4
"
>
  {/* Cards */}
</div>
```

**Future: Tailwind v4 Migration:**
When migrating to Tailwind v4, use the new `@theme` directive:

```css
@import 'tailwindcss';

@theme {
  /* Rootstock brand colors as CSS variables */
  --color-brand-primary-50: #fff7ed;
  --color-brand-primary-500: #f97316;
  --color-brand-primary-900: #7c2d12;

  --color-brand-secondary-500: oklch(
    68% 0.1 250
  ); /* Can use oklch for better perceptual uniformity */

  --color-brand-dark-900: #0f172a;
  --color-brand-dark-950: #020617;
}
```

### References

- [Tailwind CSS Customizing Colors](https://v3.tailwindcss.com/docs/customizing-colors)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind v4 Custom Colors with CSS Variables](https://medium.com/@dvasquez.422/custom-colours-in-tailwind-css-v4-acc3322cd2da)
- [Semantic Color Tokens in Design Systems](https://www.subframe.com/blog/how-to-setup-semantic-tailwind-colors)
- [Rootstock Brand Assets](https://rootstock.io/brand/) (for official logo/guidelines)

---

## Summary

This research document provides comprehensive technical guidance for building the Rootstock Timelock Management App. Each section addresses a specific technical challenge with:

1. **Clear Decisions**: What technology/pattern to use
2. **Strong Rationale**: Why it's the best choice for this context
3. **Alternatives Considered**: What was evaluated and rejected
4. **Implementation Details**: Code examples and gotchas
5. **References**: Links to official documentation

The patterns chosen prioritize:

- **Developer Experience**: Type safety, clear APIs, good tooling
- **Performance**: Caching, batching, minimal RPC calls
- **User Experience**: Real-time updates, clear status, graceful errors
- **Maintainability**: Standard patterns, well-documented libraries
- **Rootstock Ecosystem**: Integration with Rootstock-specific infrastructure

This document should serve as the technical foundation for all implementation decisions in the project.
