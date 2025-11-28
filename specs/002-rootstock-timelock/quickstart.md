# Quickstart Guide: Rootstock Timelock Management App

Get up and running with local development in under 15 minutes.

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.x or later ([download](https://nodejs.org/))
- **npm**: v10.x or later (comes with Node.js)
- **Git**: For cloning the repository
- **MetaMask** or compatible Web3 wallet: For testing wallet connections
- **Rootstock Wallet Setup**: Add Rootstock testnet to your wallet (instructions below)

**Recommended Tools**:
- **Visual Studio Code**: With TypeScript and ESLint extensions
- **Graph CLI**: For deploying subgraphs (`npm install -g @graphprotocol/graph-cli`)

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd timelock-manager
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including:
- Next.js 15, React 19
- wagmi 2.17+, viem 2.40+, RainbowKit 2.2+
- TanStack Query 5.55+
- Tailwind CSS, Radix UI
- Vitest, @testing-library/react

### 3. Environment Configuration

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` with the following variables:

```env
# Wallet Connect (Required)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# Rootstock RPC URLs (Optional - defaults to public nodes)
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://public-node.rsk.co
NEXT_PUBLIC_RSK_TESTNET_RPC_URL=https://public-node.testnet.rsk.co

# The Graph Subgraph URLs (Required after deploying subgraphs)
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<your-subgraph>/rootstock-timelock-mainnet/v1
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<your-subgraph>/rootstock-timelock-testnet/v1

# Rootstock Blockscout APIs (Defaults provided, can override)
NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL=https://explorer.rsk.co/api
NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL=https://explorer.testnet.rsk.co/api

# 4byte Directory (Default provided)
NEXT_PUBLIC_4BYTE_DIRECTORY_URL=https://www.4byte.directory/api/v1/

# Optional: Enable testnet by default
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

**Getting a WalletConnect Project ID**:
1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Sign up / Log in
3. Create a new project
4. Copy the Project ID

---

## Rootstock Wallet Setup

Add Rootstock Testnet to MetaMask:

1. Open MetaMask
2. Click network dropdown → "Add Network" → "Add a network manually"
3. Enter the following details:

   ```
   Network Name: Rootstock Testnet
   New RPC URL: https://public-node.testnet.rsk.co
   Chain ID: 31
   Currency Symbol: tRBTC
   Block Explorer URL: https://explorer.testnet.rsk.co
   ```

4. Click "Save"

**Getting Testnet tRBTC**:
- Faucet: [https://faucet.rootstock.io/](https://faucet.rootstock.io/)
- Enter your wallet address and request tRBTC

---

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

**What happens on dev server start**:
- TypeScript type checking runs in background
- Tailwind CSS compiles custom Rootstock theme
- Hot module replacement enabled for instant updates
- Strict mode warnings displayed in console

### Project Structure

```
src/
├── app/              # Next.js 15 App Router pages
├── components/       # React components (UI, operations, roles, etc.)
├── lib/              # Core utilities (wagmi config, constants, ABIs)
├── hooks/            # Custom React hooks (useOperations, useRoles, etc.)
├── services/         # External API clients (subgraph, Blockscout, 4byte)
├── types/            # TypeScript type definitions
└── styles/           # Global CSS and Rootstock theme

subgraph/             # The Graph subgraph (separate deployment)
tests/                # Vitest unit and integration tests
specs/                # Feature specifications and planning docs
```

### TypeScript Configuration

The project uses **TypeScript strict mode**. All code must:
- Have no implicit `any` types
- Use explicit return types for functions
- Enable all strict checks

Verify types compile:
```bash
npm run type-check
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format with Prettier
npm run format
```

---

## The Graph Subgraph Deployment

The app requires a deployed subgraph to index TimelockController events. Follow these steps to deploy:

### Option 1: The Graph Studio (Recommended for Production)

1. **Install Graph CLI**:
   ```bash
   npm install -g @graphprotocol/graph-cli
   ```

2. **Navigate to subgraph directory**:
   ```bash
   cd subgraph
   ```

3. **Authenticate with The Graph Studio**:
   - Visit [The Graph Studio](https://thegraph.com/studio/)
   - Create an account
   - Create a new subgraph named `rootstock-timelock-mainnet`
   - Copy the deploy key
   ```bash
   graph auth --studio <DEPLOY_KEY>
   ```

4. **Update subgraph.yaml**:
   - Set `network: rootstock` (or `rootstock-testnet`)
   - Set `address:` to your TimelockController contract address
   - Set `startBlock:` to deployment block (for faster syncing)

   Example:
   ```yaml
   dataSources:
     - kind: ethereum/contract
       name: TimelockController
       network: rootstock-testnet
       source:
         address: "0x1234567890abcdef1234567890abcdef12345678"
         abi: TimelockController
         startBlock: 5000000
   ```

5. **Build and deploy**:
   ```bash
   graph codegen
   graph build
   graph deploy --studio rootstock-timelock-mainnet
   ```

6. **Wait for indexing**: The Graph will sync historical events. Check progress in Studio dashboard.

7. **Update .env.local** with the subgraph URL provided by The Graph Studio.

### Option 2: Local Graph Node (For Development)

1. **Install Docker** and **Docker Compose**

2. **Clone graph-node**:
   ```bash
   git clone https://github.com/graphprotocol/graph-node
   cd graph-node/docker
   ```

3. **Start services**:
   ```bash
   docker-compose up
   ```

4. **Create and deploy locally**:
   ```bash
   cd <project-root>/subgraph
   graph create --node http://localhost:8020/ timelock-local
   graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 timelock-local
   ```

5. **Update .env.local**:
   ```env
   NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/timelock-local
   ```

---

## Running Tests

The project uses **Vitest** for unit and integration tests.

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Test Structure

```
tests/
├── unit/                 # Fast unit tests for utilities
│   ├── calldata.test.ts        # viem encoding/decoding
│   ├── abi-resolver.test.ts    # ABI resolution priority
│   ├── status.test.ts          # Operation status calculation
│   └── validation.test.ts      # Address/delay validation
│
├── integration/          # Slower integration tests
│   ├── wallet-connection.test.tsx    # RainbowKit flow
│   ├── operation-execution.test.tsx  # Execute/cancel
│   ├── proposal-builder.test.tsx     # Multi-step wizard
│   └── role-verification.test.tsx    # hasRole checks
│
└── fixtures/             # Mock data
    ├── mock-abis.ts
    ├── mock-operations.ts
    └── mock-roles.ts
```

### Test-First Workflow (Required by Constitution)

1. **Write tests first** for new features
2. **Submit tests for review** before implementation
3. **Run tests** (they should fail initially - Red)
4. **Implement feature** until tests pass (Green)
5. **Refactor** while keeping tests green

---

## Building for Production

### Build the Application

```bash
npm run build
```

This creates an optimized production build in `.next/` directory.

**Build checks**:
- TypeScript compilation
- ESLint validation
- Unused dependencies warning
- Bundle size analysis

### Start Production Server Locally

```bash
npm start
```

Runs the production build on [http://localhost:3000](http://localhost:3000)

### Deploying to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Link project**:
   ```bash
   vercel link
   ```

3. **Set environment variables** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all `NEXT_PUBLIC_*` variables from `.env.local`

4. **Deploy**:
   ```bash
   vercel --prod
   ```

**Automatic Deployments**:
- Push to `main` → Deploys to production
- Pull requests → Deploy preview environments

---

## Common Troubleshooting

### Issue: "Wallet not connecting"

**Solution**: Check that WalletConnect Project ID is set in `.env.local`

```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<your_id>
```

Restart dev server after changing env vars.

---

### Issue: "Subgraph not returning data"

**Possible causes**:
1. Subgraph not deployed or still syncing
2. Wrong subgraph URL in `.env.local`
3. TimelockController address mismatch in `subgraph.yaml`

**Solution**:
- Check subgraph indexing status in The Graph Studio
- Verify `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL` is correct
- Ensure `subgraph.yaml` has correct contract address

---

### Issue: "Wrong network" banner always showing

**Solution**:
1. Check MetaMask is on Rootstock Testnet (chainId 31)
2. Verify chain ID in `src/lib/wagmi.ts` matches (30 or 31)
3. Clear browser cache and hard refresh

---

### Issue: "Contract ABI not found" for verified contracts

**Possible causes**:
1. Blockscout API rate limit hit (10 req/s)
2. Contract not actually verified on Blockscout
3. Proxy contract with implementation not detected

**Solution**:
- Wait 1 second between ABI fetches (rate limit)
- Verify contract on Blockscout manually
- Use manual ABI input as fallback

---

### Issue: TypeScript errors about implicit `any`

**Solution**: The project uses strict mode. All types must be explicit:

```typescript
// ❌ Bad
function handleData(data) {
  return data.value;
}

// ✅ Good
function handleData(data: Operation): BigInt {
  return data.value;
}
```

---

### Issue: Tests failing with "Cannot find module wagmi"

**Solution**: Vitest config issue. Ensure `vitest.config.ts` includes:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

---

## Next Steps

1. **Deploy a test TimelockController**: Use Remix or Hardhat to deploy to Rootstock testnet
2. **Deploy the subgraph**: Follow instructions above
3. **Test wallet connection**: Connect MetaMask and verify network switching
4. **Schedule a test operation**: Use the Proposal Builder to schedule a simple operation
5. **Read the codebase**: Start with `src/app/layout.tsx` to understand provider setup

---

## Additional Resources

- **Rootstock Docs**: [https://dev.rootstock.io/](https://dev.rootstock.io/)
- **wagmi Docs**: [https://wagmi.sh/](https://wagmi.sh/)
- **RainbowKit Docs**: [https://rainbowkit.com/](https://rainbowkit.com/)
- **The Graph Docs**: [https://thegraph.com/docs/](https://thegraph.com/docs/)
- **OpenZeppelin TimelockController**: [https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController](https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController)
- **Project Constitution**: `.specify/memory/constitution.md`
- **Feature Specification**: `specs/001-rootstock-timelock/spec.md`
- **Implementation Plan**: `specs/001-rootstock-timelock/plan.md`

---

## Support

For issues or questions:
1. Check this Quickstart Guide
2. Review the [Feature Specification](./spec.md)
3. Consult the [Constitution](./.specify/memory/constitution.md) for project principles
4. Open an issue on GitHub

Happy building! 🚀
