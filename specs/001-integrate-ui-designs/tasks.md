# Actionable Tasks: Integrate UI Designs

**Branch**: `001-integrate-ui-designs` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This document breaks down the work required to implement the "Integrate UI Designs" feature. Tasks are organized into phases and ordered by dependency.

## Phase 1: Setup

- [x] T001 Verify project dependencies are installed by running `npm install`.
- [x] T002 Create parent directories for the new UI components in `src/components/` (`dashboard`, `decoder`, etc.).

## Phase 2: Foundational Tasks

- [x] T003 [US1] Create a shared `Layout` component in `src/components/common/Layout.tsx` to wrap the new pages, including common elements like a header or sidebar if identified from the designs.
- [x] T004 [US1] Write a unit test for the `Layout` component in `tests/components/common/Layout.test.tsx`.

## Phase 3: User Story 1 - Visual and Functional Parity

This phase involves converting each static HTML design into a functional React page. The tasks for each page/view can be executed in parallel.

### Dashboard View

- [x] T005 [P] [US1] Create the page file for the Dashboard view at `src/pages/dashboard.tsx`.
- [x] T006 [P] [US1] Implement the main `DashboardView` component in `src/components/dashboard/DashboardView.tsx` based on `ui-design-files/dashboard/code.html`.
- [x] T007 [P] [US1] Write unit tests for the `DashboardView` component in `tests/components/dashboard/DashboardView.test.tsx`.
- [x] T008 [P] [US1] Connect the `DashboardView` component to relevant data hooks and services.

### Decoder View

- [x] T009 [P] [US1] Create the page file for the Decoder view at `src/pages/decoder.tsx`.
- [x] T010 [P] [US1] Implement the main `DecoderView` component in `src/components/decoder/DecoderView.tsx` based on `ui-design-files/decoder/code.html`.
- [x] T011 [P] [US1] Write unit tests for the `DecoderView` component in `tests/components/decoder/DecoderView.test.tsx`.
- [x] T012 [P] [US1] Connect the `DecoderView` component to relevant data hooks and services.

### New Proposal View

- [x] T013 [P] [US1] Create the page file for the New Proposal view at `src/pages/new_proposal.tsx`.
- [x] T014 [P] [US1] Implement the main `NewProposalView` component in `src/components/new_proposal/NewProposalView.tsx` based on `ui-design-files/new_proposal/code.html`.
- [x] T015 [P] [US1] Write unit tests for the `NewProposalView` component in `tests/components/new_proposal/NewProposalView.test.tsx`.
- [x] T016 [P] [US1] Connect the `NewProposalView` component to relevant data hooks and services.

### Operations Explorer View

- [x] T017 [P] [US1] Create the page file for the Operations Explorer view at `src/pages/operations_explorer.tsx`.
- [x] T018 [P] [US1] Implement the main `OperationsExplorerView` component in `src/components/operations_explorer/OperationsExplorerView.tsx` based on `ui-design-files/operations_explorer/code.html`.
- [x] T019 [P] [US1] Write unit tests for the `OperationsExplorerView` component in `tests/components/operations_explorer/OperationsExplorerView.test.tsx`.
- [x] T020 [P] [US1] Connect the `OperationsExplorerView` component to relevant data hooks and services.

### Permissions View

- [x] T021 [P] [US1] Create the page file for the Permissions view at `src/pages/permissions.tsx`.
- [x] T022 [P] [US1] Implement the main `PermissionsView` component in `src/components/permissions/PermissionsView.tsx` based on `ui-design-files/permissions/code.html`.
- [x] T023 [P] [US1] Write unit tests for the `PermissionsView` component in `tests/components/permissions/PermissionsView.test.tsx`.
- [x] T024 [P] [US1] Connect the `PermissionsView` component to relevant data hooks and services.

### Settings View

- [x] T025 [P] [US1] Create the page file for the Settings view at `src/pages/settings.tsx`.
- [x] T026 [P] [US1] Implement the main `SettingsView` component in `src/components/settings/SettingsView.tsx` based on `ui-design-files/settings/code.html`.
- [x] T027 [P] [US1] Write unit tests for the `SettingsView` component in `tests/components/settings/SettingsView.test.tsx`.
- [x] T028 [P] [US1] Connect the `SettingsView` component to relevant data hooks and services.

## Phase 4: Polish & Integration

- [x] T029 [US1] Update the main application navigation to include links to all the new pages.
- [x] T030 [US1] Perform a full visual review of all new pages, comparing them against the `screen.png` files in `ui-design-files`.
- [x] T031 Run the linter (`npm run lint`) and formatter (`npm run format`) across the entire project to ensure code quality.
- [x] T032 Run all project tests (`npm run test`) to ensure no regressions were introduced.

## Dependencies & Parallel Execution

- **Dependencies**: Phase 1 tasks must be completed before Phase 2. Phase 2 must be completed before Phase 3. Phase 3 tasks for different views can be worked on in parallel. Phase 4 can begin once all Phase 3 tasks are complete.
- **Parallel Execution**: Within Phase 3, the implementation of each view (Dashboard, Decoder, etc.) is independent and can be done in parallel. Each block of tasks from T005 to T028 is a parallelizable unit.

## Implementation Strategy

The suggested MVP is to complete one of the views entirely (e.g., the Dashboard) to validate the componentization and styling approach before proceeding with the rest. However, since all views are part of the core user story, the full feature is complete only when all tasks are done.
