---
hidden: true
---

# Caching Strategy

## Query freshness and polling

Because the browser calls Blockscout directly under a per-IP rate budget, polling is deliberately conservative — there is **no per-block query invalidation**. Operations and status queries use:

- `staleTime`: 60s
- `refetchInterval`: 120s
- `refetchOnWindowFocus`: false

A manual **Refresh** button in the Operations Explorer lets users force an immediate refetch when they need the latest state.

## Caching layers

1. **TanStack Query** — in-memory cache with the freshness settings above.
2. **localStorage** — ABIs cached for 24h.
3. **sessionStorage** — manual ABIs for the session.
4. **Browser HTTP cache** — per service response headers.

Cache keys include the active timelock's `subgraphUrl` (empty for Blockscout) so switching timelocks or data sources invalidates correctly.

