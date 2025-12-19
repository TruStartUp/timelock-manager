# Quick Start

Get up and running with Timelock Manager in minutes.

## For End Users

### Step 1: Access the Application

Visit the deployed Timelock Manager instance (URL provided by your administrator).

[Screenshot placeholder: Landing page]

### Step 2: Connect Your Wallet

1. Click the **"Connect Wallet"** button in the top-right corner
2. Select your wallet (MetaMask, WalletConnect, etc.)
3. Approve the connection in your wallet
4. If prompted, add/switch to Rootstock network

[Screenshot placeholder: Wallet connection modal]

{% hint style="info" %}
The app will automatically prompt you to add Rootstock network if it's not in your wallet. Simply approve the request.
{% endhint %}

### Step 3: Configure Timelock

1. Click **"Settings"** in the left sidebar
2. Under "Timelock Configurations", click **"Add Timelock"**
3. Fill in the details:
   - **Name**: Friendly name (e.g., "Main DAO Timelock")
   - **Address**: Your TimelockController contract address
   - **Network**: Select Mainnet or Testnet
   - **Subgraph URL**: The Graph query URL (from administrator)
4. Click **"Save"**
5. Select the timelock from the dropdown in the header

[Screenshot placeholder: Settings page with timelock configuration]

### Step 4: Explore Operations

1. Click **"Operations Explorer"** in the sidebar
2. Browse all operations for your timelock
3. Use filters to find specific operations:
   - Filter by status (Pending, Ready, Executed, Cancelled)
   - Search by operation ID or address
   - Filter by date range

[Screenshot placeholder: Operations Explorer]

### That's it!

You're now ready to:
- Browse operations: [Operations Explorer Guide](../user-guide/operations-explorer.md)
- Create proposals: [Creating Proposals](../user-guide/creating-proposals.md)
- Execute operations: [Executing Operations](../user-guide/executing-operations.md)

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
# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# Optional (app works with Blockscout fallback)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/...

# Enable testnet
NEXT_PUBLIC_ENABLE_TESTNETS=true
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

- Deploy subgraph: [Deploying to Testnet](../subgraph-deployment/deploying-testnet.md)
- Understand architecture: [Architecture Overview](../architecture/README.md)
- Read developer guide: [Developer Guide](../developer-guide/README.md)

## For Administrators

### Step 1: Deploy Subgraph

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

Wait for subgraph to sync (check The Graph Studio dashboard).

### Step 2: Configure Application

Create `.env.local` (or configure on Vercel):

```bash
# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123...

# Subgraph URLs (from The Graph Studio)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...

# Optional: Custom RPC for better performance
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-rpc-endpoint.com

# Optional: AI explanations
OPENAI_API_KEY=sk-proj-...
```

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

- Production checklist: [Production Checklist](../deployment/production-checklist.md)
- Monitoring setup: [Monitoring](../deployment/monitoring.md)
- Full deployment guide: [Deployment Overview](../deployment/README.md)

## Common Quick Start Issues

### Issue: "Cannot connect wallet"

**Solution**:
1. Ensure MetaMask is installed
2. Try refreshing the page
3. Check browser console for errors
4. See [Wallet Connection Issues](../troubleshooting/wallet-connection.md)

---

### Issue: "No operations showing"

**Possible causes**:
- Subgraph not deployed or not synced
- Wrong subgraph URL
- Network mismatch

**Solution**:
1. Check subgraph is deployed and synced in The Graph Studio
2. Verify `NEXT_PUBLIC_RSK_*_SUBGRAPH_URL` is correct
3. Check browser console for "Subgraph unavailable" warning
4. App should automatically fall back to Blockscout

---

### Issue: "Cannot schedule operation"

**Cause**: Missing PROPOSER_ROLE

**Solution**:
1. Check your roles in Permissions page
2. Ask administrator to grant PROPOSER_ROLE
3. Ensure wallet is connected and on correct network

---

### Issue: "Build fails"

**Solution**:
```bash
# Clear cache and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

Check for:
- Node.js version (must be 18.17+)
- Environment variables set correctly
- No TypeScript errors

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
# Minimum (for basic functionality)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...

# Recommended (for full features)
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
2. → Deploy subgraph: [Subgraph Deployment](../subgraph-deployment/deploying-testnet.md)
3. → Understand architecture: [Architecture](../architecture/README.md)
4. → Read developer guide: [Developer Guide](../developer-guide/README.md)

### As an Administrator
1. ✅ Deployed app and subgraph
2. → Production checklist: [Production Checklist](../deployment/production-checklist.md)
3. → Set up monitoring: [Monitoring](../deployment/monitoring.md)
4. → Security review: [Security Best Practices](../security/best-practices.md)

## Getting Help

- **User questions**: See [User Guide](../user-guide/README.md)
- **Developer questions**: See [Developer Guide](../developer-guide/README.md)
- **Troubleshooting**: See [Troubleshooting](../troubleshooting/README.md)
- **Deployment issues**: See [Deployment](../deployment/README.md)

---

**Quick start complete!** Choose your next guide from the sections above.
