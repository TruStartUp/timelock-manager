# Blockscout API

Blockscout is the **primary, default data source** for Timelock Manager. With just a timelock address and a network selected, the app reads operations, roles, and events directly from the Rootstock Blockscout v2 API — no API key, no subgraph, and no other setup required.

## Why Blockscout is the Default

- **Zero setup**: works out of the box with only a timelock address + network.
- **No API key**: the public Rootstock Blockscout v2 API is open.
- **Direct from the browser**: CORS is open, so the client calls Blockscout directly. There is no Next.js proxy or server route in between.
- **Per-IP rate limit (~180/min)**: because each user's browser calls Blockscout with its own IP, the rate limit applies per user rather than to a single shared server IP.

## Endpoints

```bash
# Defaults to public Blockscout instances
NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL=https://rootstock.blockscout.com/api/v2
NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL=https://rootstock-testnet.blockscout.com/api/v2
```

## What Blockscout Provides

- **Operations**: reconstructed from raw event logs (`CallScheduled`, `CallExecuted`, `Cancelled`, etc.), with full pagination, batch reconstruction, ISO-timestamp parsing, and proposer/executor/canceller resolution.
- **Roles**: event-sourced from `RoleGranted` / `RoleRevoked` logs.
- **Contract verification status** and **verified contract ABIs**.
- **Proxy detection** for ABI resolution.
- **Transaction details**.

## Service Files

- `src/services/blockscout/logs.ts` — shared HTTP, pagination, and parsing helpers for log fetching.
- `src/services/blockscout/roles.ts` — event-sourced roles derived from `RoleGranted` / `RoleRevoked` logs.
- `src/services/blockscout/events.ts` — reconstructs operations from raw logs (full pagination, batch reconstruction, ISO-timestamp parsing, proposer/executor/canceller resolution).
- `src/services/blockscout/abi.ts` — ABI resolution with proxy detection.
- `src/services/blockscout/client.ts` — Blockscout v2 API client with caching.

## Limitations

- Slower than an indexed subgraph for very large or very active timelocks.
- No complex GraphQL-style aggregations; data is reconstructed client-side from logs.

For most timelocks this is more than fast enough. If you operate a very active timelock and want faster indexed queries, you can optionally deploy a subgraph — see [The Graph Integration](the-graph-integration.md).
