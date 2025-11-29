# Implementation Plan: Rootstock Timelock Management App

**Branch**: `001-rootstock-timelock` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-rootstock-timelock/spec.md`

## Summary

Build a Web3 governance application for exploring and managing OpenZeppelin TimelockController contracts on Rootstock networks (mainnet chainId 30, testnet chainId 31). The application provides read-only operation exploration, role permission auditing, operation execution/cancellation for authorized users, proposal scheduling with ABI-driven form generation, and standalone calldata decoding. The technical approach uses Next.js 15 with App Router, wagmi + viem for blockchain interactions, RainbowKit for wallet connections, The Graph subgraphs as primary data source with Blockscout API fallback, and implements the Rootstock brand "Editor Mode" design system.

## Technical Context

**Language/Version**: TypeScript 5.5+ (strict mode enabled)
**Primary Dependencies**: Next.js 15+, React 19+, wagmi 2.17+, viem 2.40+, RainbowKit 2.2+, TanStack Query 5.55+
**Storage**: SessionStorage (ABI cache), The Graph subgraphs (indexed blockchain data), Blockscout API (fallback)
**Testing**: Vitest + @testing-library/react (component/integration), Mock contract ABIs for blockchain state simulation
**Target Platform**: Web browsers (desktop/mobile responsive), deployed to Vercel or Next.js-compatible hosting
**Project Type**: Web application (frontend-focused with API routes for data aggregation)
**Performance Goals**:

- Operations list load <5 seconds for 100+ operations
- Real-time role permission checks <500ms
- Subgraph to Blockscout fallback <2 seconds
- UI supports 20+ batched calls without degradation
- Filters/search on 100+ operations <3 seconds response

**Constraints**:

- Must maintain read-only functionality when wallet disconnected or on wrong network
- ABI required to proceed in Proposal Builder (security constraint)
- All transaction buttons disabled on network mismatch
- No server-side wallet management (client-side only via RainbowKit)
- Rootstock brand guidelines strictly enforced (Editor Mode aesthetic)

**Scale/Scope**:

- Support 2 networks (Rootstock mainnet + testnet)
- Handle multiple TimelockController contracts (one at a time in MVP)
- 8 main routes (Dashboard, Operations, Roles, Proposal Builder, Decoder, Settings, Operation Detail, Role Detail)
- 69 functional requirements across 9 feature areas
- ~15-20 React components for UI library
- 5-8 custom wagmi hooks for blockchain interactions
- 2 subgraph schemas (one per network)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### ✅ Principle I: Secure Smart Contract Interaction

**Compliance Status**: PASS

- ✅ Uses viem for all encoding/decoding (FR-048: "encode calldata using viem library functions")
- ✅ Explicit error handling required (FR-069: "never fail silently - always show error states")
- ✅ Contract validation before use (FR-008: validate TimelockController interface)
- ✅ ABI compatibility checks (FR-036: detect proxy contracts, FR-039: block progression without ABI)
- ✅ Auditability through operation details display (FR-022: show operation ID, predecessor, salt, timestamps)

### ✅ Principle II: User Experience Through Wallet Integration

**Compliance Status**: PASS

- ✅ RainbowKit for wallet connections (FR-001: RainbowKit-compatible wallets)
- ✅ Connection state always visible (FR-003: "Wrong network" banner, FR-004: disable buttons on mismatch)
- ✅ Transaction feedback (FR-049: display operation ID, ETA, TX hash on success)
- ✅ Blockchain error explanations (FR-029/030: tooltips for insufficient permissions)
- ✅ Chain switching support (FR-002: support mainnet + testnet, FR-005: prompt to add network)

### ✅ Principle III: Type Safety and Testability

**Compliance Status**: PASS

- ✅ TypeScript strict mode enforced (constitution requirement)
- ✅ No implicit `any` types (constitution requirement)
- ✅ Test strategy defined: Unit tests for utilities/hooks, Integration tests for wallet flows and contract sequences
- ✅ Mock ABIs required for testing (contract fixtures for locked/unlocked/error states)
- ✅ Test-first workflow: tests written → approved → implement

### ✅ Technology Stack Compliance

**Compliance Status**: PASS

| Required                | Planned                                               | Status |
| ----------------------- | ----------------------------------------------------- | ------ |
| Next.js 15+ App Router  | Next.js 15 App Router                                 | ✅     |
| viem 2.40+              | viem for encoding/decoding (FR-048)                   | ✅     |
| RainbowKit 2.2+         | RainbowKit for wallets (FR-001)                       | ✅     |
| wagmi 2.17+             | wagmi for hooks (FR-013: useReadContract for hasRole) | ✅     |
| TanStack Query 5.55+    | Wraps wagmi hooks automatically                       | ✅     |
| TypeScript 5.5+ strict  | TypeScript strict mode                                | ✅     |
| CSS Modules or Tailwind | Tailwind CSS (per existing CLAUDE.md)                 | ✅     |
| Vitest or Jest          | Vitest + @testing-library/react                       | ✅     |

### 🔍 Additional Technology (Not in Constitution - Requires Documentation)

The following technologies are required by the feature spec but not covered by constitution:

1. **The Graph** - Primary data source for operations and role events (FR-064, FR-065)
   - _Justification_: TimelockController doesn't implement AccessControlEnumerable, so we cannot enumerate role members on-chain. The Graph subgraph indexes RoleGranted/RoleRevoked events to provide role member lists.
   - _Alternative considered_: Pure RPC queries rejected because no enumeration functions exist

2. **Blockscout API** - Fallback data source + ABI fetching (FR-017, FR-035)
   - _Justification_: Provides contract verification status and ABIs for verified contracts, plus fallback when subgraph unavailable
   - _Alternative considered_: Etherscan API not available for Rootstock

3. **4byte Directory** - Function signature lookup (FR-052)
   - _Justification_: Low-confidence fallback for decoding when no verified ABI available
   - _Alternative considered_: None - this is industry standard for signature guessing

4. **Radix UI** - Accessible component primitives (mentioned in design doc)
   - _Justification_: Provides accessible headless components (modals, dropdowns, tooltips) that align with Rootstock design system
   - _Alternative considered_: Building from scratch rejected due to accessibility complexity

**Recommendation**: Amend constitution to include these Web3-specific data sources, OR document as project-specific dependencies with rationale.

### ✅ Development Workflow Compliance

**Compliance Status**: PASS

- ✅ Feature specified in `.specify/spec.md` with acceptance criteria (8 user stories, 69 FRs)
- ✅ Test-first workflow will be followed (tests before implementation)
- ✅ Contract ABIs versioned and verified (FR-035: fetch from Blockscout verified contracts)
- ✅ Breaking changes require migration (ABI updates will be versioned in known contracts registry)

### Summary: All Gates PASS ✅

No constitution violations. Proceed to Phase 0 Research.

## Project Structure

### Documentation (this feature)

```text
specs/001-rootstock-timelock/
├── spec.md              # Feature specification (/speckit.specify output)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0: Technology decisions and patterns
├── data-model.md        # Phase 1: Entity schemas and relationships
├── quickstart.md        # Phase 1: Developer onboarding guide
├── contracts/           # Phase 1: API contracts (GraphQL schemas, OpenAPI specs)
│   ├── subgraph.graphql # The Graph subgraph schema
│   ├── blockscout.yaml  # Blockscout API integration spec
│   └── known-abis.json  # Known contract ABI registry
├── checklists/
│   └── requirements.md  # Spec quality checklist (completed)
└── tasks.md             # Phase 2: Implementation tasks (/speckit.tasks output - NOT YET CREATED)
```

### Source Code (repository root)

```text
src/
├── app/                           # Next.js 15 App Router
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Dashboard (operations overview + role summary)
│   ├── operations/
│   │   ├── page.tsx               # Operations list with filters
│   │   └── [id]/page.tsx          # Operation detail view
│   ├── roles/
│   │   ├── page.tsx               # Roles list
│   │   └── [roleHash]/page.tsx   # Role detail with history
│   ├── proposal/
│   │   └── page.tsx               # Proposal builder wizard
│   ├── decoder/
│   │   └── page.tsx               # Standalone calldata decoder
│   └── settings/
│       └── page.tsx               # Network and ABI management
│
├── components/                    # React components
│   ├── ui/                        # Rootstock design system primitives
│   │   ├── Button.tsx             # 3D button with Rootstock styling
│   │   ├── Nametag.tsx            # Lozenge-shaped address labels
│   │   ├── StatusBadge.tsx        # Operation status indicators
│   │   ├── NetworkBanner.tsx      # Wrong network warning
│   │   └── ...
│   ├── layout/
│   │   ├── Navbar.tsx             # Top navigation with wallet connect
│   │   ├── Sidebar.tsx            # Side navigation (if applicable)
│   │   └── Footer.tsx
│   ├── operations/
│   │   ├── OperationsList.tsx     # Filterable table
│   │   ├── OperationCard.tsx      # Single operation row
│   │   ├── OperationDetail.tsx    # Expanded view with calls
│   │   ├── CallDecoder.tsx        # Individual call decoding
│   │   └── OperationFilters.tsx   # Status tabs + search
│   ├── roles/
│   │   ├── RolesList.tsx
│   │   ├── RoleCard.tsx
│   │   ├── RoleHistory.tsx
│   │   └── RoleMembersList.tsx
│   ├── proposal/
│   │   ├── ProposalWizard.tsx     # Multi-step form container
│   │   ├── ContractSelector.tsx   # Step 1: ABI fetching
│   │   ├── FunctionBuilder.tsx    # Step 2: Function + args
│   │   ├── ProposalReview.tsx     # Step 3: Review + submit
│   │   └── DynamicFormField.tsx   # ABI-driven input generation
│   └── decoder/
│       ├── CalldataInput.tsx
│       ├── DecodedOutput.tsx
│       └── ConfidenceIndicator.tsx
│
├── lib/                           # Core utilities and business logic
│   ├── wagmi.ts                   # wagmi config (Rootstock chains)
│   ├── constants/
│   │   ├── roles.ts               # TimelockController role hashes
│   │   ├── chains.ts              # Rootstock network configs
│   │   └── known-contracts.ts    # Registry of common ABIs
│   ├── abi/
│   │   ├── TimelockController.ts  # OpenZeppelin ABI
│   │   ├── AccessManager.ts
│   │   └── IAccessControl.ts
│   ├── calldata/
│   │   ├── encoder.ts             # viem encodeFunctionData wrapper
│   │   ├── decoder.ts             # viem decodeFunctionData wrapper
│   │   └── abi-resolver.ts        # Priority-based ABI resolution
│   ├── validation/
│   │   ├── address.ts             # Checksum validation
│   │   ├── delay.ts               # minDelay validation
│   │   └── calldata.ts            # Hex format validation
│   └── utils/
│       ├── time.ts                # ETA formatting (relative + absolute)
│       ├── truncate.ts            # Address truncation (0x1234...5678)
│       └── status.ts              # Operation status calculation
│
├── hooks/                         # Custom React hooks
│   ├── useTimelockController.ts   # Contract interaction hook
│   ├── useOperations.ts           # Fetch operations from subgraph/API
│   ├── useRoles.ts                # Fetch role members
│   ├── useRoleCheck.ts            # Real-time hasRole verification
│   ├── useABIResolver.ts          # Multi-source ABI fetching
│   ├── useProxyDetection.ts       # EIP-1967/1822 implementation fetch
│   └── useNetworkStatus.ts        # Wrong network detection
│
├── services/                      # External API integrations
│   ├── subgraph/
│   │   ├── client.ts              # The Graph client setup
│   │   ├── queries.ts             # GraphQL queries
│   │   └── types.ts               # Generated types from schema
│   ├── blockscout/
│   │   ├── client.ts              # HTTP client for Blockscout API
│   │   ├── abi-fetcher.ts         # Contract ABI fetching
│   │   └── proxy-resolver.ts      # Proxy implementation detection
│   └── fourbyte/
│       └── signature-lookup.ts    # 4byte directory API
│
├── types/                         # TypeScript type definitions
│   ├── operation.ts               # Operation, Call, Status enums
│   ├── role.ts                    # Role, RoleEvent types
│   ├── abi.ts                     # ABISource, ABIConfidence enums
│   └── network.ts                 # NetworkConfig, ChainId types
│
└── styles/
    ├── globals.css                # Rootstock design tokens
    └── rootstock-theme.css        # Editor Mode color palette

subgraph/                          # The Graph subgraph (separate deployment)
├── schema.graphql                 # Entity definitions
├── subgraph.yaml                  # Manifest (mainnet/testnet configs)
├── src/
│   └── timelock-mapping.ts       # Event handlers
└── abis/
    └── TimelockController.json

tests/
├── unit/
│   ├── calldata.test.ts           # Encoder/decoder tests
│   ├── abi-resolver.test.ts       # ABI resolution priority tests
│   ├── status.test.ts             # Operation status calculation
│   └── validation.test.ts         # Address/delay validation
├── integration/
│   ├── wallet-connection.test.tsx  # RainbowKit flow
│   ├── operation-execution.test.tsx # Execute/cancel flows
│   ├── proposal-builder.test.tsx   # Multi-step wizard
│   └── role-verification.test.tsx  # hasRole checks
└── fixtures/
    ├── mock-abis.ts               # Contract ABI fixtures
    ├── mock-operations.ts         # Operation data
    └── mock-roles.ts              # Role event data

.specify/
└── memory/
    └── constitution.md            # Project constitution (already exists)
```

**Structure Decision**: Web application structure chosen (Option 2 pattern). Frontend-focused Next.js app with API routes for data aggregation from The Graph and Blockscout. Subgraph deployed separately to The Graph's hosted service. No traditional "backend" server - all blockchain interactions are client-side via wagmi/viem. Storage is sessionStorage for ABI cache and external indexed data via subgraph.

**Key Architectural Decisions**:

1. **App Router over Pages Router**: Use Next.js 15 App Router for better streaming, layouts, and Server Components where applicable (static operation lists).

2. **Subgraph as Source of Truth**: The Graph subgraph indexes all TimelockController events (CallScheduled, CallExecuted, Cancelled, RoleGranted, RoleRevoked) to provide queryable history. This solves the enumeration problem for roles and provides efficient operation filtering.

3. **Hybrid Data Strategy**:
   - Subgraph (primary): Fast queries, historical data, role member lists
   - RPC via wagmi (verification): Real-time hasRole checks, current on-chain state
   - Blockscout API (fallback + ABIs): Contract verification status, ABI fetching, event logs if subgraph down

4. **Client-Side Only**: No server-side wallet management. All signing happens in browser via RainbowKit-connected wallets. API routes only aggregate/transform data from external sources.

5. **ABI Resolution Pipeline**:
   - Manual input (highest confidence)
   - Session cache
   - Blockscout verified (with proxy resolution)
   - Known registry
   - 4byte directory (lowest confidence)

6. **Component Library**: Custom Rootstock-themed components built on Radix UI primitives for accessibility, styled with Tailwind using Rootstock brand tokens.

## Complexity Tracking

> **Not Applicable**: No constitution violations detected. This section intentionally left empty as all gates passed.

---

## Phase 0: Research ✅ COMPLETE

**Output**: [research.md](./research.md)

Comprehensive research completed covering:

1. The Graph subgraph best practices for TimelockController
2. Proxy contract detection (EIP-1967 & EIP-1822)
3. Blockscout API integration patterns
4. ABI-driven dynamic form generation
5. Rootstock network configuration with wagmi
6. Real-time role permission verification
7. Operation status calculation
8. Tailwind + Rootstock design system integration

All NEEDS CLARIFICATION items resolved with specific technology decisions, rationale, alternatives considered, implementation notes, and references.

---

## Phase 1: Design & Contracts ✅ COMPLETE

**Outputs**:

- [data-model.md](./data-model.md) - Entity schemas, validation rules, relationships, state transitions
- [contracts/subgraph.graphql](./contracts/subgraph.graphql) - The Graph schema for indexing TimelockController events
- [contracts/blockscout.yaml](./contracts/blockscout.yaml) - Blockscout API integration specification
- [contracts/known-abis.json](./contracts/known-abis.json) - Registry of known OpenZeppelin contract ABIs
- [quickstart.md](./quickstart.md) - Developer onboarding guide with installation, setup, deployment, testing, and troubleshooting

**Agent Context Updated**: CLAUDE.md updated with:

- Language: TypeScript 5.5+ (strict mode enabled)
- Framework: Next.js 15+, React 19+, wagmi 2.17+, viem 2.40+, RainbowKit 2.2+, TanStack Query 5.55+
- Database: SessionStorage (ABI cache), The Graph subgraphs, Blockscout API (fallback)
- Project Type: Web application (frontend-focused with API routes)

---

## Phase 2: Tasks Generation - NEXT STEP

**Command**: `/speckit.tasks`

This will generate `tasks.md` with dependency-ordered implementation tasks based on the complete planning artifacts.

**Readiness**: All prerequisites complete. Ready to proceed to task generation.
