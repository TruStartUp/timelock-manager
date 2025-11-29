# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TimelockController governance management application** for Rootstock blockchain networks. The app provides a user-friendly interface to explore operations, manage roles, execute/cancel operations, schedule proposals, and decode calldata for OpenZeppelin TimelockController contracts.

## Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode (not configured yet - add to package.json if needed)
npm run test:watch

# Lint code
npm run lint

# Format code with Prettier
npm run format
```

## Tech Stack

- **Next.js 15** (Pages Router) - React framework with SSR support
- **React 19** - UI library
- **RainbowKit 2.2+** - Wallet connection UI for Web3
- **wagmi 2.17+** - React hooks for Ethereum interactions
- **viem 2.40+** - TypeScript library for Ethereum
- **TanStack Query 5.55+** - Data fetching and state management
- **TypeScript 5.5+** - Static typing with **strict mode enabled**
- **Tailwind CSS 4+** - Utility-first CSS framework
- **Vitest** - Unit testing framework
- **@testing-library/react** - React component testing

## Architecture

### Provider Hierarchy

The application is wrapped in a specific provider hierarchy (defined in `src/pages/_app.tsx`):

```
WagmiProvider (wagmi config)
  └─ QueryClientProvider (TanStack Query)
      └─ RainbowKitProvider
          └─ Page Components
```

**Critical**: This hierarchy must be maintained when adding new providers. The order matters for proper functionality.

### Wagmi Configuration

The wagmi config is centralized in [src/wagmi.ts](src/wagmi.ts) and configured for:

- **Rootstock mainnet** (chainId: 30) as the primary chain
- **Rootstock Testnet** (chainId: 31) - conditionally enabled via `NEXT_PUBLIC_ENABLE_TESTNETS=true`
- SSR support enabled (`ssr: true`)

**Important**: Replace `YOUR_PROJECT_ID` in [src/wagmi.ts](src/wagmi.ts) with your WalletConnect project ID. Get one at https://cloud.walletconnect.com/

### Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

**Required variables**:
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - WalletConnect project ID (required for wallet connections)

**Subgraph URLs** (required for blockchain data indexing):
- `NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL` - The Graph subgraph for Rootstock mainnet
- `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL` - The Graph subgraph for Rootstock testnet

**Optional overrides**:
- `NEXT_PUBLIC_RSK_MAINNET_RPC_URL` - Custom RPC (defaults to public node)
- `NEXT_PUBLIC_RSK_TESTNET_RPC_URL` - Custom RPC (defaults to public testnet node)
- `NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL` - Blockscout API for mainnet
- `NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL` - Blockscout API for testnet
- `NEXT_PUBLIC_4BYTE_DIRECTORY_URL` - Function signature lookup service
- `NEXT_PUBLIC_ENABLE_TESTNETS` - Set to `'true'` to enable testnet chains

All public environment variables **must** be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

### Webpack Configuration

The Next.js config ([next.config.js](next.config.js)) includes custom webpack externals to exclude problematic packages:

- `pino-pretty` - Logger formatting
- `lokijs` - Database library
- `encoding` - Text encoding utilities

These are excluded to prevent bundling issues with Web3 libraries. **Do not remove** these externals unless you understand the implications.

### Module Path Aliases

The project uses TypeScript path aliases (configured in [tsconfig.json](tsconfig.json)):

- `@/*` maps to `src/*`

Example: `import { config } from '@/wagmi'` resolves to `src/wagmi.ts`

## Project Structure

```
src/
  ├─ components/
  │   ├─ common/              # Shared components (Layout)
  │   ├─ dashboard/           # Dashboard view components
  │   ├─ decoder/             # Calldata decoder view
  │   ├─ new_proposal/        # Proposal creation wizard
  │   ├─ operations_explorer/ # Operations list and details
  │   ├─ permissions/         # Role management view
  │   └─ settings/            # Settings view
  ├─ pages/
  │   ├─ _app.tsx             # App wrapper with providers (CRITICAL)
  │   ├─ index.tsx            # Dashboard (root route)
  │   ├─ decoder.tsx          # Calldata decoder page
  │   ├─ new_proposal.tsx     # New proposal page
  │   ├─ operations_explorer.tsx # Operations explorer page
  │   ├─ permissions.tsx      # Permissions page
  │   └─ settings.tsx         # Settings page
  ├─ styles/
  │   ├─ globals.css          # Global styles + Tailwind imports
  │   └─ Home.module.css      # Legacy CSS module
  └─ wagmi.ts                 # Wagmi/wallet configuration

tests/
  ├─ setup.ts                 # Vitest test setup
  └─ components/              # Component tests (mirrors src structure)

specs/
  └─ 002-rootstock-timelock/  # Current feature specification
      ├─ spec.md              # Feature specification
      ├─ plan.md              # Implementation plan
      ├─ tasks.md             # Task breakdown
      └─ quickstart.md        # Setup guide

.specify/
  ├─ memory/
  │   └─ constitution.md      # Project principles and governance
  └─ templates/               # Spec templates

subgraph/
  └─ rootstock-timelock-testnet/  # The Graph subgraph for event indexing
      ├─ schema.graphql           # GraphQL schema (entities)
      ├─ subgraph.yaml            # Subgraph manifest
      ├─ src/                     # Event handlers
      └─ abis/                    # Contract ABIs
```

**Core directories** (created during initial setup):
- `src/lib/` - Core utilities (currently contains `constants.ts`)
- `src/hooks/` - Custom React hooks (ready for implementation)
- `src/services/` - External API clients (ready for implementation)
- `src/types/` - TypeScript type definitions (`abi.ts`, `operation.ts`, `role.ts`)
- `src/app/` - Empty directory (project uses Pages Router, not App Router)

## Development Workflow

### Spec-Driven Development

This project follows a **constitution-based, spec-driven workflow**. Read [.specify/memory/constitution.md](.specify/memory/constitution.md) for binding principles.

**Workflow**:
1. **Planning**: Feature/bug specified in `specs/{branch}/spec.md` with acceptance criteria
2. **Test-First**: Tests written before implementation (Red-Green-Refactor)
3. **Implementation**: Code changes only after test approval
4. **Review**: PR requires review of tests + implementation
5. **Deploy**: Merge to main triggers automated deployment

**Breaking changes** (ABI updates, contract changes) require migration guides.

### Subgraph Development

The project includes a **Graph Protocol subgraph** for indexing TimelockController events on Rootstock networks. The subgraph provides efficient querying of historical operations, role changes, and governance events.

**Location**: `subgraph/rootstock-timelock-testnet/`

**Available commands**:
```bash
# Generate TypeScript types from GraphQL schema
npm run subgraph:codegen

# Build the subgraph
npm run subgraph:build

# Deploy to The Graph Studio (requires authentication)
npm run subgraph:deploy

# Check if Graph CLI is installed
npm run subgraph:check
```

**Key files**:
- `schema.graphql` - GraphQL schema defining entities (CallScheduled, CallExecuted, Cancelled, RoleGranted, RoleRevoked, etc.)
- `subgraph.yaml` - Subgraph manifest with data sources, event handlers, and network configuration
- `src/timelock-controller.ts` - Event handler implementations that process blockchain events
- `networks.json` - Network-specific contract addresses for deployment
- `abis/TimelockController.json` - Contract ABI for event decoding

**Indexed entities**:
- CallScheduled, CallExecuted, CallSalt, Cancelled
- RoleGranted, RoleRevoked, RoleAdminChanged
- MinDelayChange

**Prerequisites**:
- Graph CLI must be installed globally:
  ```bash
  npm install -g @graphprotocol/graph-cli
  ```
- Authenticate with The Graph Studio before deploying:
  ```bash
  graph auth --studio <deploy-key>
  ```

**Deployment workflow**:
1. Update `networks.json` with the TimelockController contract address
2. Run `npm run subgraph:codegen` to generate types
3. Run `npm run subgraph:build` to compile the subgraph
4. Run `npm run subgraph:deploy` to deploy to The Graph Studio
5. Copy the subgraph query URL to `.env.local` as `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL`

### TypeScript Strict Mode

TypeScript strict mode is **enforced**. All code must:
- Have **no implicit `any`** types
- Use explicit return types for exported functions
- Pass all strict checks

Verify types compile:
```bash
npx tsc --noEmit
```

### Testing

The project uses **Vitest** with React Testing Library.

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run tests/components/dashboard/DashboardView.test.tsx

# Run tests in watch mode
npx vitest
```

**Test structure**:
- Unit tests: Fast tests for utilities, hooks, ABIs
- Integration tests: Wallet flows, contract interactions
- Component tests: UI component behavior

Tests should mirror the `src/` directory structure in `tests/`.

### Styling

The project uses **Tailwind CSS v4**:
- Global styles in [src/styles/globals.css](src/styles/globals.css)
- Use Tailwind utility classes in JSX: `className="bg-blue-500 text-white"`
- RainbowKit styles are globally imported in [src/pages/_app.tsx](src/pages/_app.tsx)

Legacy CSS Modules exist ([Home.module.css](src/styles/Home.module.css)) but new components should use Tailwind.

## Key Implementation Details

### Adding New Pages

When adding new pages that interact with wallets or blockchain:

1. They automatically inherit the provider setup from [src/pages/_app.tsx](src/pages/_app.tsx)
2. Use wagmi hooks (e.g., `useAccount`, `useContractRead`) directly in components
3. Wallet connection state is managed globally via RainbowKit
4. Create page in `src/pages/{name}.tsx` and corresponding view component in `src/components/{name}/`

### Blockchain Interactions

All blockchain interactions should use:

- **wagmi hooks** for reading/writing contracts and account management
- **viem** for low-level utilities (ABI encoding, address validation, etc.)
- **TanStack Query** is already configured and wraps wagmi hooks automatically

**Data sources** (planned):
1. **Primary**: The Graph subgraphs for indexed TimelockController events
2. **Fallback**: Blockscout API for contract ABIs and verification
3. **Utility**: 4byte.directory for function signature lookup

### Component Architecture

Components are organized by **feature view**:
- Each major page has a directory in `src/components/`
- Example: Dashboard page uses `src/components/dashboard/DashboardView.tsx`
- Common/shared components go in `src/components/common/`

**Current views**:
- **Dashboard**: Operations overview and role summary
- **Operations Explorer**: Filterable operations table with expandable details
- **New Proposal**: Multi-step wizard for scheduling operations
- **Decoder**: Calldata decoding utility
- **Permissions**: Role holders and role grant/revoke history
- **Settings**: App configuration

### Security Principles (from Constitution)

All smart contract interactions must be:
- **Type-safe**: Use viem's type-safe abstractions
- **Error-handled**: Explicit error handling with fallback strategies
- **Validated**: Verify addresses and ABI compatibility
- **Auditable**: Log all transactions (hashes, blocks, amounts)

See [.specify/memory/constitution.md](.specify/memory/constitution.md) for full security requirements.

## Important Notes

- **Provider order matters**: Do not reorder providers in [_app.tsx](src/pages/_app.tsx)
- **Strict mode**: No implicit `any` types allowed
- **Test-first**: Tests written and approved before implementation
- **Webpack externals**: Do not remove externals from [next.config.js](next.config.js)
- **Environment variables**: Must use `NEXT_PUBLIC_` prefix for browser access
- **Pages Router**: This project uses Next.js Pages Router, not App Router

## Additional Resources

- **Project Specification**: [specs/002-rootstock-timelock/spec.md](specs/002-rootstock-timelock/spec.md)
- **Quickstart Guide**: [specs/002-rootstock-timelock/quickstart.md](specs/002-rootstock-timelock/quickstart.md)
- **Constitution**: [.specify/memory/constitution.md](.specify/memory/constitution.md)
- **Rootstock Docs**: https://dev.rootstock.io/
- **wagmi Docs**: https://wagmi.sh/
- **RainbowKit Docs**: https://rainbowkit.com/
- **The Graph Docs**: https://thegraph.com/docs/
- **OpenZeppelin TimelockController**: https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController
