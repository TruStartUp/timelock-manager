---
hidden: true
---

# Troubleshooting Subgraphs

{% hint style="info" %}
A subgraph is optional. If a subgraph is misbehaving, removing its **Query URL** (`subgraphUrl`) from the timelock's config immediately falls the app back to Blockscout — a quick workaround while you debug.
{% endhint %}

{% hint style="danger" %}
**#1 cause of an empty/broken timelock when a subgraph is configured: wrong schema from `graph init`.** The app queries aggregated entities (`Operation`, `Call`, `Role`, `RoleAssignment`). A subgraph created with `graph init` only has raw per-event entities (`CallScheduled`, `RoleGranted`, …), so the app's queries return nothing even though the subgraph syncs fine. Fix: redeploy from the repo templates in `subgraph/rootstock-timelock-testnet` / `subgraph/rootstock-timelock-mainnet` (or use the in-app **/subgraph/deploy** helper), which ship the correct schema.
{% endhint %}

For full troubleshooting steps, see [Subgraph Issues](../troubleshooting/subgraph-issues.md).

