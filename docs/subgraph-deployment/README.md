# Subgraph Deployment

Complete guide to deploying The Graph subgraphs for indexing TimelockController operations on Rootstock networks.

{% hint style="success" %}
**A subgraph is optional.** Timelock Manager is Blockscout-first and works with zero setup using the Blockscout API as the default data source. Deploying a subgraph is only worth it for very active timelocks that want faster indexed queries.
{% endhint %}

{% hint style="danger" %}
**Do NOT run `graph init`.** The app queries a custom aggregated schema (entities `Operation`, `Call`, `Role`, `RoleAssignment`). A subgraph scaffolded with `graph init` produces only raw per-event entities (`CallScheduled`, `RoleGranted`, `CallExecuted`, `Cancelled`, …) with no `Operation`/`Role` aggregation, so the app's GraphQL queries return nothing and the timelock appears broken/empty. Always deploy from the repo templates in `subgraph/rootstock-timelock-testnet` and `subgraph/rootstock-timelock-mainnet`, which ship the correct schema.
{% endhint %}

## Why Subgraphs?

The Graph subgraphs index blockchain events into a queryable GraphQL API. For very active timelocks this can improve performance over the default Blockscout data source by enabling:

- **Fast queries**: Milliseconds instead of scanning thousands of blocks
- **Complex filtering**: Query by status, proposer, target, date range, etc.
- **Aggregated data**: Pre-computed statistics and relationships
- **Real-time updates**: Automatic indexing as new blocks arrive

{% hint style="info" %}
Timelock Manager uses Blockscout by default and only uses a subgraph when you configure a Query URL for the timelock. Leaving the subgraph URL empty keeps the app on Blockscout.
{% endhint %}

## What You'll Learn

- Understand The Graph protocol and subgraphs
- Configure subgraph for your TimelockController contract
- Deploy to testnet and mainnet
- Verify deployment and monitor indexing
- Troubleshoot common subgraph issues

## Prerequisites

### Required
- **TimelockController** deployed on Rootstock (mainnet or testnet)
- **Deployment block number**: Block where your TimelockController was deployed
- **The Graph Studio account**: Free at [thegraph.com/studio](https://thegraph.com/studio/)
- **Node.js and npm**: For running Graph CLI

### Recommended Knowledge
- Basic understanding of GraphQL
- Familiarity with blockchain events and logs
- Experience with command-line tools

## Deployment Overview

```
┌──────────────────────┐
│  Create Studio       │
│  Subgraph            │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Configure           │
│  networks.json       │
│  subgraph.yaml       │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Generate Types      │
│  (codegen)           │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Build Subgraph      │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Deploy to Studio    │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Wait for Sync       │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Test Queries        │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Configure App       │
│  with Query URL      │
└──────────────────────┘
```

## Guide Structure

1. [What is The Graph?](what-is-the-graph.md) - Introduction to The Graph protocol
2. [Preparing for Deployment](preparing-deployment.md) - Gather required information
3. [Deploying to Testnet](deploying-testnet.md) - Step-by-step testnet deployment
4. [Deploying to Mainnet](deploying-mainnet.md) - Production mainnet deployment
5. [Verifying Deployment](verifying-deployment.md) - Test and validate your subgraph
6. [Troubleshooting Subgraphs](troubleshooting-subgraph.md) - Common issues and solutions

## Quick Start

{% hint style="info" %}
Prefer the in-app helper? The **/subgraph/deploy** page (which calls `/api/subgraph/prepare`) builds a ready-to-deploy package with the correct schema and your address/startBlock already injected — no manual file edits needed.
{% endhint %}

### 1. Get Your Contract Info

```bash
# Find your TimelockController address
TIMELOCK_ADDRESS=0x...

# Find deployment block (from Blockscout or deployment transaction)
START_BLOCK=1234567
```

### 2. Configure Subgraph

```bash
cd subgraph/rootstock-timelock-testnet

# Edit networks.json
{
  "rootstock-testnet": {
    "TimelockController": {
      "address": "0x...",
      "startBlock": 1234567
    }
  }
}

# Edit subgraph.yaml (must match networks.json)
source:
  address: "0x..."
  startBlock: 1234567
```

### 3. Deploy

```bash
npm install
npm run codegen
npm run build
npx graph auth <DEPLOY_KEY>
npx graph deploy --node https://api.studio.thegraph.com/deploy/ <SLUG>
```

### 4. Configure App

Copy the **Query URL** from Studio and paste it into the timelock's configuration in the app (the `subgraphUrl` field). An empty `subgraphUrl` keeps the app on Blockscout.

## Subgraph Locations

The repository includes two pre-configured subgraphs:

### Testnet Subgraph
- **Path**: `subgraph/rootstock-timelock-testnet/`
- **Network**: Rootstock Testnet (chainId 31)
- **Purpose**: Development and testing

### Mainnet Subgraph
- **Path**: `subgraph/rootstock-timelock-mainnet/`
- **Network**: Rootstock Mainnet (chainId 30)
- **Purpose**: Production deployments

Both subgraphs share the same schema and mappings but are configured for different networks.

{% hint style="danger" %}
These templates ship the **custom aggregated schema** the app requires. Do not regenerate them with `graph init` — that produces only raw per-event entities and the app will read no data.
{% endhint %}

## Key Concepts

### Entities
The subgraph indexes these aggregated entities (the app queries these directly):

- **Operation**: Scheduled timelock operations (single or batch)
- **Call**: Individual calls within an operation
- **Role**: A role on the timelock and its current holders
- **RoleAssignment**: Role granted to / revoked from an address

### Events Indexed
- `CallScheduled`: New operation scheduled
- `CallExecuted`: Operation executed
- `Cancelled`: Operation cancelled
- `RoleGranted`: Role granted to address
- `RoleRevoked`: Role revoked from address
- `MinDelayChange`: Minimum delay updated

### Query Examples

```graphql
# Get all pending operations
{
  operations(where: { status: "PENDING" }) {
    id
    target
    value
    data
    scheduledAt
    proposer
  }
}

# Get role grants for an address
{
  roleGrants(where: { account: "0x..." }) {
    role
    sender
    timestamp
  }
}
```

## Deployment Checklist

Before deploying to production mainnet:

- [ ] Tested on testnet first
- [ ] Verified correct contract address
- [ ] Confirmed correct start block
- [ ] Updated both `networks.json` and `subgraph.yaml`
- [ ] Ran `codegen` and `build` without errors
- [ ] Tested queries in Studio playground
- [ ] Configured app with Query URL
- [ ] Verified operations appear in UI

## Cost and Performance

### The Graph Studio
- **Deployment**: Free on The Graph Studio
- **Queries**: Free tier available, see [thegraph.com/studio](https://thegraph.com/studio/) for limits
- **Sync time**: Depends on chain length (testnet: minutes, mainnet: hours)

### Performance Expectations
- **Query latency**: <200ms for most queries
- **Indexing lag**: Usually 1-2 blocks behind chain tip
- **Refresh rate**: New data available within seconds of block confirmation

## Common Issues

### Deployment Fails
- Check address and startBlock are correct
- Ensure address is checksummed (mixed case)
- Verify network name matches Studio configuration

### Slow Sync
- Normal for long chains (mainnet)
- Check Studio dashboard for progress
- App automatically falls back to Blockscout during sync

### Missing Operations
- Verify startBlock is before first operation
- Check contract address is correct
- Ensure events were emitted by contract

For detailed troubleshooting, see [Troubleshooting Subgraphs](troubleshooting-subgraph.md).

## Default: Using Without Subgraphs

A subgraph is optional. If you don't deploy one:

1. The app uses the Blockscout API by default (no setup required)
2. Operations are fetched directly from event logs
3. Queries may be slower for very active timelocks, but all functionality remains
4. See [Dual Data Sources](../architecture/dual-data-sources.md) for details

{% hint style="info" %}
Deploying a subgraph is only worth it for very active timelocks that want faster indexed queries. Leave the `subgraphUrl` empty to stay on Blockscout.
{% endhint %}

## Next Steps

- **New to The Graph?** Start with [What is The Graph?](what-is-the-graph.md)
- **Ready to deploy?** Jump to [Deploying to Testnet](deploying-testnet.md)
- **Having issues?** Check [Troubleshooting](troubleshooting-subgraph.md)

---

**Ready to deploy?** Begin with [Preparing for Deployment](preparing-deployment.md).
