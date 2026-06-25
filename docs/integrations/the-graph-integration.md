# The Graph Integration

The Graph (a subgraph) is an **optional, advanced** data source for Timelock Manager. It is **not** required: by default the app reads operations, roles, and events directly from Blockscout (see [Blockscout API](blockscout-api.md)). When a timelock configuration has no `subgraphUrl`, the app uses Blockscout.

A subgraph is worth deploying only for **very active timelocks** that want faster indexed GraphQL queries instead of reconstructing data from raw logs.

## When to Use a Subgraph

- You operate a high-volume timelock with many operations and roles.
- You want faster, indexed queries and richer filtering than client-side log reconstruction provides.

If neither applies, you can skip this entirely — Blockscout covers operations, roles, and events with zero setup.

## Configuration

```bash
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
```

A timelock with no subgraph URL falls back to Blockscout automatically.

## Required: Custom Aggregated Schema

If you deploy a subgraph, it **must** use this repository's custom aggregated schema. The schema defines high-level, aggregated entities that the app queries directly:

- `Operation`
- `Call`
- `Role`
- `RoleAssignment`

> **Incompatible with `graph init`**: A subgraph scaffolded with `graph init` produces only raw, per-event entities (one entity per emitted event). That shape is **incompatible** with Timelock Manager. Use the aggregated schema from this repo (`subgraph/rootstock-timelock-testnet/` and `subgraph/rootstock-timelock-mainnet/`) so the entities match what the app expects.

## Features

- GraphQL queries against aggregated entities
- Indexed operations and roles
- Faster queries and richer filtering for high-volume timelocks

## Limitations

- Requires deploying and maintaining a subgraph.
- Sync lag on initial deploy.
- May be unavailable during indexing or Studio issues — in which case configure the timelock without a subgraph URL to use Blockscout.

See also: [Blockscout API](blockscout-api.md) (the default data source).
