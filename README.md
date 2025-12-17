# Rootstock Timelock Management App

This project is a Web3 governance application for exploring and managing OpenZeppelin TimelockController contracts on Rootstock networks (mainnet and testnet).

## Overview

The Timelock Management App provides a user-friendly interface for governance participants and administrators to:

- **Explore Operations:** View all pending, ready, executed, and cancelled operations in a TimelockController contract.
- **Manage Roles:** Audit which addresses hold `PROPOSER`, `EXECUTOR`, `CANCELLER`, and `ADMIN` roles.
- **Execute & Cancel:** Allow authorized users to execute ready operations or cancel pending ones.
- **Schedule Proposals:** A user-friendly wizard to construct and schedule new governance operations.
- **Decode Calldata:** A utility to decode raw transaction calldata for safety and verification.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (Pages Router)
- **Language:** TypeScript
- **Web3:** [wagmi](https://wagmi.sh/), [viem](https://viem.sh/), and [RainbowKit](https://rainbowkit.com) for wallet integration and blockchain interaction.
- **Data Fetching:** [TanStack Query](https://tanstack.com/query/latest) with a primary reliance on [The Graph](https://thegraph.com/) for indexed data and the [Blockscout API](https://docs.blockscout.com/for-users/api) as a fallback.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Testing:** [Vitest](https://vitest.dev/) & [React Testing Library](https://testing-library.com/)

## Getting Started

### Prerequisites

- Node.js (v20.x or later)
- npm (v10.x or later)
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd timelock-manager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file by copying the example:

```bash
cp .env.example .env.local
```

You will need to fill in the required environment variables, such as `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`.

#### Required

- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: WalletConnect Cloud project id (RainbowKit).
- `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL`: The Graph subgraph endpoint for Rootstock testnet (chainId 31).
  - If you want mainnet support in production, also set `NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL`.

#### Recommended (defaults exist)

- `NEXT_PUBLIC_RSK_MAINNET_RPC_URL`, `NEXT_PUBLIC_RSK_TESTNET_RPC_URL`
- `NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL`, `NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL`
- `NEXT_PUBLIC_4BYTE_DIRECTORY_URL`

## Subgraph deployment (The Graph Studio)

This repo includes two subgraphs (one per network) under `subgraph/`. Deploy them to [The Graph Studio](https://thegraph.com/studio/) and then point the app at the resulting Query URL.

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
npx graph auth --studio <DEPLOY_KEY>
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


### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 5. Run Tests

```bash
npm test
```

## Deployment (Vercel)

This is a Next.js app intended to be deployed on Vercel.

1. Create a Vercel project from this repo.
2. Set the environment variables (at minimum the WalletConnect project id + subgraph URL(s)).
3. Use default Next.js build settings:
   - Build command: `npm run build`
   - Output: `.next`

Notes:

- The app relies on The Graph subgraphs for operations/roles and falls back to Blockscout when the subgraph is unavailable.
- You must deploy a subgraph per network and point `NEXT_PUBLIC_RSK_*_SUBGRAPH_URL` at those endpoints.

## Learn More

To learn more about the project's detailed specifications and implementation plan, please refer to the documents in the `specs/` directory.
