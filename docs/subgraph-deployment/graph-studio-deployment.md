# Deploying to The Graph Studio

This repo includes two subgraphs (one per network) under `subgraph/`. Deploy them to [The Graph Studio](https://thegraph.com/studio/) and then point the app at the resulting Query URL.

## Deploy from the app (new timelock, key stays on your machine)

After deploying a timelock from the app, you can use the built-in **Subgraph deploy** flow to prepare and deploy a subgraph without ever sending your deploy key to the backend:

1. From the timelock deploy success screen (or from **Settings → Subgraph deployment**), open the **Subgraph deploy** view.
2. Confirm or enter the **Timelock address**, **Start block**, and **Network** for the timelock you just deployed.
3. Enter your **Graph Studio deploy key** and desired **subgraph slug**. These values stay in the browser and are only used to construct a local shell command; they are never sent to the app’s server.
4. Copy the generated shell command from the UI, paste it into your terminal, and run it. This command:
   - Calls the app’s `/api/subgraph/prepare` endpoint to build a ready-to-deploy subgraph package for your timelock.
   - Unzips the package and runs `npm install @graphprotocol/graph-cli`.
   - Executes `npx graph auth <DEPLOY_KEY>` and `npx graph deploy --studio <SUBGRAPH_SLUG>` locally on your machine.
5. After deployment succeeds, copy the **Query URL** from The Graph Studio and paste it back into the **Subgraph deploy** view to save this timelock (with its subgraph URL) into the app configuration.

At no point is your Studio deploy key sent to the app’s backend; it is only used locally in your browser and terminal.

## Manual deployment

### 1) Choose the network subgraph

- Testnet: `subgraph/rootstock-timelock-testnet/`
- Mainnet: `subgraph/rootstock-timelock-mainnet/`

### 2) Configure the TimelockController address + start block

For the network you’re deploying, update **both** files below (keep them in sync):

- `subgraph/<...>/networks.json`
  - Set `TimelockController.address` to your timelock contract address
  - Set `TimelockController.startBlock` to the deployment block (or earliest block you want indexed)
- `subgraph/<...>/subgraph.yaml`
  - Set `dataSources[0].source.address` to the same address
  - Set `dataSources[0].source.startBlock` to the same start block

Note: the current deploy scripts in this repo do **not** auto-apply `networks.json`, so `subgraph.yaml` must be updated manually as well.

### 3) Deploy to The Graph Studio

From the selected subgraph folder:

```bash
cd subgraph/rootstock-timelock-testnet
npm install
npm run codegen
npm run build
```

Authenticate (once per machine) using your Studio deploy key:

```bash
npx graph auth <DEPLOY_KEY>
```

Deploy:

```bash
npm run deploy
```

#### Subgraph “slug” / name

The deploy scripts are currently configured to deploy as:
- `rootstock-timelock-testnet`
- `rootstock-timelock-mainnet`

If your Studio subgraph slug is different, either:
- Edit `subgraph/<...>/package.json` and update the `deploy` script, or
- Run `npx graph deploy --node https://api.studio.thegraph.com/deploy/ <your-subgraph-slug>`

### 4) Point the app at your deployed subgraph

Copy the Studio **Query URL** and set it in `.env.local`:
- `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL` for testnet (chainId 31)
- `NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL` for mainnet
