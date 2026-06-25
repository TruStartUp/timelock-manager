---
hidden: true
---

# Preparing for Deployment

{% hint style="success" %}
A subgraph is **optional** — Timelock Manager uses Blockscout by default and works with no subgraph at all. Only deploy one if you have a very active timelock that would benefit from faster indexed queries.
{% endhint %}

{% hint style="danger" %}
Always start from the repo templates in `subgraph/rootstock-timelock-testnet` and `subgraph/rootstock-timelock-mainnet`. **Do not run `graph init`** — it produces only raw per-event entities and omits the aggregated `Operation`/`Call`/`Role`/`RoleAssignment` schema the app requires, which makes the timelock appear empty.
{% endhint %}

Before deploying, gather:

- **TimelockController address** for your network.
- **Deployment block number** (`startBlock`) — find it on Blockscout from the contract's creation transaction.
- **The Graph Studio deploy key** and subgraph **slug**.

Then set the address and `startBlock` in **both** `networks.json` and `subgraph.yaml` (they must match). The in-app **/subgraph/deploy** helper can do this injection for you and produce a ready-to-deploy package.

