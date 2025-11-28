# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The development server runs on http://localhost:3000 by default.

## Tech Stack

This is a Web3 wallet integration application built with:

- **Next.js 15** (Pages Router) - React framework with SSR support
- **RainbowKit** - Wallet connection UI for Web3
- **wagmi** - React hooks for Ethereum interactions
- **viem** - TypeScript library for Ethereum
- **TanStack Query** (React Query) - Data fetching and state management
- **TypeScript** - Static typing with strict mode enabled

## Architecture

### Provider Hierarchy

The application is wrapped in a specific provider hierarchy (defined in `src/pages/_app.tsx`):

```
WagmiProvider (wagmi config)
  └─ QueryClientProvider (TanStack Query)
      └─ RainbowKitProvider
          └─ Page Components
```

This hierarchy must be maintained when adding new providers. The order matters for proper functionality.

### Wagmi Configuration

The wagmi config is centralized in `src/wagmi.ts` and configured for:
- **Rootstock** mainnet as the primary chain
- **Rootstock Testnet** (conditionally enabled via `NEXT_PUBLIC_ENABLE_TESTNETS=true`)
- SSR support enabled (`ssr: true`)

**Important**: The `projectId` in `src/wagmi.ts` needs to be replaced with a valid WalletConnect project ID for production use.

### Environment Variables

- `.env.local` - Local environment configuration (gitignored)
- `NEXT_PUBLIC_ENABLE_TESTNETS` - Set to `'true'` to enable testnet chains

All public environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

### Webpack Configuration

The Next.js config (`next.config.js`) includes custom webpack externals to exclude problematic packages:
- `pino-pretty` - Logger formatting
- `lokijs` - Database library
- `encoding` - Text encoding utilities

These are excluded to prevent bundling issues with Web3 libraries. Do not remove these externals unless you understand the implications.

## Project Structure

```
src/
  ├─ pages/
  │   ├─ _app.tsx       # App wrapper with providers
  │   └─ index.tsx      # Home page
  ├─ styles/
  │   ├─ globals.css    # Global styles
  │   └─ Home.module.css # Component-specific styles
  └─ wagmi.ts           # Wagmi/wallet configuration
```

## Key Implementation Details

### Adding New Pages

When adding new pages that interact with wallets or blockchain:
1. They automatically inherit the provider setup from `_app.tsx`
2. Use wagmi hooks (e.g., `useAccount`, `useContractRead`) directly in components
3. Wallet connection state is managed globally via RainbowKit

### Blockchain Interactions

All blockchain interactions should use:
- **wagmi hooks** for reading/writing contracts and account management
- **viem** for low-level utilities (ABI encoding, address validation, etc.)
- **TanStack Query** is already configured and wraps wagmi hooks automatically

### Styling Approach

The project uses CSS Modules for component-specific styles. When adding styles:
- Create `.module.css` files for component-scoped styles
- Import styles: `import styles from './Component.module.css'`
- Use className: `className={styles.className}`
- RainbowKit styles are globally imported in `_app.tsx`

## Active Technologies
- TypeScript 5.5+ (strict mode enabled) + Next.js 15+, React 19+, wagmi 2.17+, viem 2.40+, RainbowKit 2.2+, TanStack Query 5.55+ (001-rootstock-timelock)
- SessionStorage (ABI cache), The Graph subgraphs (indexed blockchain data), Blockscout API (fallback) (001-rootstock-timelock)

## Recent Changes
- 001-rootstock-timelock: Added TypeScript 5.5+ (strict mode enabled) + Next.js 15+, React 19+, wagmi 2.17+, viem 2.40+, RainbowKit 2.2+, TanStack Query 5.55+
