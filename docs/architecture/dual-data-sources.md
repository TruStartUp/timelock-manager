---
hidden: true
---

# Dual Data Sources

Timelock Manager reads indexed data from two interchangeable sources. **Blockscout is the default**; a subgraph is an **optional accelerator**.

## Blockscout (default)

The app works with zero setup beyond a timelock address and a network. It reads operations, roles, and events directly from the Rootstock Blockscout v2 API, straight from the browser:

- **No API key, CORS open** — calls go from the user's browser to Blockscout.
- **Per-user rate budget** — each browser uses its own per-IP limit (~180 requests/min). There is no shared backend proxy; routing all users through one server IP would hit the limit immediately.
- **Event-sourced reconstruction** — operations are rebuilt from raw logs with full pagination, batch reconstruction, ISO-timestamp parsing, and proposer/executor/canceller resolution.

Relevant services:

- `src/services/blockscout/logs.ts` — shared HTTP, pagination, and parse helpers.
- `src/services/blockscout/events.ts` — reconstructs operations from logs.
- `src/services/blockscout/roles.ts` — event-sourced roles from `RoleGranted` / `RoleRevoked` logs.

## Subgraph (optional advanced)

A timelock configuration may optionally include a `subgraphUrl`. When set, the app queries The Graph instead of Blockscout — useful for very active timelocks that want faster indexed queries. When the field is empty, the app uses Blockscout — the default. The `TimelockSelector` shows a **Blockscout** vs **Subgraph** data-source badge so users know which source is active.

If used, the subgraph **must** use this repo's custom aggregated schema (entities: `Operation`, `Call`, `Role`, `RoleAssignment`). A subgraph scaffolded with `graph init` produces only raw per-event entities (`CallScheduled`, `RoleGranted`, …) and is **incompatible** — the app's queries return nothing.

Relevant services:

- `src/services/subgraph/operations.ts` — operation queries.
- `src/services/subgraph/roles.ts` — role grant queries.

## Source selection

```
fetchOperations
    │
    ▼
Subgraph URL configured?
    │
    ├─ No (default): Blockscout v2 API
    │
    └─ Yes: GraphQL subgraph (custom aggregated schema)
```

