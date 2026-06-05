# Rootstock Timelock Management App

This project is a Web3 governance application for exploring and managing OpenZeppelin TimelockController contracts on Rootstock networks (mainnet and testnet).

## Overview

The Timelock Management App provides a user-friendly interface for governance participants and administrators to:

- **Explore Operations:** View all pending, ready, executed, and cancelled operations in a TimelockController contract.
- **Manage Roles:** Audit which addresses hold `PROPOSER`, `EXECUTOR`, `CANCELLER`, and `ADMIN` roles.
- **Execute & Cancel:** Allow authorized users to execute ready operations or cancel pending ones.
- **Schedule Proposals:** A user-friendly wizard to construct and schedule new governance operations.
- **Decode Calldata:** A utility to decode raw transaction calldata for safety and verification.

## Documentation

📚 Full documentation lives in [**`docs/`**](./docs/README.md) (published via GitBook). It covers the
user guide, developer guide, architecture, deployment, subgraph deployment, security, and
troubleshooting.

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
git clone https://github.com/TruStartUp/timelock-manager
cd timelock-manager
```

### 2. Install Dependencies

```bash
npm install
```

> **Using the Deploy Timelock feature?** The root `npm install` does **not** install the Solidity
> contract dependencies under `contracts/`. Run this once so the app can compile the
> `TimelockController` when deploying:
>
> ```bash
> npm run build:contracts
> ```
>
> Otherwise the deploy screen fails with `hardhat: command not found`. (A full `npm run build`
> also does this.) See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for details.

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
- `NEXT_PUBLIC_ENABLE_TESTNETS`: Optional. If `true`, enables testnet support in the UI.

#### Optional: AI explanations (OpenAI)

This app can generate a plain-English explanation of decoded calls when the user clicks **Explain**.

- `OPENAI_API_KEY`: Required to enable explanations (server-side only; never exposed to the browser).
- `OPENAI_MODEL`: Optional. Defaults to `gpt-5-nano` if not set.

## AI explanations (what it is + where it’s used)

- **API route**: `src/pages/api/explain_operation.ts` implements `POST /api/explain_operation`.
  - Calls the OpenAI **Responses API** (`/v1/responses`) and asks the model to return **JSON** with:
    - `summary`: short plain-English explanation
    - `perCall`: optional per-call bullets
- **Used in**:
  - `src/components/operations_explorer/OperationRow.tsx` (expanded operation → **Explain this operation**)
  - `src/components/decoder/DecoderView.tsx` (Calldata Decoder output → **Explain**)

## Subgraph deployment (The Graph Studio)

This repo includes two subgraphs (one per network) under `subgraph/`. They must be deployed to
[The Graph Studio](https://thegraph.com/studio/) and the app pointed at the resulting Query URL.

📖 **Full guide:** [Deploying to The Graph Studio](./docs/subgraph-deployment/graph-studio-deployment.md)
— covers the in-app **Subgraph deploy** flow (deploy key stays on your machine) and the manual
CLI deployment, plus how to set `NEXT_PUBLIC_RSK_*_SUBGRAPH_URL` afterwards.


### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 5. Run Tests

```bash
npm test
```

## Troubleshooting

Running into an error? See **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** for the most
common issues and their fixes, including:

- `hardhat: command not found` when deploying a timelock → run `npm run build:contracts`.
- `RPC submit: Internal server error` (-32603) when sending the deploy transaction → switch
  your wallet to Rootstock Testnet (chainId 31) and make sure you have tRBTC for gas.

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
