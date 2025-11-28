<!-- SYNC IMPACT REPORT
Version Change: (initial) → 1.0.0
Modified Principles: N/A (initial constitution)
Added Sections: Core Principles (3), Technology Stack, Development Workflow, Governance
Removed Sections: None
Templates Updated: ✅ All updated for consistency
Follow-up TODOs: None
-->

# Timelock Manager Constitution

A living document defining core principles, technology choices, and governance for the timelock-manager Web3/DeFi application.

## Core Principles

### I. Secure Smart Contract Interaction

All interactions with smart contracts and blockchain state MUST be safe, predictable, and auditable. Security is non-negotiable in Web3 applications.

- Prefer viem's type-safe abstractions over raw JSON-RPC calls
- All contract calls MUST include explicit error handling with fallback strategies
- Validate contract addresses and ABI compatibility before deployment
- Log all blockchain interactions (transaction hashes, block numbers, amounts) for auditability
- Implement timelock-specific validation: verify lock duration, beneficiary address, and release conditions are correctly specified

### II. User Experience Through Wallet Integration

Users interact with blockchain exclusively through RainbowKit wallet connections. The application MUST prioritize wallet state visibility and clear transaction feedback.

- RainbowKit connection state MUST always be visible and status-clear (connected/disconnected/error)
- All transactions MUST provide real-time feedback: pending → confirmed with block confirmation count
- Error messages MUST explain blockchain reasons (insufficient gas, contract revert, network failure)
- Support chain switching seamlessly; prevent state desynchronization across networks
- JSON format for API responses; human-readable UI for end users

### III. Type Safety and Testability

TypeScript strict mode MUST be enabled. All contract interactions, state management, and utilities MUST have comprehensive test coverage before merging.

- 100% type coverage: no implicit `any` types allowed (TypeScript strict mode enforced)
- Unit tests for utility functions, hooks, and contract ABIs (Vitest or Jest)
- Integration tests for wallet connection flows, contract interaction sequences, and multi-step timelock operations
- Contract mock ABIs and test fixtures to simulate different blockchain states (locked, unlocked, error conditions)
- Red-Green-Refactor cycle: tests written → approved → test runs and fails → implement

## Technology Stack Requirements

The following stack choices are binding and enforce consistency:

- **Framework**: Next.js 15+ (React 19+) with App Router
- **Blockchain Interaction**: viem 2.40+ (type-safe successor to ethers.js)
- **Wallet Management**: RainbowKit 2.2+, wagmi 2.17+, TanStack Query 5.55+
- **Language**: TypeScript 5.5+ (strict mode, no `any` without justification)
- **Styling**: CSS Modules or Tailwind CSS (consistent with Next.js conventions)
- **Testing**: Vitest or Jest + @testing-library/react (for component and integration tests)
- **Deployment**: Vercel (primary) or compatible Next.js hosting (docker-compatible)

No alternative libraries for wallet connection or blockchain interaction without explicit constitution amendment.

## Development Workflow

All work MUST follow this workflow to maintain quality and traceability:

1. **Planning Phase**: Feature/bug specified in `.specify/spec.md` with acceptance criteria
2. **Test-First**: Tests written in feature branch; submitted for review before implementation
3. **Implementation**: Code changes ONLY after test approval; must pass all tests
4. **Code Review**: PR requires review of tests + implementation + contract ABIs (if modified)
5. **Deployment**: Merge to main triggers automated build/test/deploy to staging, then manual promotion to production
6. **Blockchain Verification**: Contract addresses and ABI versions MUST match deployed chain state before release

Breaking changes (ABI updates, network contract changes, timelock parameter changes) MUST include migration guide and user notification.

## Governance

This constitution supersedes all other practices and policies. Amendments require:

1. **Proposal**: Create PR with amended constitution in `.specify/memory/constitution.md`
2. **Justification**: Document rationale for each principle change (breaking change? new lesson learned? tech debt?)
3. **Impact Analysis**: List affected files, templates, and required migration steps
4. **Approval**: At least one maintainer approval + verification that dependent templates (spec, plan, tasks) align with changes
5. **Migration**: Update `.specify/templates/` and runtime guidance docs; add migration notes to PR description
6. **Versioning**: Bump constitution version using semantic versioning (MAJOR for principle removal/redefinition, MINOR for additions, PATCH for clarifications)

All PRs/reviews MUST verify compliance with this constitution. Deviations require explicit justification documented in PR comments.

**Version**: 1.0.0 | **Ratified**: 2025-11-28 | **Last Amended**: 2025-11-28
