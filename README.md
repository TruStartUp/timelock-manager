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

You will need to fill in the required environment variables, such as `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`. See `specs/001-rootstock-timelock/quickstart.md` for more details.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 5. Run Tests

```bash
npm test
```

## Learn More

To learn more about the project's detailed specifications and implementation plan, please refer to the documents in the `specs/` directory.
