---
hidden: true
---

# What is The Graph?

{% hint style="success" %}
Deploying a subgraph is **optional**. Timelock Manager is Blockscout-first and works with zero setup. A subgraph is only worth deploying for very active timelocks that want faster indexed queries.
{% endhint %}

The Graph is a decentralized protocol for indexing and querying blockchain data. A **subgraph** defines which contract events to index and how to organize them into a queryable GraphQL API.

{% hint style="danger" %}
**Do NOT run `graph init`.** Timelock Manager queries a custom aggregated schema (entities `Operation`, `Call`, `Role`, `RoleAssignment`). `graph init` only scaffolds raw per-event entities (`CallScheduled`, `RoleGranted`, …) with no aggregation, so the app reads no data and the timelock appears empty. Deploy from the repo templates in `subgraph/rootstock-timelock-testnet` and `subgraph/rootstock-timelock-mainnet` instead.
{% endhint %}

