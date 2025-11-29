# Tasks: Rootstock Timelock Management App

This file outlines the implementation tasks for the Rootstock Timelock Management App, generated from the specification and planning documents.

## Phase 1: Project Setup

- [x] T001 Initialize Next.js project with TypeScript and Tailwind CSS
- [x] T002 Create project structure in `src/` as per `plan.md` (app, components, lib, hooks, services, types, styles)
- [x] T003 Install primary dependencies: `wagmi`, `viem`, `react-query`, `@tanstack/react-query`, `@rainbow-me/rainbowkit`
- [x] T004 Install development dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `eslint`, `prettier`
- [x] T005 Configure ESLint and Prettier for the project in `.eslintrc.json` and `.prettierrc`
- [x] T006 Create `.env.example` with all required environment variables from `quickstart.md`
- [x] T007 Configure `tsconfig.json` for strict mode and path aliases (`@/*`)
- [x] T008 Configure `tailwind.config.ts` with Rootstock brand colors and "Editor Mode" theme from `spec.md`
- [x] T009 Create `tests/setup.ts` and `vitest.config.ts` for Vitest environment

## Phase 2: Foundational Layer

- [ ] T010 [P] Define Rootstock chain configurations in `src/lib/constants/chains.ts` using `defineChain` from `viem`
- [ ] T011 [P] Create wagmi config in `src/lib/wagmi.ts` with Rootstock chains and RainbowKit connectors
- [ ] T012 [P] Implement `src/pages/_app.tsx` with `WagmiProvider`, `QueryClientProvider`, and `RainbowKitProvider`
- [ ] T013 Create basic layout in `src/app/layout.tsx` including `Navbar` and `Footer` components
- [ ] T014 Create `Navbar` component in `src/components/layout/Navbar.tsx` with a placeholder for wallet connection
- [ ] T015 Create `Footer` component in `src/components/layout/Footer.tsx`
- [ ] T016 Create `NetworkBanner` component in `src/components/ui/NetworkBanner.tsx` for wrong network warnings
- [ ] T017 Implement `useNetworkStatus` hook in `src/hooks/useNetworkStatus.ts` to detect wrong network
- [ ] T018 Define TimelockController ABIs in `src/lib/abi/TimelockController.ts`
- [ ] T019 Define AccessControl ABIs in `src/lib/abi/IAccessControl.ts`
- [ ] T020 Setup subgraph project in `subgraph/` with `graph init`
- [ ] T021 Define subgraph schema in `subgraph/schema.graphql` for Operation, Call, Role, and RoleAssignment entities
- [ ] T022 Implement subgraph mappings in `subgraph/src/timelock-mapping.ts` for `CallScheduled`, `CallExecuted`, `Cancelled`, `RoleGranted`, and `RoleRevoked` events

## Phase 3: User Story 1 - View Pending Timelock Operations (P1)

- [ ] T023 [US1] Define `Operation` and `Call` types in `src/types/operation.ts` based on `data-model.md`
- [ ] T024 [P] [US1] Create `OperationsList` component in `src/components/operations/OperationsList.tsx`
- [ ] T025 [P] [US1] Create `OperationCard` component in `src/components/operations/OperationCard.tsx` for a single row
- [ ] T026 [P] [US1] Create `StatusBadge` component in `src/components/ui/StatusBadge.tsx`
- [ ] T027 [US1] Implement `useOperations` hook in `src/hooks/useOperations.ts` to fetch operations from the subgraph
- [ ] T028 [US1] Create The Graph client in `src/services/subgraph/client.ts` and GraphQL queries in `queries.ts`
- [ ] T029 [US1] Implement fallback to Blockscout API in `useOperations` hook if subgraph fails
- [ ] T030 [P] [US1] Create `CallDecoder` component in `src/components/operations/CallDecoder.tsx` to show decoded call data
- [ ] T031 [P] [US1] Create `OperationDetail` component in `src/components/operations/OperationDetail.tsx`
- [ ] T032 [US1] Create `[id]/page.tsx` in `src/app/operations/` for the operation detail view
- [ ] T033 [US1] Create `page.tsx` in `src/app/operations/` to display the list of operations
- [ ] T034 [US1] Write unit tests for `useOperations` hook in `tests/unit/useOperations.test.ts`
- [ ] T035 [US1] Write integration tests for viewing operations list in `tests/integration/operations-view.test.tsx`

## Phase 4: User Story 2 - Execute Ready Timelock Operations (P2)

- [ ] T036 [US2] Implement `useTimelockController` hook in `src/hooks/useTimelockController.ts` for execute/cancel transactions
- [ ] T037 [US2] Add "Execute" button to `OperationCard` and `OperationDetail` components
- [ ] T038 [US2] Implement `useRoleCheck` hook in `src/hooks/useRoleCheck.ts` to verify `EXECUTOR_ROLE`
- [ ] T039 [US2] Gate "Execute" button visibility based on `useRoleCheck` hook and operation status
- [ ] T040 [US2] Implement transaction submission logic in `useTimelockController` hook using `wagmi`'s `useWriteContract`
- [ ] T041 [US2] Write integration test for executing an operation in `tests/integration/operation-execution.test.tsx`

## Phase 5: User Story 3 - View and Understand Role Permissions (P2)

- [ ] T042 [US3] Define `Role` and `RoleEvent` types in `src/types/role.ts`
- [ ] T043 [P] [US3] Create `RolesList` component in `src/components/roles/RolesList.tsx`
- [ ] T044 [P] [US3] Create `RoleCard` component in `src/components/roles/RoleCard.tsx`
- [ ] T045 [US3] Implement `useRoles` hook in `src/hooks/useRoles.ts` to fetch roles and members from the subgraph
- [ ] T046 [P] [US3] Create `RoleHistory` component in `src/components/roles/RoleHistory.tsx`
- [ ] T047 [US3] Create `page.tsx` in `src/app/roles/` to display the list of roles
- [ ] T048 [US3] Create `[roleHash]/page.tsx` in `src/app/roles/` for role detail view
- [ ] T049 [US3] Write integration tests for viewing roles in `tests/integration/roles-view.test.tsx`

## Phase 6: User Story 4 - Schedule New Timelock Operations (P3)

- [ ] T050 [US4] Create `page.tsx` in `src/app/proposal/` for the proposal builder
- [ ] T051 [P] [US4] Create `ProposalWizard` multistep component in `src/components/proposal/ProposalWizard.tsx`
- [ ] T052 [P] [US4] Create `ContractSelector` component in `src/components/proposal/ContractSelector.tsx` for step 1
- [ ] T053 [US4] Implement `useABIResolver` hook in `src/hooks/useABIResolver.ts` for ABI fetching pipeline
- [ ] T054 [US4] Implement Blockscout ABI fetcher in `src/services/blockscout/abi-fetcher.ts`
- [ ] T055 [US4] Implement proxy detection in `src/services/blockscout/proxy-resolver.ts` using `evm-proxy-detection`
- [ ] T056 [P] [US4] Create `FunctionBuilder` component in `src/components/proposal/FunctionBuilder.tsx` for step 2
- [ ] T057 [P] [US4] Create `DynamicFormField` component in `src/components/proposal/DynamicFormField.tsx` for ABI-driven inputs
- [ ] T058 [P] [US4] Create `ProposalReview` component in `src/components/proposal/ProposalReview.tsx` for step 3
- [ ] T059 [US4] Implement `schedule` and `scheduleBatch` logic in `useTimelockController` hook
- [ ] T060 [US4] Write integration test for the proposal builder in `tests/integration/proposal-builder.test.tsx`

## Phase 7: User Story 5 - Decode Arbitrary Calldata for Safety Verification (P3)

- [ ] T061 [US5] Create `page.tsx` in `src/app/decoder/` for the calldata decoder
- [ ] T062 [P] [US5] Create `CalldataInput` component in `src/components/decoder/CalldataInput.tsx`
- [ ] T063 [P] [US5] Create `DecodedOutput` component in `src/components/decoder/DecodedOutput.tsx`
- [ ] T064 [US5] Implement calldata decoder logic in `src/lib/calldata/decoder.ts` using `viem`'s `decodeFunctionData`
- [ ] T065 [US5] Implement 4byte directory signature lookup in `src/services/fourbyte/signature-lookup.ts`
- [ ] T066 [US5] Integrate `useABIResolver` hook into the decoder page
- [ ] T067 [US5] Write unit tests for calldata decoder in `tests/unit/calldata.test.ts`

## Phase 8: User Story 6 - Cancel Pending Operations (P4)

- [ ] T068 [US6] Add "Cancel" button to `OperationCard` and `OperationDetail` components
- [ ] T069 [US6] Gate "Cancel" button visibility based on `useRoleCheck` hook (`CANCELLER_ROLE`) and operation status
- [ ] T070 [US6] Implement `cancel` logic in `useTimelockController` hook
- [ ] T071 [US6] Write integration test for cancelling an operation in `tests/integration/operation-cancellation.test.tsx`

## Phase 9: User Story 7 - Filter and Search Operations (P4)

- [ ] T072 [US7] Create `OperationFilters` component in `src/components/operations/OperationFilters.tsx`
- [ ] T073 [US7] Add filtering logic to `useOperations` hook (by status, proposer, target)
- [ ] T074 [US7] Add search input to `OperationsList` page and pass search term to `useOperations`
- [ ] T075 [US7] Update subgraph queries to support filtering and searching in `src/services/subgraph/queries.ts`

## Phase 10: User Story 8 - Manage Custom Network and ABI Settings (P4)

- [ ] T076 [US8] Create `page.tsx` in `src/app/settings/`
- [ ] T077 [P] [US8] Create UI for managing custom RPC endpoints
- [ ] T078 [P] [US8] Create UI for managing custom ABIs (import/export/delete)
- [ ] T079 [US8] Implement logic to store custom ABIs in `sessionStorage` or `localStorage`
- [ ] T080 [US8] Integrate custom ABIs into the `useABIResolver` hook

## Phase 11: Polish & Cross-cutting Concerns

- [ ] T081 Add responsive styles to all pages and components for mobile and tablet views
- [ ] T082 Implement loading states for all data fetching hooks and components
- [ ] T083 Implement error states and fallbacks for all data fetching and transactions
- [ ] T084 Review and enforce accessibility standards (WCAG 2.1) for all components
- [ ] T085 Add comprehensive JSDoc comments to all hooks, services, and complex components
- [ ] T086 Create `README.md` with detailed setup and deployment instructions
- [ ] T087 Final pass on linting and formatting: `npm run lint:fix` and `npm run format`
- [ ] T088 Build and test the production version: `npm run build` and `npm start`
- [ ] T089 Deploy subgraph to The Graph Studio
- [ ] T090 Deploy application to Vercel

## Dependencies

- **US2** depends on **US1**
- **US4** depends on **US1**, **US3**
- **US6** depends on **US1**
- **US7** depends on **US1**

## Parallel Execution

- **Phase 2**: T010, T011, and T012 can be worked on in parallel.
- **US1**: T024, T025, and T026 are UI components that can be developed in parallel.
- **US3**: T043 and T044 can be developed in parallel.
- **US4**: T051, T052, T056, T057, and T058 can be developed in parallel after the initial wizard component is created.
