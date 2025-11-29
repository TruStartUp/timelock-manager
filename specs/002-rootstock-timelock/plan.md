# Implementation Plan: Rootstock Timelock Management App

**Branch**: `002-rootstock-timelock` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Status**: UI Complete - Blockchain Integration Pending

## Summary

Build a comprehensive Web3 governance tool for managing TimelockController and AccessManager contracts on Rootstock, enabling users to view, schedule, execute, and cancel governance operations through a user-friendly interface.

**Current State**: All primary UI views have been implemented with mock data, establishing the complete information architecture and user flows. The application demonstrates the full UX journey from dashboard overview through operation execution, but requires blockchain integration to replace mock data with live contract queries and transaction capabilities.

**Next Phase**: Integrate blockchain data sources (The Graph subgraphs, RPC calls via wagmi hooks, Blockscout API) to power the existing UI components with real-time governance data from Rootstock networks.

## Technical Context

**Language/Version**: TypeScript 5.5+ (strict mode enabled)
**Framework**: Next.js 15+ (Pages Router with SSR support), React 19+
**Primary Dependencies**:
  - wagmi 2.17+ (Ethereum/Rootstock RPC interactions)
  - viem 2.40+ (type-safe contract interactions, ABI encoding)
  - RainbowKit 2.2+ (wallet connection UI)
  - TanStack Query 5.55+ (data fetching, caching, state management)
  - Tailwind CSS (styling with custom Rootstock brand theme)
  - Zod + React Hook Form (dynamic ABI-driven form generation and validation)

**Storage**:
  - The Graph subgraphs (primary: indexed TimelockController events)
  - Rootstock Blockscout API (fallback: contract ABIs, verification status)
  - 4byte Directory API (fallback: function signature lookup)
  - SessionStorage (client-side: ABI cache, user-provided ABIs)

**Testing**: Vitest (unit tests for utilities), @testing-library/react (integration tests for components and wallet flows)

**Target Platform**: Web (desktop + mobile responsive), Rootstock Mainnet (chainId 30) and Testnet (chainId 31)

**Project Type**: Web application (Next.js frontend with blockchain backend via wagmi)

**Performance Goals**:
  - Load operations list in <5 seconds
  - Decode calldata for verified contracts in <2 seconds
  - Real-time permission checks with <5 minute cache TTL
  - Support 100+ operations per timelock without UI degradation

**Constraints**:
  - Blockscout API: 10 requests/second rate limit (IP-based)
  - RPC reliability: Rootstock public nodes may have occasional downtime
  - Subgraph sync lag: Event indexing may trail chain head by 10-30 seconds
  - Browser compatibility: Modern browsers only (ES2020+, no IE11)

**Scale/Scope**:
  - Support multiple TimelockController contracts (user-provided addresses)
  - Handle batch operations with up to 50 calls
  - Index complete event history (potentially 10k+ operations per contract)
  - 4 primary user roles: Proposer, Executor, Canceller, Admin

**UI Implementation Status**:
  - ✅ Dashboard View (operations overview stats, role summary table)
  - ✅ Operations Explorer (filterable table, status chips, expandable details)
  - ✅ New Proposal Wizard (3-step: target, function, review)
  - ✅ Calldata Decoder (input/output panels, verification badges)
  - ✅ Permissions Management (role list, member display, history table)
  - ✅ Common Layout (navigation, wallet connection placeholder)
  - ⏳ Blockchain Integration (pending: hooks, services, contract calls)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### ✅ Principle I: Secure Smart Contract Interaction

**Compliance Status**: PASS

- Using viem's type-safe abstractions (encodeFunctionData, parseAbi) over raw JSON-RPC
- Error handling strategy defined in research.md for all Blockscout/subgraph calls
- Contract address validation using viem's isAddress + getAddress (EIP-55 checksum)
- All blockchain interactions will be logged (transaction hashes, block numbers, operation IDs)
- Timelock-specific validation: delay >= minDelay enforced client-side before submission

**Evidence**:
- research.md Section 4: ABI-driven form generation with Zod validation for all Solidity types
- research.md Section 6: Real-time hasRole checks before enabling action buttons
- research.md Section 7: Operation status calculated from contract view functions (getTimestamp, isOperationDone)

### ✅ Principle II: User Experience Through Wallet Integration

**Compliance Status**: PASS

- RainbowKit provides persistent connection state UI across all pages
- Transaction feedback will use TanStack Query's mutation states (idle/pending/success/error) with wagmi hooks
- Error messages decode contract revert reasons via viem's ContractFunctionExecutionError
- Network switching implemented via wagmi's useSwitchChain with fallback to wallet_addEthereumChain
- All blockchain responses are JSON (subgraph GraphQL, Blockscout REST) → decoded to human-readable UI

**Evidence**:
- research.md Section 5: Network switcher component with "Wrong network" banner
- research.md Section 6: Permission-gated buttons with tooltip explanations
- UI components use semantic status badges (Pending/Ready/Executed) not raw timestamps

### ✅ Principle III: Type Safety and Testability

**Compliance Status**: PASS

- TypeScript strict mode enabled in tsconfig.json (noImplicitAny, strictNullChecks, etc.)
- Constitution requirement: 100% type coverage enforced
- Test structure defined in quickstart.md: unit tests for utils, integration tests for wallet/contract flows
- Mock ABIs and test fixtures prepared for testing without live contracts
- Red-Green-Refactor workflow documented in constitution and quickstart

**Evidence**:
- data-model.md: All entities have explicit TypeScript interfaces with field types
- research.md Section 4: Zod validators for all Solidity types (address, uint, bytes, arrays, tuples)
- tests/ directory structure defined in quickstart.md with unit and integration separation
- UI components implemented with TypeScript strict mode (all props typed)

### ✅ Technology Stack Compliance

**Required Stack**: Next.js 15+, React 19+, viem 2.40+, RainbowKit 2.2+, wagmi 2.17+, TanStack Query 5.55+, TypeScript 5.5+ strict

**Actual Implementation**:
- package.json dependencies match required versions
- Tailwind CSS used for styling (constitution allows CSS Modules or Tailwind)
- Vitest chosen for testing (constitution allows Vitest or Jest)

### ✅ Development Workflow Compliance

**Constitution Requirements**: Planning → Tests → Implementation → Review → Deploy

**Compliance Evidence**:
- Planning: spec.md completed and validated (requirements.md checklist passed)
- Research: research.md completed with 8 technical decisions documented
- Data Model: data-model.md defines all entities with validation rules
- Quickstart: quickstart.md provides test-first workflow instructions
- UI Implementation: Views created with mock data, tests pending for blockchain integration phase
- **Next Phase**: Write integration tests for wagmi hooks → implement hooks → refactor with tests green

**Deployment Strategy**: Vercel (primary), documented in quickstart.md with env var management and preview deploys for PRs

### No Violations Requiring Justification

All constitution gates pass. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-rootstock-timelock/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (8 technical decisions documented)
├── data-model.md        # Phase 1 output (6 entities, 3 enums defined)
├── quickstart.md        # Phase 1 output (development guide completed)
├── contracts/           # Phase 1 output (TimelockController ABIs)
│   ├── TimelockController.json
│   ├── AccessControl.json
│   └── IAccessManager.json
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT YET CREATED)
```

### Source Code (repository root)

```text
src/
├── components/          # React components (UI complete with mock data)
│   ├── common/          # Layout, navigation, wallet button (implemented)
│   ├── dashboard/       # DashboardView (stats cards, role table - implemented)
│   ├── operations_explorer/  # OperationsExplorerView (table, filters - implemented)
│   ├── new_proposal/    # NewProposalView (3-step wizard - implemented)
│   ├── decoder/         # DecoderView (calldata decoder - implemented)
│   ├── permissions/     # PermissionsView (roles, history - implemented)
│   └── settings/        # SettingsView (network, ABI management - implemented)
│
├── hooks/               # Custom React hooks (TO BE IMPLEMENTED)
│   ├── useOperations.ts      # Fetch operations from subgraph
│   ├── useOperationStatus.ts # Real-time status calculation
│   ├── useRoles.ts           # Fetch role members and history
│   ├── useHasRole.ts         # Permission checks with caching
│   ├── useTimelockWrite.ts   # Execute/cancel/schedule mutations
│   └── useContractABI.ts     # ABI resolution (Blockscout → 4byte)
│
├── services/            # External API clients (TO BE IMPLEMENTED)
│   ├── subgraph/        # GraphQL queries for The Graph
│   ├── blockscout/      # REST API client for ABIs (rate-limited)
│   └── fourbyte/        # Function signature lookup
│
├── lib/                 # Core utilities
│   ├── wagmi.ts         # Wagmi config (Rootstock chains - implemented)
│   ├── constants.ts     # Role hashes, addresses (TO BE ADDED)
│   ├── validation.ts    # Zod schemas for Solidity types (TO BE IMPLEMENTED)
│   └── abis/            # Contract ABIs (TimelockController, AccessControl)
│
├── pages/               # Next.js Pages Router (implemented with mock data)
│   ├── _app.tsx         # Provider setup (wagmi, TanStack Query, RainbowKit)
│   ├── index.tsx        # Dashboard page
│   ├── operations_explorer.tsx
│   ├── new_proposal.tsx
│   ├── decoder.tsx
│   ├── permissions.tsx
│   └── settings.tsx
│
├── styles/              # Tailwind + global CSS (Rootstock theme implemented)
│   └── globals.css      # Custom Rootstock colors, button styles
│
└── types/               # TypeScript definitions
    ├── operation.ts     # Operation, Call entities
    ├── role.ts          # Role, RoleAssignment entities
    └── abi.ts           # ABISource, ABIConfidence enums

subgraph/                # The Graph subgraph (TO BE DEPLOYED)
├── schema.graphql       # Entity definitions (matches data-model.md)
├── subgraph.yaml        # Data source config (TimelockController address)
└── src/
    └── mapping.ts       # Event handlers (CallScheduled, RoleGranted, etc.)

tests/                   # Vitest tests (TO BE WRITTEN FOR BLOCKCHAIN LAYER)
├── unit/                # Utility function tests
│   ├── validation.test.ts     # Zod validators for Solidity types
│   ├── abi-resolver.test.ts   # ABI resolution priority logic
│   └── status.test.ts         # Operation status calculation
│
└── integration/         # Component + hook integration tests
    ├── wallet-connection.test.tsx    # RainbowKit flow
    ├── operations-fetch.test.tsx     # useOperations hook with mock subgraph
    ├── role-checks.test.tsx          # useHasRole with mock RPC
    └── execute-operation.test.tsx    # useTimelockWrite mutation flow
```

**Structure Decision**: Single web application project using Next.js Pages Router. The UI layer (components, pages, styles) is complete with mock data. The data layer (hooks, services, subgraph) needs to be implemented to connect the existing UI to blockchain sources. This structure follows the constitution's requirement for Next.js 15+ with App Router preference, but Pages Router is acceptable and already implemented.

## Implementation Phases

### Phase 0: Research & Technical Decisions ✅ COMPLETE

**Status**: All 8 technical research areas completed in research.md

**Completed Artifacts**:

1. ✅ **The Graph Subgraph Schema** (research.md Section 1)
   - Entity structure: Operation (immutable), Call (immutable), Role, RoleAssignment (event-sourced)
   - Derived relationships pattern for performance
   - Batch operation handling (CallScheduled events with index parameter)

2. ✅ **Proxy Detection Strategy** (research.md Section 2)
   - Decision: Use evm-proxy-detection library with viem
   - Supports EIP-1967, EIP-1822, EIP-1167 automatically
   - Fallback storage slot reading for manual detection

3. ✅ **Blockscout API Integration** (research.md Section 3)
   - Rate limiting: 10 RPS with client-side queue
   - Exponential backoff for 429 responses
   - localStorage caching with 24-hour TTL

4. ✅ **ABI-Driven Form Generation** (research.md Section 4)
   - React Hook Form + Zod validators for all Solidity types
   - Dynamic field generation: address (checksum), uint/int (range), bytes (hex), arrays, tuples
   - Type-safe encoding via viem's encodeFunctionData

5. ✅ **Rootstock Network Configuration** (research.md Section 5)
   - wagmi defineChain for chainId 30 (mainnet) and 31 (testnet)
   - RainbowKit integration with custom chains
   - Network switcher with wallet_addEthereumChain fallback

6. ✅ **Role Permission Verification** (research.md Section 6)
   - useReadContract with 5-minute staleTime for hasRole checks
   - Batch optimization: useReadContracts for multi-role queries
   - Auto-invalidation on RoleGranted/RoleRevoked events

7. ✅ **Operation Status Calculation** (research.md Section 7)
   - getTimestamp, isOperationReady, isOperationDone from contract
   - Client-side countdown timer with 1-second intervals
   - Subgraph integration for CANCELLED detection

8. ✅ **Tailwind + Rootstock Design System** (research.md Section 8)
   - Custom color palette: Primary Orange, Secondary Cyan, Dark backgrounds
   - Component library: btn-primary, card, form-input with 3D editor aesthetic
   - Dark-first design with semantic color tokens

**Output**: research.md (2500+ lines, fully documented with code examples and references)

### Phase 1: Data Model & Contracts ✅ COMPLETE

**Status**: All data entities, API contracts, and development guide completed

**Completed Artifacts**:

1. ✅ **Data Model** (data-model.md)
   - 6 core entities: Operation, Call, Role, RoleAssignment, TimelockController, NetworkConfiguration
   - 1 cache entity: ContractABI (sessionStorage)
   - 3 enums: OperationStatus, ABISource, ABIConfidence
   - State transition diagrams for Operation (PENDING → READY → EXECUTED | CANCELLED)
   - Validation rules mapped to functional requirements (FR-001 through FR-069)
   - Entity relationships and indexes for query optimization

2. ✅ **Contract ABIs** (contracts/)
   - TimelockController.json (schedule, execute, cancel, getTimestamp, hasRole)
   - AccessControl.json (RoleGranted, RoleRevoked events)
   - IAccessManager.json (for detecting external admin roles)

3. ✅ **Quickstart Guide** (quickstart.md)
   - Prerequisites: Node 20+, MetaMask, Rootstock wallet setup
   - Installation: npm install, .env.local configuration
   - Development workflow: npm run dev, type checking, linting
   - Subgraph deployment: The Graph Studio vs local graph-node
   - Testing: Vitest setup, test-first workflow
   - Production build: Vercel deployment instructions

4. ✅ **UI Implementation** (src/components/, src/pages/)
   - All 5 primary views implemented with mock data
   - Common layout with navigation structure
   - Tailwind-based styling with Rootstock brand theme
   - Information architecture validated through working UI

**Output**:
- data-model.md (450 lines)
- quickstart.md (500 lines)
- contracts/ (3 ABI files)
- UI codebase (components and pages with mock data)

### Phase 2: UI Implementation ✅ COMPLETE

**Status**: All primary views implemented with mock data structures

**Completed Work**:

1. ✅ **Dashboard** ([src/components/dashboard/DashboardView.tsx](../../src/components/dashboard/DashboardView.tsx))
   - Contract selector dropdown
   - Network status indicator (Connected to: Rootstock Mainnet)
   - Operations overview stats (Pending: 12, Ready: 3, Executed: 89)
   - Role summary table (PROPOSER, EXECUTOR, CANCELLER, ADMIN with member counts)

2. ✅ **Operations Explorer** ([src/components/operations_explorer/OperationsExplorerView.tsx](../../src/components/operations_explorer/OperationsExplorerView.tsx))
   - Filterable operations table (All/Pending/Ready/Executed/Canceled chips)
   - Search bar for ID/proposer filtering
   - Sortable columns (ID, Status, Calls, Targets, ETA, Proposer)
   - Expandable row details (full ID, proposer, scheduled time, calls breakdown)
   - Action buttons (EXECUTE for Ready, CANCEL for Pending)

3. ✅ **New Proposal Wizard** ([src/components/new_proposal/NewProposalView.tsx](../../src/components/new_proposal/NewProposalView.tsx))
   - Step 1: Target contract address input with "Fetch ABI" button
   - Step 2: Function selector dropdown + dynamic parameter inputs
   - Step 3: Review screen (placeholder in current UI)
   - Sidebar navigation showing wizard progress
   - Help section with documentation link

4. ✅ **Calldata Decoder** ([src/components/decoder/DecoderView.tsx](../../src/components/decoder/DecoderView.tsx))
   - Input panel: calldata textarea, optional contract address, optional ABI JSON
   - Output panel: decoded function name, signature, parameter table
   - Verification badge (Verified/Unverified indicator)
   - Syntax-highlighted output with color-coded types

5. ✅ **Permissions Management** ([src/components/permissions/PermissionsView.tsx](../../src/components/permissions/PermissionsView.tsx))
   - All Roles sidebar with search filter
   - Role detail panel showing current holders (addresses with copy buttons)
   - Role history table (Grant/Revoke events with timestamps, TX hashes)
   - Warning indicator for addresses holding multiple significant roles

**Mock Data Structures**:
- Operations: Array of `{ id, status, calls, targets, eta, proposer, details }` objects
- Roles: Standard timelock roles with mock member addresses
- Status enums: 'All' | 'Pending' | 'Ready' | 'Executed' | 'Canceled'

**Next Phase Readiness**: UI is ready to receive live data through props/hooks. Component interfaces established and validated.

### Phase 3: Blockchain Integration ⏳ NEXT PHASE

**Objective**: Replace mock data in UI components with live blockchain data from The Graph, RPC calls, and Blockscout API

**Prerequisites**:
- ✅ UI components complete (Phase 2)
- ✅ Research decisions documented (Phase 0)
- ✅ Data model defined (Phase 1)
- ⏳ The Graph subgraph deployed to Rootstock testnet
- ⏳ Hooks and services implemented
- ⏳ Integration tests written

**Task Categories**:

**3.1 Subgraph Deployment** (Priority: P0 - Blocking)
**3.2 Core Hooks Implementation** (Priority: P1 - Critical Path)
**3.3 Service Layer Implementation** (Priority: P1 - Supports Hooks)
**3.4 UI Component Integration** (Priority: P2 - After Hooks Ready)
**3.5 Testing** (Priority: P2 - Parallel with Integration)

_Detailed task breakdown will be generated with `/speckit.tasks` command_

**Estimated Effort**: 6-10 days for complete blockchain integration

---

## Next Steps

1. **Run `/speckit.tasks`** to generate detailed task breakdown from Phase 3 plan
2. **Deploy Subgraph** following quickstart.md instructions (The Graph Studio for testnet)
3. **Implement Hooks** in test-first order (write tests → run tests → implement → refactor)
4. **Connect UI** by replacing mock data imports with hook calls
5. **Validate E2E** on Rootstock Testnet with deployed TimelockController

---

## References

- **Feature Specification**: [spec.md](./spec.md) - Business requirements and user stories
- **Technical Research**: [research.md](./research.md) - 8 documented technical decisions
- **Data Model**: [data-model.md](./data-model.md) - Entity definitions and relationships
- **Development Guide**: [quickstart.md](./quickstart.md) - Setup and deployment instructions
- **Constitution**: [../../.specify/memory/constitution.md](../../.specify/memory/constitution.md) - Project principles and governance
