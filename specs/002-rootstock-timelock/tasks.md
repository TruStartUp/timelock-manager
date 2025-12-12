---
description: 'Task list for Rootstock Timelock Management App - Blockchain Integration Phase'
---

# Tasks: Rootstock Timelock Management App

**Input**: Design documents from `/specs/002-rootstock-timelock/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Current State**: UI implementation complete with mock data. This task list focuses on **Phase 3: Blockchain Integration** to replace mock data with live contract interactions.

**Tests**: Tests are included per constitution requirements (test-first development workflow)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure**: `src/` at repository root
- Components: `src/components/`
- Hooks: `src/hooks/`
- Services: `src/services/`
- Types: `src/types/`
- Tests: `tests/unit/`, `tests/integration/`
- Subgraph: `subgraph/`

---

## Phase 1: Setup (Verify Infrastructure) ✅ COMPLETE

**Purpose**: Verify existing UI structure and prepare for blockchain integration

- [X] T001 Verify wagmi configuration in src/wagmi.ts includes Rootstock chains (chainId 30, 31)
- [X] T002 [P] Create TypeScript type definitions in src/types/operation.ts for Operation and Call entities from data-model.md
- [X] T003 [P] Create TypeScript type definitions in src/types/role.ts for Role and RoleAssignment entities from data-model.md
- [X] T004 [P] Create TypeScript type definitions in src/types/abi.ts for ABISource, ABIConfidence enums from data-model.md
- [X] T005 [P] Create constants file src/lib/constants.ts with role hashes (PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE, DEFAULT_ADMIN_ROLE) from spec.md FR-011
- [X] T006 Create environment variable template .env.example with all required NEXT_PUBLIC_ variables from quickstart.md
- [X] T007 Verify RainbowKit provider setup in src/pages/_app.tsx matches wagmi 2.17+ requirements

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core blockchain infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Subgraph Deployment (P0 - Blocking All Stories)

- [X] T008 Create subgraph schema in subgraph/schema.graphql with Operation, Call, Role, RoleAssignment entities from data-model.md
- [X] T009 Implement handleCallScheduled event handler in subgraph/src/mapping.ts to create Operation and Call entities
- [X] T010 [P] Implement handleCallExecuted event handler in subgraph/src/mapping.ts to update Operation.executedAt
- [X] T011 [P] Implement handleCancelled event handler in subgraph/src/mapping.ts to update Operation.cancelledAt
- [X] T012 [P] Implement handleRoleGranted event handler in subgraph/src/mapping.ts to create RoleAssignment entities
- [X] T013 [P] Implement handleRoleRevoked event handler in subgraph/src/mapping.ts to create RoleAssignment entities
- [X] T014 Configure subgraph.yaml with Rootstock Testnet (chainId 31) and sample TimelockController address
- [X] T015 Deploy subgraph to The Graph Studio following quickstart.md instructions
- [X] T016 Update .env.local with NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL from deployment
- [X] T017 Verify subgraph indexing progress in The Graph Studio dashboard

### Core Service Layer

- [X] T018 Create GraphQL client in src/services/subgraph/client.ts using urql with Rootstock testnet endpoint
- [X] T019 [P] Create operation queries in src/services/subgraph/operations.ts (fetchOperations, fetchOperationById) matching schema
- [X] T020 [P] Create role queries in src/services/subgraph/roles.ts (fetchRoles, fetchRoleAssignments) matching schema
- [X] T021 Create Blockscout API client in src/services/blockscout/client.ts with rate limiting (10 RPS) from research.md Section 3
- [X] T022 Implement getContractABI function in src/services/blockscout/abi.ts with caching and exponential backoff
- [X] T023 [P] Create 4byte directory client in src/services/fourbyte/client.ts for function signature lookup from research.md

### Contract ABIs and Validation

- [X] T024 Copy TimelockController ABI to src/lib/abis/TimelockController.json from specs/002-rootstock-timelock/contracts/
- [X] T025 [P] Copy AccessControl ABI to src/lib/abis/AccessControl.json from specs/002-rootstock-timelock/contracts/
- [X] T026 [P] Copy IAccessManager ABI to src/lib/abis/IAccessManager.json from specs/002-rootstock-timelock/contracts/
- [X] T027 Create Zod validation schemas in src/lib/validation.ts for Solidity types (address, uint, bytes, arrays, tuples) from research.md Section 4

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Pending Timelock Operations (Priority: P1) 🎯 MVP

**Goal**: Users can view all operations in a TimelockController contract with correct status (Pending/Ready/Executed/Cancelled), ETA, and decoded call details within 5 seconds

**Independent Test**: Connect to Rootstock testnet, enter a TimelockController address, verify all operations display with accurate status and countdown timers. Verify decoded function names appear for verified contracts.

**Acceptance Scenarios from spec.md**:
- Display all 5 pending operations when contract has 5 queued actions
- Show "Ready" status for operations past ETA with execute button visible
- Expand operation to show all batched calls with target addresses, values, calldata
- Display decoded function name with "Verified" badge for verified contracts
- Show raw calldata with "Unverified" warning for unverified contracts

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T028 [P] [US1] Unit test for operation status calculation in tests/unit/status.te *st.ts (PENDING → READY → EXECUTED transitions)
- [X] T029 [P] [US1] Integration test for useOperations hook in tests/integration/operations-fetch.test.tsx with mock subgraph responses

### Implementation for User Story 1

- [X] T030 [P] [US1] Create useOperations hook in src/hooks/useOperations.ts to fetch operations from subgraph with filters (status, proposer, target, date range)
- [X] T031 [P] [US1] Create useOperationStatus hook in src/hooks/useOperationStatus.ts with real-time countdown timer and contract state checks (getTimestamp, isOperationReady, isOperationDone)
- [X] T032 [US1] Integrate useOperations in src/components/dashboard/DashboardView.tsx to replace mock operation counts (Pending: X, Ready: Y, Executed: Z)
- [X] T033 [US1] Integrate useOperations in src/components/operations_explorer/OperationsExplorerView.tsx to replace mockOperations array
- [X] T034 [US1] Integrate useOperationStatus in src/components/operations_explorer/OperationsExplorerView.tsx for each operation row to show live countdown and status
- [X] T035 [US1] Add error handling in OperationsExplorerView for subgraph unavailable scenario with "Using fallback data source" notice
- [X] T036 [US1] Add loading states in DashboardView and OperationsExplorerView while operations fetch

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view and monitor all timelock operations with live blockchain data

---

## Phase 4: User Story 2 - Execute Ready Timelock Operations (Priority: P2)i

**Goal**: Users with EXECUTOR_ROLE can execute operations that have passed their delay, with transaction confirmation and status updates

**Independent Test**: Connect wallet with EXECUTOR_ROLE to testnet, execute a ready operation, verify transaction succeeds and operation status changes to "Executed"

**Acceptance Scenarios from spec.md**:
- Execute button prepares transaction showing operation details for confirmation
- Operation status updates to "Executed" after transaction confirms
- Execute button disabled with tooltip when wallet lacks EXECUTOR_ROLE
- All action buttons disabled with "Wrong network" banner when on unsupported network

### Tests for User Story 2

- [X] T037 [P] [US2] Integration test for useTimelockWrite hook in tests/integration/execute-operation.test.tsx with wagmi mock

### Implementation for User Story 2

- [X] T038 [P] [US2] Create useHasRole hook in src/hooks/useHasRole.ts using wagmi useReadContract with 5-minute staleTime from research.md Section 6
- [X] T039 [US2] Create useTimelockWrite hook in src/hooks/useTimelockWrite.ts with execute mutation using wagmi useWriteContract
- [X] T040 [US2] Implement pre-flight permission check in useTimelockWrite.execute using useHasRole(EXECUTOR_ROLE)
- [X] T041 [US2] Integrate useHasRole in src/components/operations_explorer/OperationsExplorerView.tsx to enable/disable Execute button based on connected wallet role
- [X] T042 [US2] Connect Execute button in OperationsExplorerView to useTimelockWrite.execute with operation parameters (targets, values, calldata, predecessor, salt)
- [X] T043 [US2] Add transaction pending/success/error states to Execute button using TanStack Query mutation states
- [X] T044 [US2] Implement automatic operation list refresh after successful execution using queryClient.invalidateQueries
- [X] T045 [US2] Add tooltip to disabled Execute button showing "Your wallet does not have the EXECUTOR_ROLE" when role check fails

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can view operations and execute ready ones if they have permission

---

## Phase 5: User Story 3 - View and Understand Role Permissions (Priority: P2)

**Goal**: Users can see which addresses hold PROPOSER, EXECUTOR, CANCELLER, and ADMIN roles, with historical grant/revoke events

**Independent Test**: Query a TimelockController, verify all 4 standard roles display with current holders and connected wallet's roles are highlighted

**Acceptance Scenarios from spec.md**:
- Display all 4 standard roles (PROPOSER, EXECUTOR, CANCELLER, ADMIN) with role hashes
- Show all 3 addresses holding a role with copy buttons
- Display role history with Grant/Revoke events in chronological order with TX hashes and timestamps
- Show link to AccessManager when DEFAULT_ADMIN_ROLE held by AccessManager contract
- Highlight roles held by connected wallet

### Tests for User Story 3

- [X] T046 [P] [US3] Integration test for useRoles hook in tests/integration/role-checks.test.tsx with mock RPC and subgraph responses

### Implementation for User Story 3

- [X] T047 [P] [US3] Create useRoles hook in src/hooks/useRoles.ts to fetch role members and history from subgraph, with event-sourcing logic to compute current members from RoleGranted/RoleRevoked
- [X] T048 [US3] Integrate useRoles in src/components/dashboard/DashboardView.tsx to replace mock role summary table with live member counts
- [X] T049 [US3] Integrate useRoles in src/components/permissions/PermissionsView.tsx to replace mockRoles with live data for all 4 standard roles
- [X] T050 [US3] Integrate useHasRole in PermissionsView to detect and highlight roles held by connected wallet
- [X] T051 [US3] Implement AccessManager detection in PermissionsView - check if DEFAULT_ADMIN_ROLE holder implements IAccessManager interface and display link
- [X] T052 [US3] Add copy-to-clipboard functionality for role member addresses in PermissionsView role holders list
- [X] T053 [US3] Display role history table in PermissionsView with columns: Action (Grant/Revoke), Target Address, TX Hash (link to explorer), Timestamp

**Checkpoint**: All role management features now work with live blockchain data - users can audit access control

---

## Phase 6: User Story 4 - Schedule New Timelock Operations (Priority: P3)

**Goal**: Users with PROPOSER_ROLE can schedule new operations by selecting target contracts, functions, and parameters with ABI-driven form generation

**Independent Test**: Connect wallet with PROPOSER_ROLE, select verified contract, build transaction, schedule it, verify new operation appears in operations list with correct parameters

**Acceptance Scenarios from spec.md**:
- Contract ABI automatically fetched for verified contracts
- Proxy contract's implementation ABI fetched and used
- Manual ABI input modal blocks progression for unverified contracts
- Typed form fields auto-generated (address with checksum, uint with range, bytes as hex)
- Validation error shown when delay < getMinDelay()
- Extra confirmation "CONFIRM" typed input required for high-risk functions (upgradeTo, transferOwnership)
- Operation ID, ETA, TX hash displayed on successful scheduling

### Tests for User Story 4

- [X] T054 [P] [US4] Unit test for ABI resolution priority in tests/unit/abi-resolver.test.ts (Manual → Blockscout → Known registry → 4byte)
- [X] T055 [P] [US4] Unit test for Zod validators in tests/unit/validation.test.ts (address checksum, uint ranges, bytes hex format)

### Implementation for User Story 4

- [X] T056 [P] [US4] Create useContractABI hook in src/hooks/useContractABI.ts implementing priority: Session cache → Blockscout verified → Known registry → 4byte from research.md Section 3
- [X] T057 [US4] Implement proxy detection in useContractABI using evm-proxy-detection library for EIP-1967/EIP-1822/EIP-1167 from research.md Section 2
- [X] T058 [US4] Add schedule mutation to useTimelockWrite hook in src/hooks/useTimelockWrite.ts using wagmi useWriteContract for schedule() and scheduleBatch()
- [X] T059 [US4] Implement pre-flight permission check in useTimelockWrite.schedule using useHasRole(PROPOSER_ROLE)
- [X] T060 [US4] Implement pre-flight delay validation in useTimelockWrite.schedule comparing user delay with getMinDelay() result
- [X] T061 [US4] Integrate useContractABI in src/components/new_proposal/NewProposalView.tsx Step 1 to fetch ABI on "Fetch ABI" button click
- [X] T062 [US4] Display manual ABI input modal in NewProposalView when useContractABI returns confidence=null (unverified contract)
- [X] T063 [US4] Generate dynamic form fields in NewProposalView Step 2 using React Hook Form + Zod validators for each function parameter type from ABI
- [X] T064 [US4] Implement function selector dropdown in NewProposalView Step 2 showing all functions from fetched ABI
- [ ] T065 [US4] Build Step 3 review screen in NewProposalView showing human-readable summary (target.function(args)), delay, minDelay, predecessor, salt, encoded calldata preview
- [ ] T066 [US4] Add high-risk function detection in NewProposalView Step 3 for upgradeTo, transferOwnership, setAdmin, updateDelay requiring "CONFIRM" text input
- [ ] T067 [US4] Connect Submit button in NewProposalView Step 3 to useTimelockWrite.schedule with all parameters (target, value, data, predecessor, salt, delay)
- [ ] T068 [US4] Display success screen in NewProposalView showing operation ID, ETA, and TX hash after successful scheduling
- [ ] T069 [US4] Store user-provided ABIs in sessionStorage when manual ABI input used, with 24-hour TTL from research.md Section 3

**Checkpoint**: Users can now create new timelock proposals through the complete wizard flow with blockchain validation

---

## Phase 7: User Story 5 - Decode Arbitrary Calldata for Safety Verification (Priority: P3)

**Goal**: Users can decode raw transaction calldata to verify actions before voting/executing, with confidence indicators

**Independent Test**: Paste calldata from known transaction, verify decoded output matches expected function and parameters with appropriate confidence badge

**Acceptance Scenarios from spec.md**:
- Decode with verified contract address shows function signature and parameters with "Verified" badge
- Manual ABI input proceeds with high confidence indication
- Calldata without contract/ABI shows 4byte directory results with "⚠️ Decoded using guessed signature" warning
- TimelockController execute/executeBatch calldata recursively decoded showing nested operations
- Undecipherable calldata shows raw hex with "Cannot decode" message

### Tests for User Story 5

- [ ] T070 [P] [US5] Unit test for recursive decoding in tests/unit/decoder.test.ts (execute/executeBatch inner calls)

### Implementation for User Story 5

- [ ] T071 [US5] Create decodeCalldata utility function in src/lib/decoder.ts using viem decodeFunctionData with ABI resolution priority
- [ ] T072 [US5] Implement recursive decode logic in decoder.ts for TimelockController execute() and executeBatch() functions to extract and decode inner calls
- [ ] T073 [US5] Integrate useContractABI in src/components/decoder/DecoderView.tsx for optional contract address input to fetch verified ABI
- [ ] T074 [US5] Integrate decodeCalldata utility in DecoderView to process calldata input when user clicks "Decode" button
- [ ] T075 [US5] Display decoded output in DecoderView showing: Function name, Full signature, Parameter table (Name, Type, Value), Confidence indicator badge
- [ ] T076 [US5] Implement confidence badge display in DecoderView: "✅ Verified contract" (green) for Blockscout-verified, "⚠️ Decoded using guessed signature" (yellow) for 4byte, "❌ Cannot decode" (red) for failures
- [ ] T077 [US5] Add nested operation display in DecoderView for recursively decoded execute/executeBatch calls with collapsible sections
- [ ] T078 [US5] Add manual ABI JSON input option in DecoderView with validation and sessionStorage caching

**Checkpoint**: Calldata decoder is fully functional for safety verification of governance transactions

---

## Phase 8: User Story 6 - Cancel Pending Operations (Priority: P4)

**Goal**: Users with CANCELLER_ROLE can cancel pending operations before they become executable

**Independent Test**: Connect wallet with CANCELLER_ROLE, select pending operation, cancel it, verify status changes to "Canceled"

**Acceptance Scenarios from spec.md**:
- Confirmation dialog shows operation details before cancellation
- Operation status updates to "Canceled" after transaction confirms
- Cancel button disabled with tooltip when wallet lacks CANCELLER_ROLE

### Implementation for User Story 6

- [ ] T079 [US6] Add cancel mutation to useTimelockWrite hook in src/hooks/useTimelockWrite.ts using cancel(id) function
- [ ] T080 [US6] Implement pre-flight permission check in useTimelockWrite.cancel using useHasRole(CANCELLER_ROLE)
- [ ] T081 [US6] Integrate useHasRole in src/components/operations_explorer/OperationsExplorerView.tsx to enable/disable Cancel button based on CANCELLER_ROLE
- [ ] T082 [US6] Add confirmation dialog in OperationsExplorerView showing full operation details before cancel() transaction submission
- [ ] T083 [US6] Connect Cancel button to useTimelockWrite.cancel with operation ID parameter
- [ ] T084 [US6] Add transaction pending/success/error states to Cancel button
- [ ] T085 [US6] Implement automatic operation list refresh after successful cancellation
- [ ] T086 [US6] Add tooltip to disabled Cancel button showing "Your wallet does not have the CANCELLER_ROLE"

**Checkpoint**: Users can now cancel pending operations if they have the appropriate role

---

## Phase 9: User Story 7 - Filter and Search Operations (Priority: P4)

**Goal**: Users can filter operations by status, search by address, and apply date ranges to find relevant operations quickly

**Independent Test**: Apply various filters (status tabs, address search, date range), verify only matching operations displayed

**Acceptance Scenarios from spec.md**:
- Filter by "Pending" shows only pending operations from 50 total
- Search by proposer address shows only that proposer's operations
- Filter by target address shows only operations calling that contract
- Date range filter shows only operations scheduled within range

### Implementation for User Story 7

- [ ] T087 [US7] Extend useOperations hook in src/hooks/useOperations.ts to support filter parameters: status (Pending/Ready/Executed/Cancelled), proposer address, target address, dateFrom, dateTo
- [ ] T088 [US7] Update subgraph queries in src/services/subgraph/operations.ts to support where clauses for all filter combinations
- [ ] T089 [US7] Add filter state management in src/components/operations_explorer/OperationsExplorerView.tsx using React state for active filters
- [ ] T090 [US7] Connect status filter chips (All/Pending/Ready/Executed/Canceled) to useOperations filter parameter
- [ ] T091 [US7] Connect search input to useOperations filter parameter for proposer/target address filtering
- [ ] T092 [US7] Add date range picker in OperationsExplorerView and connect to useOperations dateFrom/dateTo parameters
- [ ] T093 [US7] Display active filter badges in OperationsExplorerView showing current filter selections with clear buttons
- [ ] T094 [US7] Add filter results count display showing "Showing X of Y operations"

**Checkpoint**: Users can efficiently find specific operations in large operation lists using multiple filter criteria

---

## Phase 10: User Story 8 - Manage Custom Network and ABI Settings (Priority: P4)

**Goal**: Advanced users can configure custom RPC endpoints and import custom contract ABIs

**Independent Test**: Enter custom RPC URL, test connection, save it, verify operations continue working. Import custom ABI, verify it's used for decoding.

**Acceptance Scenarios from spec.md**:
- Custom RPC URL can be entered, tested for connection, and saved
- Custom contract ABI JSON can be imported and appears in ABI management list
- All stored ABIs can be exported as JSON file
- Stored custom ABI can be deleted

### Implementation for User Story 8

- [ ] T095 [P] [US8] Create network configuration state management in src/hooks/useNetworkConfig.ts for custom RPC storage in localStorage
- [ ] T096 [P] [US8] Create ABI management state in src/hooks/useABIManager.ts for custom ABI storage in sessionStorage
- [ ] T097 [US8] Integrate useNetworkConfig in src/components/settings/SettingsView.tsx for custom RPC URL input and connection test
- [ ] T098 [US8] Add RPC connection test function in SettingsView using wagmi publicClient to verify custom endpoint
- [ ] T099 [US8] Integrate useABIManager in SettingsView for custom ABI JSON import with validation
- [ ] T100 [US8] Display stored custom ABIs list in SettingsView with contract addresses and delete buttons
- [ ] T101 [US8] Implement ABI export functionality in SettingsView to download all stored ABIs as JSON file
- [ ] T102 [US8] Connect custom RPC setting to wagmi configuration reload using wagmi's configureChains
- [ ] T103 [US8] Update useContractABI hook to check custom ABI storage before Blockscout API lookup

**Checkpoint**: Power users can customize network settings and manage contract ABIs for specialized use cases

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and production readiness

- [ ] T104 [P] Add network mismatch detection in src/components/common/Layout.tsx with "Wrong network" banner when wallet on non-Rootstock chain
- [ ] T105 [P] Implement automatic network switching using wagmi useSwitchChain when user on wrong network
- [ ] T106 [P] Add global error boundary in src/pages/_app.tsx to catch and display React errors gracefully
- [ ] T107 [P] Implement subgraph health check in src/services/subgraph/client.ts with automatic fallback to Blockscout API
- [ ] T108 [P] Add Blockscout API fallback implementation in src/services/blockscout/events.ts for fetching events when subgraph unavailable
- [ ] T109 Add dangerous function highlighting in operation displays (upgradeTo, transferOwnership, updateDelay) with visual warning badges
- [ ] T110 [P] Implement role change detection with periodic background refresh of hasRole checks (5-minute interval)
- [ ] T111 [P] Add transaction simulation preview for Execute/Cancel/Schedule using Tenderly or similar (optional enhancement)
- [ ] T112 Optimize large operation list performance with virtual scrolling in OperationsExplorerView for 100+ operations
- [ ] T113 [P] Add accessibility improvements: keyboard navigation, screen reader labels, focus management
- [ ] T114 [P] Create comprehensive error messages for all contract interaction failures with user-friendly explanations
- [ ] T115 Add analytics tracking for key user actions (wallet connected, operation executed, proposal created) using privacy-respecting tracker
- [ ] T116 [P] Performance optimization: implement pagination for operations list to avoid loading entire chain history
- [ ] T117 [P] Add proper loading skeletons for all data fetching states replacing generic spinners
- [ ] T118 Validate all functional requirements (FR-001 through FR-069) are met with manual testing checklist
- [ ] T119 Run quickstart.md validation - verify new developer can set up and run the app following guide
- [ ] T120 [P] Update README.md with production deployment instructions and environment variable documentation
- [ ] T121 Deploy to Vercel staging environment and run smoke tests on Rootstock Testnet
- [ ] T122 Create production deployment checklist (environment variables, subgraph URLs, RPC endpoints)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - Subgraph deployment is CRITICAL - must complete before any hooks can fetch data
  - Service layer provides API clients needed by all hooks
- **User Stories (Phases 3-10)**: All depend on Foundational phase completion
  - Can proceed in parallel if team capacity allows
  - Or sequentially in priority order (P1 → P2 → P2 → P3 → P3 → P4 → P4 → P4)
- **Polish (Phase 11)**: Depends on MVP user stories (at minimum US1, US2, US3) being complete

### User Story Dependencies

- **User Story 1 (P1 - View Operations)**: Foundational only - No dependencies on other stories ✅ START HERE
- **User Story 2 (P2 - Execute Operations)**: Foundational + US1 (uses same operations display) - Can start independently after Foundational
- **User Story 3 (P2 - View Roles)**: Foundational only - No dependencies on other stories ✅ PARALLEL with US1
- **User Story 4 (P3 - Schedule Operations)**: Foundational only - No dependencies on other stories ✅ PARALLEL possible
- **User Story 5 (P3 - Decode Calldata)**: Foundational only - No dependencies on other stories ✅ PARALLEL possible
- **User Story 6 (P4 - Cancel Operations)**: Foundational + US1 (uses operations display) - Can integrate into existing UI
- **User Story 7 (P4 - Filter Operations)**: Foundational + US1 (extends useOperations hook) - Enhances US1
- **User Story 8 (P4 - Settings)**: Foundational only - Fully independent ✅ PARALLEL possible

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Hooks before component integration (hooks are data layer)
- Services before hooks (services provide data sources)
- Core hook implementation before UI integration
- Story validated independently before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002, T003, T004, T005, T006 can all run in parallel (different files)

**Phase 2 (Foundational)**:
- After subgraph schema (T008), event handlers T010-T013 can run in parallel
- Service layer: T019, T020, T023, T025, T026 can run in parallel (different services/files)

**Phase 3 (User Story 1)**:
- Tests T028, T029 can run in parallel
- Hooks T030, T031 can run in parallel (different files)
- Component integrations T032-T036 are sequential (same components)

**Phase 4 (User Story 2)**:
- T038, T039 can run in parallel (different hook files)

**Phase 5 (User Story 3)**:
- T047 hook creation can be parallel with tests T046

**Phase 6 (User Story 4)**:
- Tests T054, T055 can run in parallel
- Hooks T056, T058 can run in parallel after T039 complete

**Phase 11 (Polish)**:
- Most tasks (T104-T122) marked [P] can run in parallel as they touch different concerns

**User Story Parallelization** (if multiple developers):
- After Foundational (Phase 2): US1, US3, US4, US5, US8 can all start in parallel
- US2, US6, US7 should wait for US1 as they extend operations display

---

## Parallel Example: User Story 1

```bash
# After Foundational Phase completes, launch all User Story 1 tests together:
Task: "Unit test for operation status calculation in tests/unit/status.test.ts"
Task: "Integration test for useOperations hook in tests/integration/operations-fetch.test.tsx"

# After tests written, launch both hooks in parallel:
Task: "Create useOperations hook in src/hooks/useOperations.ts"
Task: "Create useOperationStatus hook in src/hooks/useOperationStatus.ts"

# Then integrate into components sequentially (same files)
```

---

## Parallel Example: User Story 4

```bash
# Launch tests in parallel:
Task: "Unit test for ABI resolution priority in tests/unit/abi-resolver.test.ts"
Task: "Unit test for Zod validators in tests/unit/validation.test.ts"

# Launch hooks in parallel:
Task: "Create useContractABI hook in src/hooks/useContractABI.ts"
Task: "Add schedule mutation to useTimelockWrite hook in src/hooks/useTimelockWrite.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only)

This provides complete core governance functionality:

1. **Complete Phase 1**: Setup (T001-T007) - 1 hour
2. **Complete Phase 2**: Foundational (T008-T027) - 2-3 days
   - Subgraph deployment is the longest task (deploy + wait for indexing)
   - Service layer can be built in parallel with subgraph indexing
3. **Complete Phase 3**: User Story 1 (T028-T036) - 1 day
4. **VALIDATE US1**: Test viewing operations independently
5. **Complete Phase 4**: User Story 2 (T037-T045) - 1 day
6. **VALIDATE US1+US2**: Test executing operations
7. **Complete Phase 5**: User Story 3 (T046-T053) - 1 day
8. **VALIDATE MVP**: All core governance features work (view, execute, roles)
9. **Deploy MVP to staging** and test on Rootstock Testnet

**MVP Delivers**: Users can view operations, execute ready ones, audit roles - complete read-write governance tool

**Estimated MVP Effort**: 6-8 days

### Incremental Delivery Beyond MVP

After MVP is validated and deployed:

1. **Add User Story 4**: Schedule operations (T054-T069) - 2 days
   - Enables proactive governance (creating proposals)
   - Deploy/Demo: Now a complete governance lifecycle tool

2. **Add User Story 5**: Decode calldata (T070-T078) - 1 day
   - Adds safety verification capability
   - Deploy/Demo: Transparency and security enhancement

3. **Add User Story 6**: Cancel operations (T079-T086) - 0.5 days
   - Safety mechanism for governance

4. **Add User Story 7**: Filter/search (T087-T094) - 1 day
   - UX improvement for power users

5. **Add User Story 8**: Settings (T095-T103) - 1 day
   - Advanced configuration options

6. **Polish Phase**: Production hardening (T104-T122) - 2-3 days
   - Error handling, performance, accessibility, deployment prep

**Full Implementation Effort**: 12-16 days total

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

1. **Developer A**: User Story 1 (View Operations) - Critical path
2. **Developer B**: User Story 3 (View Roles) - Fully independent
3. **Developer C**: User Story 5 (Decode Calldata) - Fully independent

All three can work simultaneously without conflicts. Once US1 completes, Developer A can proceed to US2 (Execute) which builds on US1's foundation.

With 2 developers:
1. **Developer A**: US1 → US2 → US6 (operations flow)
2. **Developer B**: US3 → US4 → US5 (roles + proposals + decoder)

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe to parallelize
- **[Story] labels**: Map tasks to user stories from spec.md for traceability
- **Independent testing**: Each user story has clear acceptance criteria and can be validated standalone
- **Test-first workflow**: Constitution requires tests written before implementation (Red-Green-Refactor)
- **Subgraph is blocking**: T008-T017 must complete before any user story can fetch live data
- **UI exists**: All component files already exist with mock data - tasks focus on integration, not creation
- **Commit strategy**: Commit after each completed task or logical group
- **Checkpoint validation**: Stop at each checkpoint to validate story independently before proceeding
- **Error handling**: All blockchain interactions must handle failures gracefully with user-friendly messages
- **Performance**: Consider pagination and virtual scrolling for large datasets (100+ operations)

---

## Task Count Summary

- **Phase 1 (Setup)**: 7 tasks
- **Phase 2 (Foundational)**: 20 tasks (BLOCKING)
- **Phase 3 (US1 - View)**: 9 tasks 🎯 MVP
- **Phase 4 (US2 - Execute)**: 9 tasks 🎯 MVP
- **Phase 5 (US3 - Roles)**: 8 tasks 🎯 MVP
- **Phase 6 (US4 - Schedule)**: 16 tasks
- **Phase 7 (US5 - Decode)**: 8 tasks
- **Phase 8 (US6 - Cancel)**: 8 tasks
- **Phase 9 (US7 - Filter)**: 8 tasks
- **Phase 10 (US8 - Settings)**: 9 tasks
- **Phase 11 (Polish)**: 19 tasks

**Total**: 122 tasks

**MVP Scope** (Phases 1-5): 53 tasks - Delivers complete view + execute + roles governance tool
**Parallel Opportunities**: 40+ tasks marked [P] can run concurrently
**Independent Stories**: US1, US3, US4, US5, US8 can all start simultaneously after Foundational
