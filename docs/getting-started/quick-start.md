# Quick Start

Get up and running with Timelock Manager in minutes.

## For End Users

### Step 1: Access the Application

Visit the deployed Timelock Manager instance (URL provided by your administrator).

\[Screenshot placeholder: Landing page]

### Step 2: Connect Your Wallet

1. Click the **"Connect Wallet"** button in the top-right corner
2. Select your wallet (MetaMask, WalletConnect, etc.)
3. Approve the connection in your wallet
4. If prompted, add/switch to Rootstock network

\[Screenshot placeholder: Wallet connection modal]

{% hint style="info" %}
The app will automatically prompt you to add Rootstock network if it's not in your wallet. Simply approve the request.
{% endhint %}

### Step 3: Configure Timelock

1. Click **"Settings"** in the left sidebar
2. Under "Timelock Configurations", click **"Add Timelock"**
3. Fill in the details:
   * **Name**: Friendly name (e.g., "Main DAO Timelock")
   * **Address**: Your TimelockController contract address
   * **Network**: Select Mainnet or Testnet
   * **Subgraph URL** _(optional)_: Leave empty to read directly from Blockscout. Only add a The Graph query URL if your administrator has deployed a subgraph (an advanced, optional path for very active timelocks).
4. Click **"Save"**
5. Select the timelock from the dropdown in the header

{% hint style="info" %}
That's the fastest path: a timelock address plus a network is all you need. The app reads operations, roles, and history directly from the Rootstock Blockscout API with zero additional setup. A subgraph is optional.
{% endhint %}

\[Screenshot placeholder: Settings page with timelock configuration]

### Step 4: Explore Operations

1. Click **"Operations Explorer"** in the sidebar
2. Browse all operations for your timelock
3. Use filters to find specific operations:
   * Filter by status (Pending, Ready, Executed, Cancelled)
   * Search by operation ID or address
   * Filter by date range

\[Screenshot placeholder: Operations Explorer]

### That's it!

You're now ready to:

* Browse operations: [Operations Explorer Guide](../user-guide/operations-explorer.md)
* Create proposals: [Creating Proposals](../user-guide/creating-proposals.md)
* Execute operations: [Executing Operations](../user-guide/executing-operations.md)

## For Developers

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd timelock-manager

# Install dependencies
npm install
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local and add required variables
```

Minimal configuration:

```bash
# Required (for wallet connection)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# Optional: enable testnet in the UI
NEXT_PUBLIC_ENABLE_TESTNETS=true

# Optional: subgraph URLs (advanced — app reads from Blockscout by default)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/...
```

Get WalletConnect Project ID:

1. Visit [cloud.walletconnect.com](https://cloud.walletconnect.com/)
2. Create account and new project
3. Copy Project ID

### Step 3: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 4: Test the App

1. Connect MetaMask
2. Switch to Rootstock testnet
3. Get testnet RBTC from [faucet](https://faucet.rootstock.io/)
4. Configure a testnet timelock
5. Browse operations

### Next Steps for Developers

* (Optional) Deploy a subgraph for faster indexed queries: [Deploying to Testnet](../subgraph-deployment/deploying-testnet.md)
* Understand architecture: [Architecture Overview](../architecture/architecture.md)
* Read developer guide: [Developer Guide](../developer-guide/developer-guide.md)

## For Administrators

### Step 1: Configure Application

Create `.env.local` (or configure on Vercel):

```bash
# Required (for wallet connection)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123...

# Optional: Custom RPC for better performance
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-rpc-endpoint.com

# Optional: AI explanations (off unless set)
OPENAI_API_KEY=sk-proj-...

# Optional: subgraph URLs (advanced — app reads from Blockscout by default)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
```

### Step 2 (Optional): Deploy a Subgraph

A subgraph is **not required** — the app reads operations, roles, and history directly from Blockscout out of the box. Deploy one only if you run a very active timelock and want faster indexed queries:

```bash
# Navigate to subgraph directory
cd subgraph/rootstock-timelock-testnet

# Install dependencies
npm install

# Configure networks.json with your TimelockController address
# (Edit both networks.json and subgraph.yaml)

# Generate types
npm run codegen

# Build subgraph
npm run build

# Authenticate (first time only)
npx graph auth --studio <YOUR_DEPLOY_KEY>

# Deploy
npm run deploy
```

Wait for subgraph to sync (check The Graph Studio dashboard), then add its query URL to the matching `NEXT_PUBLIC_RSK_*_SUBGRAPH_URL` variable.

### Step 3: Deploy to Vercel

**Option A: Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com/)
2. Click "Import Project"
3. Connect your Git repository
4. Configure environment variables (from Step 2)
5. Click "Deploy"

**Option B: Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts to configure
```

### Step 4: Verify Deployment

1. Visit your deployment URL
2. Connect wallet
3. Configure timelock
4. Verify operations load correctly
5. Test creating a proposal on testnet

### Next Steps for Administrators

* Production checklist: [Production Checklist](../deployment/production-checklist.md)
* Monitoring setup: [Monitoring](../deployment/monitoring.md)
* Full deployment guide: [Deployment Overview](../deployment/deployment.md)

## Common Quick Start Issues

### Issue: "Cannot connect wallet"

**Solution**:

1. Ensure MetaMask is installed
2. Try refreshing the page
3. Check browser console for errors
4. See [Wallet Connection Issues](../troubleshooting/wallet-connection.md)

***

### Issue: "No operations showing"

**Possible causes**:

* Wrong timelock address
* Network mismatch (timelock configured for a different network than selected)
* The timelock genuinely has no operations yet
* If using an optional subgraph: wrong subgraph URL or it hasn't synced

**Solution**:

1. Verify the timelock **address** and **network** in Settings
2. Confirm the timelock has operations (cross-check on Blockscout)
3. If you configured a subgraph URL, clear it to fall back to Blockscout, or verify it is correct and synced in The Graph Studio
4. Check the browser console for errors

***

### Issue: "Cannot schedule operation"

**Cause**: Missing PROPOSER\_ROLE

**Solution**:

1. Check your roles in Permissions page
2. Ask administrator to grant PROPOSER\_ROLE
3. Ensure wallet is connected and on correct network

***

### Issue: "Build fails"

**Solution**:

```bash
# Clear cache and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

Check for:

* Node.js version (must be 18.17+)
* Environment variables set correctly
* No TypeScript errors

## Quick Reference

### Key Directories

```
timelock-manager/
├── docs/                    # Documentation (you are here)
├── src/
│   ├── components/          # React components
│   ├── pages/              # Next.js pages
│   ├── services/           # API clients
│   ├── hooks/              # React hooks
│   └── lib/                # Utilities
├── subgraph/               # The Graph subgraphs
│   ├── rootstock-timelock-testnet/
│   └── rootstock-timelock-mainnet/
└── .env.local             # Environment variables (create this)
```

### Key Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm test             # Run tests

# Subgraph
cd subgraph/rootstock-timelock-testnet
npm run codegen      # Generate types
npm run build        # Build subgraph
npm run deploy       # Deploy to Studio
```

### Key Environment Variables

```bash
# Required (for wallet connection)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...

# Optional (advanced — app reads from Blockscout by default)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=...
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=...

# Optional (for AI features)
OPENAI_API_KEY=...
```

## What to Do Next

Based on your role:

### As an End User

1. ✅ Connected wallet and configured timelock
2. → Browse operations: [Operations Explorer](../user-guide/operations-explorer.md)
3. → Create proposal: [Creating Proposals](../user-guide/creating-proposals.md)
4. → Learn about roles: [Understanding Roles](../user-guide/understanding-roles.md)

### As a Developer

1. ✅ Running locally
2. → (Optional) Deploy a subgraph: [Subgraph Deployment](../subgraph-deployment/deploying-testnet.md)
3. → Understand architecture: [Architecture](../architecture/architecture.md)
4. → Read developer guide: [Developer Guide](../developer-guide/developer-guide.md)

### As an Administrator

1. ✅ Deployed app (subgraph optional)
2. → Production checklist: [Production Checklist](../deployment/production-checklist.md)
3. → Set up monitoring: [Monitoring](../deployment/monitoring.md)
4. → Security review: [Security Best Practices](../security/best-practices.md)

## Getting Help

* **User questions**: See [User Guide](../user-guide/user-guide.md)
* **Developer questions**: See [Developer Guide](../developer-guide/developer-guide.md)
* **Troubleshooting**: See [Troubleshooting](../troubleshooting/troubleshooting.md)
* **Deployment issues**: See [Deployment](../deployment/deployment.md)

***

**Quick start complete!** Choose your next guide from the sections above.
