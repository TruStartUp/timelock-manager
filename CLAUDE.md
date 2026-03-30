# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js Web3 governance application for exploring and managing OpenZeppelin TimelockController contracts on Rootstock networks (mainnet and testnet). It provides a UI for viewing operations, managing roles, executing/canceling operations, scheduling proposals, and decoding calldata.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build production bundle
- `npm test` - Run Vitest tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Subgraph Commands
The Graph subgraphs live in `subgraph/rootstock-timelock-testnet/` and `subgraph/rootstock-timelock-mainnet/`. To deploy a subgraph:

```bash
cd subgraph/rootstock-timelock-testnet  # or mainnet
npm install
npm run codegen  # Generate TypeScript types from schema
npm run build    # Build the subgraph
npm run deploy   # Deploy to The Graph Studio (requires auth)
```

**Important**: Before deploying, update both `networks.json` AND `subgraph.yaml` with the correct TimelockController address and startBlock (they must match).

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

**Required:**
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - Get from https://cloud.walletconnect.com/
- `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL` - The Graph Studio query URL for testnet (after deploying subgraph)
- `NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL` - For mainnet support

**Optional:**
- `OPENAI_API_KEY` - Enables AI explanations for decoded operations (server-side only)
- `OPENAI_MODEL` - Defaults to `gpt-5-nano`
- `NEXT_PUBLIC_ENABLE_TESTNETS` - Set to `true` to enable testnet in UI

## Architecture

### Tech Stack
- **Framework**: Next.js (Pages Router)
- **Language**: TypeScript
- **Web3**: wagmi, viem, RainbowKit
- **Data Fetching**: TanStack Query
- **Data Sources**: The Graph (primary) with Blockscout API fallback
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

### Key Architectural Patterns

#### 1. Dual Data Source Strategy
The app prioritizes The Graph subgraphs for indexed data and falls back to Blockscout when subgraphs are unavailable:

- **Subgraph availability check** (`src/services/subgraph/client.ts:getSubgraphAvailability`): Cached health check determines if subgraph is available
- **Fallback logic** (`src/services/blockscout/events.ts`): When subgraph fails, fetches raw events from Blockscout API
- **Rate limiting**: Blockscout client enforces 6.6 RPS with request queuing and exponential backoff

#### 2. Timelock Configuration Management
TimelockController addresses are user-configurable via Settings:

- **Context** (`src/context/TimelockContext.tsx`): Stores multiple timelock configurations in localStorage
- **Selection**: User selects active timelock; app queries operations/roles for selected contract
- **Network switching**: Each configuration is network-specific (chainId + address)

#### 3. Recursive Calldata Decoding
The decoder handles nested TimelockController operations:

- **Main decoder** (`src/lib/decoder.ts:decodeCalldata`): Recursively decodes `execute()` and `executeBatch()` inner payloads
- **ABI resolution hierarchy**:
  1. User-provided ABI (manual upload)
  2. Blockscout verified contract ABI
  3. 4byte.directory best-guess fallback
- **Depth/node limits**: Prevents infinite recursion (default: maxDepth=5, maxNodes=50)

#### 4. Wagmi + TanStack Query Integration
All blockchain data fetching uses wagmi hooks + TanStack Query:

- **Operations** (`src/hooks/useOperations.ts`): Queries subgraph with filters (status, proposer, target)
- **Roles** (`src/hooks/useRoles.ts`): Fetches role grants for timelock
- **Block number watching**: Auto-invalidates queries on new blocks for status transitions
- **Cache keys**: Include `subgraphUrl` from context for proper invalidation when user switches timelocks

#### 5. Operation Status Calculation
Status is computed client-side based on blockchain state:

- **Status logic** (`src/lib/status.ts`):
  - PENDING: scheduled but not yet ready (timestamp > now)
  - READY: timestamp passed, not executed/cancelled
  - EXECUTED: execution transaction recorded
  - CANCELLED: cancellation transaction recorded
- **Hook** (`src/hooks/useOperationStatus.ts`): Computes status for a single operation with caching

### Critical Files

#### Data Services
- `src/services/subgraph/client.ts` - GraphQL client with retry logic + availability checking
- `src/services/subgraph/operations.ts` - Operation queries (fetch, filter, summary)
- `src/services/subgraph/roles.ts` - Role grant queries
- `src/services/blockscout/client.ts` - Rate-limited Blockscout v2 API client
- `src/services/blockscout/abi.ts` - ABI resolution (detects proxies via evm-proxy-detection)
- `src/services/blockscout/events.ts` - Raw event fetching fallback
- `src/services/fourbyte/client.ts` - 4byte.directory signature lookup

#### Core Libraries
- `src/lib/decoder.ts` - Recursive calldata decoder with ABI fallback
- `src/lib/status.ts` - Operation status calculation
- `src/lib/constants.ts` - Role hashes, chain IDs, cache TTLs
- `src/lib/validation.ts` - Zod schemas for timelock configurations

#### Context & Hooks
- `src/context/TimelockContext.tsx` - Manages user's timelock configurations
- `src/hooks/useOperations.ts` - Fetch operations with filters + auto-refetch
- `src/hooks/useRoles.ts` - Fetch role grants
- `src/hooks/useContractABI.ts` - Fetch ABI for target contract
- `src/hooks/useOperationStatus.ts` - Compute operation status
- `src/hooks/useTimelockWrite.ts` - Execute timelock transactions (execute, cancel)

#### Pages & Components
- `src/pages/operations_explorer.tsx` + `src/components/operations_explorer/` - Browse/filter/execute operations
- `src/pages/new_proposal.tsx` + `src/components/new_proposal/` - Wizard for scheduling operations
- `src/pages/decoder.tsx` + `src/components/decoder/` - Standalone calldata decoder
- `src/pages/permissions.tsx` + `src/components/permissions/` - View role grants
- `src/pages/api/explain_operation.ts` - OpenAI API route for AI explanations

#### Config
- `src/wagmi.ts` - Wagmi config with Rootstock networks
- `src/pages/_app.tsx` - App providers (RainbowKit, TanStack Query, TimelockContext)

### Important Patterns

**1. Network-aware data fetching:**
Most hooks accept `subgraphUrl` from `useNetworkConfig()` which is derived from the user's selected timelock configuration. This ensures queries target the correct subgraph.

**2. ABI caching:**
ABIs are cached in localStorage for 24 hours (`src/services/blockscout/client.ts`). Clear cache via Blockscout client when needed.

**3. Proxy detection:**
Before fetching ABI, check if contract is a proxy using `evm-proxy-detection` (`src/services/blockscout/abi.ts:getContractABI`). If proxy, resolve implementation address first.

**4. Operation ID format:**
Operation IDs are keccak256 hashes (bytes32). The subgraph uses lowercase hex strings; ensure queries match this format.

**5. Role checks:**
Use `useHasRole(address, role)` to check if user has permission before showing execute/cancel buttons.

**6. AI Explanations:**
When user clicks "Explain", frontend POSTs to `/api/explain_operation` which calls OpenAI Responses API. Used in OperationRow and DecoderView. Only works if `OPENAI_API_KEY` is set.

## Common Development Workflows

### Adding a new operation filter
1. Update `OperationFilters` type in `src/services/subgraph/operations.ts`
2. Modify GraphQL query builder in `fetchOperations()` to include new filter
3. Add filter UI in `src/components/operations_explorer/OperationsExplorerView.tsx`
4. Query key in `useOperations()` automatically includes all filters

### Testing timelock interactions
Use testnet (chainId 31) with `NEXT_PUBLIC_ENABLE_TESTNETS=true`. Deploy a test TimelockController and configure it via Settings page.

### Debugging subgraph issues
1. Check subgraph health: look at availability cache in DevTools (checks every 30s)
2. Verify `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL` is set correctly
3. Check subgraph deployment logs in The Graph Studio
4. App automatically falls back to Blockscout events if subgraph is down

### Adding new ABI sources
Extend `ABISource` enum in `src/types/abi.ts` and update resolution logic in `src/lib/decoder.ts:resolveAbiForAddress`.

## Testing

Run tests with `npm test`. Key test files:
- ABI resolution and proxy detection tests (if they exist)
- Decoder tests for nested operations
- Status calculation tests

Use Vitest's `describe`, `it`, `expect` and React Testing Library for component tests.
