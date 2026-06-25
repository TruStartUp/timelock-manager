---
hidden: true
---

# Data Flow

## Reading operations

```
User opens Operations Explorer
    │
    ▼
useOperations hook
    │
    ▼
TanStack Query checks cache (staleTime 60s)
    │
    ├─ Fresh: return cached data
    │
    └─ Stale / miss:
        │
        ▼
    fetchOperations service
        │
        ▼
    Subgraph URL configured?
        │
        ├─ No (default): Blockscout v2 API (events reconstructed from logs)
        │
        └─ Yes: GraphQL subgraph
            │
            ▼
        Return normalized operations
            │
            ▼
        TanStack Query caches result
            │
            ▼
        Component renders
```

By default the browser reads directly from the Rootstock Blockscout v2 API (no backend proxy). A configured subgraph is an optional accelerator. Queries auto-refetch every 120s; a manual **Refresh** button forces an immediate update. See [Dual Data Sources](dual-data-sources.md) and [Caching Strategy](caching-strategy.md).

## Writing operations (scheduling)

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
    ├─ Success: keep optimistic update
    │
    └─ Failure: rollback and show error
```

