# Deploying to Testnet

Step-by-step guide to deploy The Graph subgraph for Rootstock testnet.

## Prerequisites

Before deploying, ensure you have:

- [x] TimelockController deployed on Rootstock testnet (Chain ID 31)
- [x] Contract address (0x...)
- [x] Deployment block number
- [x] The Graph Studio account ([create here](https://thegraph.com/studio/))
- [x] Node.js 18.17+ and npm installed
- [x] Timelock Manager repository cloned

## Step 1: Navigate to Subgraph Directory

```bash
cd subgraph/rootstock-timelock-testnet
```

This directory contains the pre-configured testnet subgraph.

## Step 2: Install Dependencies

```bash
npm install
```

Installs Graph CLI and required packages.

## Step 3: Configure Contract Address

You must update TWO files with your TimelockController details:

### Update networks.json

Edit `subgraph/rootstock-timelock-testnet/networks.json`:

```json
{
  "rootstock-testnet": {
    "TimelockController": {
      "address": "0xYourTimelockAddress",
      "startBlock": 1234567
    }
  }
}
```

**Replace**:
- `0xYourTimelockAddress`: Your TimelockController contract address
- `1234567`: Block number where your TimelockController was deployed

{% hint style="warning" %}
**Finding deployment block**: Check the deployment transaction on Rootstock-testnet.blockscout.com and note the block number. Using a block before deployment wastes indexing time; using a block after deployment may miss events.
{% endhint %}

### Update subgraph.yaml

Edit `subgraph/rootstock-timelock-testnet/subgraph.yaml`:

Find the `dataSources` section and update:

```yaml
dataSources:
  - kind: ethereum/contract
    name: TimelockController
    network: rootstock-testnet
    source:
      address: "0xYourTimelockAddress"  # Must match networks.json
      abi: TimelockController
      startBlock: 1234567                 # Must match networks.json
```

**Important**: Both files MUST have identical address and startBlock values.

## Step 4: Generate TypeScript Types

```bash
npm run codegen
```

**What this does**:
- Reads `schema.graphql`
- Generates TypeScript types in `generated/` directory
- Creates type-safe code for mappings

**Expected output**:
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Load contract ABI from abis/TimelockController.json
✔ Generate types for contract ABIs
✔ Generate types for data source templates
✔ Load data source template ABIs
✔ Generate types for data source template ABIs
✔ Generate types from GraphQL schema
✔ Write types to generated/
```

**If errors occur**:
- Check `schema.graphql` is valid
- Ensure ABI file exists at `abis/TimelockController.json`
- Verify no syntax errors in schema

## Step 5: Build Subgraph

```bash
npm run build
```

**What this does**:
- Compiles AssemblyScript mappings to WebAssembly
- Bundles subgraph for deployment
- Validates configuration

**Expected output**:
```
✔ Compile subgraph
  Compile data source: TimelockController => build/TimelockController/TimelockController.wasm
✔ Write compiled subgraph to build/
```

**If errors occur**:
- Check mappings in `src/mapping.ts` for syntax errors
- Ensure generated types exist (run codegen first)
- Review error messages for specific issues

## Step 6: Create Subgraph in Studio

If you haven't already:

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Click "Create a Subgraph"
3. Enter name: `rootstock-timelock-testnet` (or your preferred name)
4. Note the slug (used in deploy command)
5. Copy your **Deploy Key** (shown once)

[Screenshot placeholder: Graph Studio create subgraph]

## Step 7: Authenticate CLI

First time on this machine only:

```bash
npx graph auth --studio <YOUR_DEPLOY_KEY>
```

**Replace** `<YOUR_DEPLOY_KEY>` with the deploy key from Studio.

**Expected output**:
```
Deploy key set for https://api.studio.thegraph.com/deploy/
```

**Security note**: Deploy key is stored in `~/.graph/config.yml`. Keep it secret.

## Step 8: Deploy Subgraph

```bash
npm run deploy
```

**What this command does**:
```bash
graph deploy --studio rootstock-timelock-testnet
```

If your Studio subgraph has a different name/slug:
```bash
npx graph deploy --studio your-subgraph-slug
```

**Expected output**:
```
✔ Version Label (e.g. v0.0.1) · v0.0.1
  Skip migration: Bump mapping apiVersion from 0.0.1 to 0.0.2
  Skip migration: Bump mapping apiVersion from 0.0.2 to 0.0.3
  Skip migration: Bump mapping apiVersion from 0.0.3 to 0.0.4
  Skip migration: Bump mapping apiVersion from 0.0.4 to 0.0.5
  Skip migration: Bump mapping apiVersion from 0.0.5 to 0.0.6
  Skip migration: Bump manifest specVersion from 0.0.1 to 0.0.2
  Skip migration: Bump manifest specVersion from 0.0.2 to 0.0.4
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
  Compile data source: TimelockController => build/TimelockController/TimelockController.wasm
✔ Compile subgraph
✔ Write compiled subgraph to build/
  Add file to IPFS: build/schema.graphql
                    QmHash1...
  Add file to IPFS: build/TimelockController/abis/TimelockController.json
                    QmHash2...
  ...
✔ Upload subgraph to IPFS

Build completed: QmBuildHash...

Deployed to https://thegraph.com/studio/subgraph/rootstock-timelock-testnet

Subgraph endpoints:
Queries (HTTP):     https://api.studio.thegraph.com/query/12345/rootstock-timelock-testnet/v0.0.1
```

**Copy the Queries (HTTP) URL** - you'll need this for the app configuration.

## Step 9: Monitor Indexing

1. Go to The Graph Studio dashboard
2. Select your subgraph
3. Watch the "Indexing Status"

**Status indicators**:
- **Syncing**: Indexing blocks (shows progress percentage)
- **Synced**: Up to date with blockchain
- **Failed**: Error occurred (check logs)

**Typical sync time**:
- Testnet: 5-30 minutes (depends on chain length)
- Fresh deployment: Faster
- Long-running chain: Slower

[Screenshot placeholder: Studio dashboard showing sync progress]

## Step 10: Verify Deployment

Once status shows "Synced", test with a query:

### In Graph Studio Playground

1. Click "Playground" tab
2. Run test query:

```graphql
{
  _meta {
    block {
      number
      timestamp
    }
  }
  operations(first: 5, orderBy: scheduledAt, orderDirection: desc) {
    id
    status
    target
    scheduledAt
    proposer
  }
}
```

**Expected result**: JSON with operations (or empty array if no operations scheduled yet)

**If no operations**:
- Normal if timelock hasn't been used yet
- Test by scheduling an operation via Timelock Manager
- Subgraph will index it within seconds

### Test _meta Query

```graphql
{
  _meta {
    deployment
    hasIndexingErrors
    block {
      number
    }
  }
}
```

**Check**:
- `hasIndexingErrors: false`
- `block.number` is recent

## Step 11: Configure Application

Copy your Query URL and add to `.env.local`:

```bash
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/12345/rootstock-timelock-testnet/v0.0.1
```

**Full .env.local example**:
```bash
# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wc_project_id

# Testnet Subgraph (from Step 10)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...

# Enable testnet in UI
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

## Step 12: Restart App and Verify

```bash
# Stop dev server (Ctrl+C)
# Restart
npm run dev
```

**Verify in app**:
1. Connect wallet
2. Go to Settings
3. Configure testnet timelock with your contract address
4. Go to Operations Explorer
5. Verify operations load (or empty state if no operations yet)
6. Check browser console - should NOT see "Subgraph unavailable"

## Updating the Subgraph

If you make changes to mappings or schema:

```bash
# 1. Make your changes
# 2. Regenerate types
npm run codegen

# 3. Build
npm run build

# 4. Deploy new version
npm run deploy
# Enter new version label (e.g., v0.0.2)
```

**Version management**:
- Each deployment creates new version
- Old versions remain queryable
- Studio marks latest as "Current"
- Update app's Query URL if version changed

## Troubleshooting

### Error: "Graph node is not reachable"

**Cause**: Network issue or Studio down

**Solution**:
- Check internet connection
- Try again in a few minutes
- Check The Graph status page

---

### Error: "subgraph name already exists"

**Cause**: Subgraph with this name already deployed

**Solution**:
- Use different name/slug, or
- Deploy to existing subgraph (updates it)

---

### Error: "Failed to index events"

**Cause**: Incorrect startBlock or contract address

**Solution**:
1. Verify contract address is correct
2. Check startBlock is deployment block
3. Redeploy with correct values

---

### Subgraph shows "Failed" status

**Cause**: Error in mappings or invalid data

**Solution**:
1. Click "Logs" in Studio
2. Review error message
3. Fix mapping code
4. Redeploy

See: [Troubleshooting Subgraphs](troubleshooting-subgraph.md) for more issues.

## Next Steps

- ✅ Deploy mainnet subgraph: [Deploying to Mainnet](deploying-mainnet.md)
- ✅ Verify deployment: [Verifying Deployment](verifying-deployment.md)
- ✅ Use the app: [Quick Start](../getting-started/quick-start.md)

## Deployment Checklist

- [ ] Subgraph deployed to Studio
- [ ] Status shows "Synced"
- [ ] Test query returns data (or empty array)
- [ ] No indexing errors in logs
- [ ] Query URL copied
- [ ] `.env.local` updated with Query URL
- [ ] App restarted
- [ ] Operations load in Operations Explorer
- [ ] No "Subgraph unavailable" in console

**Congratulations!** Your testnet subgraph is now live and indexing operations.

---

**Next**: [Deploy to mainnet](deploying-mainnet.md) or [verify your deployment](verifying-deployment.md)
