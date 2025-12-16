# Implementation Plan: Support Multiple Timelocks

**Branch**: `001-support-multiple-timelocks` | **Date**: 2025-12-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-support-multiple-timelocks/spec.md`

## Summary

This plan outlines the implementation of multi-timelock support. The core requirement is to allow users to manage a list of timelock contracts and switch between them. The technical approach is entirely client-side, storing user-managed configurations in `localStorage`. A new React Context will provide the global state for the selected timelock, which will be chosen via a dropdown in the application header.

## Technical Context

**Language/Version**: TypeScript 5+
**Primary Dependencies**: Next.js 15+, React 19+, wagmi, RainbowKit, TanStack Query, Tailwind CSS
**Storage**: Browser `localStorage` for timelock configurations.
**Testing**: Vitest, @testing-library/react
**Target Platform**: Web Browsers
**Project Type**: Web application (Next.js)
**Performance Goals**: Page interactions (switching timelocks) should feel instantaneous (<5 seconds for all data to refresh).
**Constraints**: The solution must be purely client-side as per the specification. The user's configuration list will not be synced across different browsers or devices.
**Scale/Scope**: The system should handle a user managing up to 20 personal timelock configurations without UI lag.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **✅ Principle I (Security)**: **Pass with note.** Storing contract addresses in `localStorage` introduces a theoretical XSS risk where a malicious script could alter the address. **Mitigation**: The UI MUST always display the full, non-truncated address of the currently selected timelock contract to ensure transparency.
- **✅ Principle II (UX)**: **Pass with note.** Using `localStorage` means configurations are not synced across devices. This is a user-accepted trade-off for simplicity, but it's a deviation from an ideal, cloud-synced experience.
- **✅ Principle III (Type Safety)**: **Pass.** The plan mandates runtime validation (e.g., with `zod`) of data retrieved from `localStorage` to ensure it matches the `TimelockConfiguration[]` type, preventing `any` type propagation.
- **✅ Technology Stack**: **Pass.** The plan uses React Context, which is part of the core React framework, and introduces no new dependencies that would violate the constitution.

All checks pass. The noted points are accepted trade-offs or have defined mitigations.

## Project Structure

### Documentation (this feature)

```text
specs/001-support-multiple-timelocks/
├── plan.md              # This file
├── research.md          # Phase 0 output, details state management and storage schema
├── data-model.md        # Phase 1 output, formalizes the TimelockConfiguration structure
├── quickstart.md        # Phase 1 output, dev guide for using the new feature
├── contracts/           # Phase 1 output (will be empty as no backend contracts)
└── tasks.md             # Phase 2 output (to be created by /speckit.tasks)
```

### Source Code (repository root)

The project follows a feature-based structure within `src/`. This feature will add a new context, modify the main layout, and add a new settings component.

```text
src/
├── components/
│   ├── common/
│   │   └── Layout.tsx             # MODIFIED: To include TimelockSelector
│   ├── timelock/
│   │   ├── TimelockSelector.tsx   # NEW: Dropdown for switching timelocks
│   │   └── TimelockSettings.tsx   # NEW: Component/modal for managing configs
│   └── ...
├── context/
│   └── TimelockContext.tsx        # NEW: Manages timelock configurations and selection
├── hooks/
│   └── useTimelocks.ts            # NEW: Custom hook to interact with TimelockContext
├── types/
│   └── timelock.ts                # NEW or MODIFIED: To include TimelockConfiguration type
└── ...
```

**Structure Decision**: The existing source structure is sound. The new feature will be implemented by adding a new context for state management, creating new components for the UI, and a hook for accessing the state, logically grouping them by function.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| Storing config in `localStorage` instead of a backend. | The user explicitly chose this option for simplicity and to keep the feature client-only. | A backend with a database was rejected because it would require significant new infrastructure (API, database, authentication) that is out of scope for the immediate need. |