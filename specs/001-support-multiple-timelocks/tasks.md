# Tasks: Support Multiple Timelocks

**Input**: Design documents from `/specs/001-support-multiple-timelocks/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new dependencies required for the feature.

- [ ] T001 Install `zod` for runtime type validation of `localStorage` data (`npm install zod`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the core context and hooks for managing timelock state. This infrastructure is required by both user stories.

- [ ] T002 [P] Define the `TimelockConfiguration` and related types in `src/types/timelock.ts`
- [ ] T003 [P] Create the `zod` schema for `TimelockConfiguration` validation in `src/lib/validation.ts`
- [ ] T004 Create the `TimelockContext` to manage state in `src/context/TimelockContext.tsx`
- [ ] T005 Implement the `TimelockProvider` in `src/context/TimelockContext.tsx`, including logic to load configurations from `localStorage` and validate them using the `zod` schema.
- [ ] T006 Create the `useTimelocks` custom hook in `src/hooks/useTimelocks.ts` to expose context values (`configurations`, `selected`, `addConfig`, `removeConfig`, `select`).
- [ ] T007 Integrate `TimelockProvider` into the application's component tree, likely in `src/pages/_app.tsx` or `src/components/common/Providers.tsx`.

---

## Phase 3: User Story 1 - Select Active Timelock (Priority: P1) 🎯 MVP

**Goal**: Allow a user to select an active timelock from a dropdown, and have the application's data views update accordingly.

**Independent Test**: A user can add a timelock configuration, select it from a new dropdown in the header, and see the dashboard reflect the data for that selected timelock.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Create the `TimelockSelector` UI component in `src/components/timelock/TimelockSelector.tsx`. It should use the `useTimelocks` hook to display configurations and allow selection.
- [ ] T009 [US1] Integrate the `TimelockSelector` component into the main application header in `src/components/common/Layout.tsx`.
- [ ] T010 [US1] Refactor `useNetworkConfig` hook in `src/hooks/useNetworkConfig.ts` to source the current `timelockAddress` and `subgraphUrl` from the `useTimelocks` hook's `selected` value, instead of environment variables. This is a critical step to make the app dynamic.
- [ ] T011 [US1] Verify that all data-fetching hooks (e.g., `useOperations`, `useRoles`) correctly use the dynamically provided configuration from the refactored `useNetworkConfig`.

---

## Phase 4: User Story 2 - Manage Timelock Configurations (Priority: P2)

**Goal**: Provide a UI for users to add, view, and remove their personal timelock configurations stored in `localStorage`.

**Independent Test**: A user can navigate to the settings area, add a new timelock configuration via a form, see it appear in a list, and then remove it. The changes should be reflected in the `TimelockSelector` dropdown.

### Implementation for User Story 2

- [ ] T012 [P] [US2] Create the `TimelockSettings` UI component in `src/components/timelock/TimelockSettings.tsx`.
- [ ] T013 [US2] Inside `TimelockSettings.tsx`, implement a form (using `react-hook-form`) for adding a new `TimelockConfiguration`. The form should use the `addConfig` function from the `useTimelocks` hook.
- [ ] T014 [US2] Inside `TimelockSettings.tsx`, implement a list view of all current `configurations`, with a "Remove" button for each that calls the `removeConfig` function from the `useTimelocks` hook.
- [ ] T015 [US2] Add the `TimelockSettings` component to the Settings page at `src/pages/settings.tsx`.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements for usability and robustness.

- [ ] T016 [P] Implement a user-friendly empty state in `TimelockSelector.tsx` and the main dashboard that guides the user to the settings page if no timelocks are configured.
- [ ] T017 [P] Add robust error handling in `TimelockContext.tsx` for `localStorage` access errors (e.g., in private browsing mode) or JSON parsing/validation failures.
- [ ] T018 [US1] [US2] Ensure all new UI components are responsive and adhere to the project's styling conventions.
- [ ] T019 Run `quickstart.md` validation to ensure the implemented solution matches the developer documentation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks all user stories.
- **User Stories (Phase 3 & 4)**: Depend on Foundational phase completion.
- **Polish (Phase 5)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2).
- **User Story 2 (P2)**: Depends on Foundational (Phase 2). It can be developed in parallel with User Story 1.

## Implementation Strategy

### MVP First (User Story 1 Only)

1.  Complete Phase 1: Setup (`zod` installation).
2.  Complete Phase 2: Foundational (Context and Hook).
3.  Complete Phase 3: User Story 1 (Selector and refactoring).
4.  **STOP and VALIDATE**: At this point, the core feature of switching between hardcoded or manually-added `localStorage` configs works.

### Incremental Delivery

1.  Complete Setup + Foundational.
2.  Add User Story 1 -> MVP is testable.
3.  Add User Story 2 -> Configuration management is added.
4.  Complete Polish phase for final robustness.
