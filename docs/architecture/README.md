# Architecture

Technical architecture documentation for Timelock Manager, including data flow, design patterns, and implementation details.

## Overview

Timelock Manager is built with a modern, resilient architecture that prioritizes:
- **Performance**: Fast queries with intelligent caching
- **Reliability**: Dual data sources with automatic fallback
- **User Experience**: Optimistic updates and real-time synchronization
- **Security**: Role-based access control and transaction simulation
- **Extensibility**: Modular design for easy customization

## Architecture Guides

### Core Architecture
1. [Data Flow](data-flow.md) - How data moves through the application
2. [Dual Data Sources](dual-data-sources.md) - Subgraph + Blockscout fallback strategy
3. [Caching Strategy](caching-strategy.md) - Multi-layer caching and invalidation

### Key Features
4. [Timelock Configuration](timelock-configuration.md) - Multi-timelock management system
5. [Recursive Decoder](recursive-decoder.md) - Calldata decoding architecture
6. [Operation Status Logic](operation-status.md) - Status calculation and transitions
7. [Role-Based Access Control](role-based-access.md) - Permission system implementation

### Integration Patterns
8. [ABI Resolution Hierarchy](abi-resolution.md) - Multi-source ABI resolution
9. [Proxy Contract Detection](proxy-detection.md) - Automatic proxy detection and resolution

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          Browser                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              React Application                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │  Pages   │  │Components│  │  Hooks   │           │  │
│  │  └────┬─────┘  └─────┬────┘  └────┬─────┘           │  │
│  │       │              │             │                 │  │
│  │  ┌────▼──────────────▼─────────────▼─────┐           │  │
│  │  │      TanStack Query (Cache)           │           │  │
│  │  └────┬──────────────┬─────────────┬─────┘           │  │
│  │       │              │             │                 │  │
│  │  ┌────▼────┐    ┌────▼────┐  ┌────▼────┐            │  │
│  │  │Subgraph │    │Blockscout│  │  wagmi  │            │  │
│  │  │Services │    │Services  │  │Blockchain│            │  │
│  │  └────┬────┘    └────┬────┘  └────┬────┘            │  │
│  └───────┼──────────────┼────────────┼─────────────────┘  │
└──────────┼──────────────┼────────────┼────────────────────┘
           │              │            │
           ▼              ▼            ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ The Graph  │ │ Blockscout │ │  Rootstock │
    │ Subgraph   │ │    API     │ │    RPC     │
    └────────────┘ └────────────┘ └────────────┘
```

## Key Architectural Patterns

### 1. Dual Data Source Pattern
**Problem**: The Graph subgraphs can be unavailable during deployment or issues

**Solution**: Automatic fallback to Blockscout API for fetching raw events

**Benefits**:
- High availability
- Graceful degradation
- Transparent to users

See: [Dual Data Sources](dual-data-sources.md)

### 2. Service Layer Pattern
**Problem**: Direct API calls in components create tight coupling

**Solution**: Separate service layer (`src/services/`) for all external calls

**Benefits**:
- Testable business logic
- Reusable across components
- Easier to mock for testing

### 3. Custom Hook Pattern
**Problem**: Complex data fetching logic repeated across components

**Solution**: React hooks wrapping TanStack Query with domain logic

**Benefits**:
- Declarative data fetching
- Automatic caching and refetching
- Consistent error handling

### 4. Context Provider Pattern
**Problem**: Configuration needs to be shared across the app

**Solution**: React Context for timelock configuration and settings

**Benefits**:
- Centralized state management
- Persistent configuration (localStorage)
- Type-safe access

### 5. Optimistic UI Pattern
**Problem**: Blockchain transactions take time to confirm

**Solution**: Optimistic cache updates with rollback on failure

**Benefits**:
- Immediate user feedback
- Better perceived performance
- Graceful error recovery

## Data Flow

### Reading Operations

```
User clicks "Operations Explorer"
    │
    ▼
useOperations hook
    │
    ▼
TanStack Query checks cache
    │
    ├─ Hit: Return cached data
    │
    └─ Miss:
        │
        ▼
    fetchOperations service
        │
        ▼
    Check subgraph availability
        │
        ├─ Available: Query GraphQL
        │
        └─ Unavailable: Fetch from Blockscout
            │
            ▼
        Return normalized operations
            │
            ▼
        TanStack Query caches result
            │
            ▼
        Component renders with data
```

### Writing Operations (Scheduling)

```
User submits proposal
    │
    ▼
Form validation
    │
    ▼
useTimelockWrite hook
    │
    ▼
Transaction simulation (eth_call)
    │
    ▼
User confirms in wallet
    │
    ▼
Transaction submitted
    │
    ▼
Optimistic cache update
    │
    ▼
Wait for confirmation
    │
    ├─ Success: Keep optimistic update
    │
    └─ Failure: Rollback and show error
```

## Technology Stack

### Frontend
- **Next.js 14**: React framework with Pages Router
- **TypeScript**: Type safety and developer experience
- **Tailwind CSS**: Utility-first styling
- **React Hook Form**: Form state management

### Web3
- **wagmi**: React hooks for Ethereum
- **viem**: TypeScript Ethereum library
- **RainbowKit**: Wallet connection UI

### Data Layer
- **TanStack Query**: Data fetching, caching, synchronization
- **The Graph**: Primary data source (subgraphs)
- **Blockscout**: Fallback data source and ABI resolution

### State Management
- **React Context**: Global configuration
- **localStorage**: Persistent settings
- **sessionStorage**: Temporary caching

### Testing
- **Vitest**: Unit and integration tests
- **React Testing Library**: Component testing

## Design Principles

### 1. Progressive Enhancement
- Core functionality works without JavaScript
- Enhanced experience with client-side features
- Graceful degradation when services unavailable

### 2. Separation of Concerns
- UI components focused on presentation
- Business logic in hooks and services
- State management separate from rendering

### 3. Performance First
- Intelligent caching at multiple layers
- Lazy loading of heavy components
- Virtualized lists for large datasets
- Minimal bundle size

### 4. Security by Default
- Role checks before showing actions
- Transaction simulation before submission
- ABI verification and confidence levels
- High-risk operation warnings

### 5. Developer Experience
- TypeScript for type safety
- Consistent code style with ESLint/Prettier
- Comprehensive error messages
- Well-documented APIs

## Code Organization

```
src/
├── components/       # React components
│   ├── common/       # Shared components (Layout, etc.)
│   ├── dashboard/    # Dashboard-specific components
│   ├── operations_explorer/
│   ├── new_proposal/
│   ├── decoder/
│   ├── permissions/
│   └── settings/
├── context/          # React contexts
├── hooks/            # Custom React hooks
├── lib/              # Utility libraries
├── pages/            # Next.js pages
│   ├── api/          # API routes
│   └── *.tsx         # Page components
├── services/         # External service clients
│   ├── subgraph/     # The Graph integration
│   ├── blockscout/   # Blockscout API client
│   └── fourbyte/     # 4byte directory client
├── types/            # TypeScript type definitions
└── wagmi.ts          # wagmi configuration
```

## Extension Points

### Adding a New Data Source

1. Create service in `src/services/new-source/`
2. Implement client with rate limiting
3. Add caching strategy
4. Create hooks in `src/hooks/`
5. Update fallback logic in existing services

### Adding a New Page

1. Create page in `src/pages/`
2. Create components in `src/components/page-name/`
3. Add navigation in `Layout.tsx`
4. Create hooks if needed
5. Update tests

### Adding a New Integration

1. Create client in `src/services/`
2. Add environment variables
3. Implement caching
4. Create hooks for components
5. Document in integrations guide

## Performance Characteristics

### Initial Page Load
- **Time to Interactive**: <2s on fast 3G
- **Bundle Size**: <300KB gzipped
- **Critical CSS**: Inlined for above-the-fold

### Data Fetching
- **Operations List**: <200ms (cached), <1s (fresh)
- **Role Queries**: <100ms (cached), <500ms (fresh)
- **ABI Resolution**: <500ms (Blockscout), instant (cached)

### Caching Layers
1. **TanStack Query**: 30s-5min depending on data type
2. **localStorage**: 24h for ABIs
3. **sessionStorage**: Session duration for manual ABIs
4. **Browser HTTP cache**: Per service headers

## Related Documentation

- **Developer Guide**: [Developer Guide](../developer-guide/README.md)
- **Integrations**: [Integrations](../integrations/README.md)
- **Reference**: [GraphQL Schema](../reference/graphql-schema.md)

---

**Explore architecture**: [Data Flow](data-flow.md) | [Dual Data Sources](dual-data-sources.md) | [Recursive Decoder](recursive-decoder.md)
