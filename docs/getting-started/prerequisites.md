# Prerequisites

What you need before using Timelock Manager.

## For End Users (Governance Participants)

### Required

#### 1. Web3 Wallet

You need a Web3 wallet that supports Rootstock network:

**Recommended Wallets**:
- **MetaMask**: Most popular, browser extension
- **Rabby**: Multi-chain wallet with good UX
- **Defiant**: Rootstock-native wallet
- **Any WalletConnect-compatible wallet**: Mobile wallets

**Installation**:
- MetaMask: [metamask.io](https://metamask.io/)
- Add Rootstock network to your wallet (app will prompt if needed)

#### 2. Rootstock Network Configuration

Your wallet must be configured for Rootstock:

**Mainnet (Chain ID 30)**:
- Network Name: `Rootstock Mainnet`
- RPC URL: `https://public-node.rsk.co`
- Chain ID: `30`
- Currency Symbol: `RBTC`
- Block Explorer: `https://rootstock.blockscout.com`

**Testnet (Chain ID 31)**:
- Network Name: `Rootstock Testnet`
- RPC URL: `https://public-node.testnet.rsk.co`
- Chain ID: `31`
- Currency Symbol: `tRBTC`
- Block Explorer: `https://rootstock-testnet.blockscout.com`

{% hint style="info" %}
The app will automatically prompt you to add the network if it's not configured. Simply approve the request in your wallet.
{% endhint %}

#### 3. RBTC for Gas Fees

You need a small amount of RBTC to pay for transaction gas fees:

**Mainnet**:
- Purchase RBTC on exchanges
- Bridge from Bitcoin using [Rootstock Powpeg](https://powpeg.rootstock.io/)
- Typically need <$1 worth for gas

**Testnet**:
- Get free tRBTC from [Rootstock Faucet](https://faucet.rootstock.io/)
- No real value, for testing only

#### 4. Appropriate Roles

To perform actions, you need the corresponding role in the TimelockController:

| Action | Required Role |
|--------|--------------|
| Schedule operations | PROPOSER_ROLE |
| Execute operations | EXECUTOR_ROLE |
| Cancel operations | CANCELLER_ROLE |
| Grant/revoke roles | DEFAULT_ADMIN_ROLE |
| View operations | None (public) |
| Decode calldata | None (public) |

{% hint style="warning" %}
If you don't have the required role, you can browse and view operations but cannot schedule, execute, or cancel them. Contact your DAO administrator to request roles.
{% endhint %}

### Optional

#### Browser

**Recommended browsers** for best experience:
- Chrome/Chromium (best wallet support)
- Firefox
- Brave
- Edge

**Not recommended**:
- Safari (limited Web3 support)
- Mobile browsers (use desktop for best UX)

#### Basic Knowledge

Helpful but not required:
- Understanding of blockchain governance
- Familiarity with timelock concepts
- Basic knowledge of smart contracts

See: [Understanding Roles](../user-guide/understanding-roles.md) for governance concepts

## For Developers

### Required

#### 1. Software

- **Node.js**: v18.17 or higher
  - Check version: `node --version`
  - Download: [nodejs.org](https://nodejs.org/)

- **npm**: v9 or higher (comes with Node.js)
  - Check version: `npm --version`

- **Git**: For cloning repository
  - Check version: `git --version`
  - Download: [git-scm.com](https://git-scm.com/)

#### 2. Accounts & API Keys

- **WalletConnect Project ID**: Required for wallet connection
  - Create at [cloud.walletconnect.com](https://cloud.walletconnect.com/)
  - Free tier available

- **The Graph Studio Account**: Required for deploying subgraphs
  - Create at [thegraph.com/studio](https://thegraph.com/studio/)
  - Free to use

#### 3. TimelockController Contract

- Deployed TimelockController on Rootstock
- Contract address
- Deployment block number

If you don't have one, you can deploy using OpenZeppelin:

```solidity
import "@openzeppelin/contracts/governance/TimelockController.sol";

// Deploy with these parameters:
// minDelay: 172800 (48 hours in seconds)
// proposers: [address1, address2, ...]
// executors: [address1, address2, ...]
```

### Recommended

#### Development Tools

- **VS Code**: Recommended code editor
  - Extensions: ESLint, Prettier, TypeScript
- **MetaMask**: For testing wallet connections
- **Testnet RBTC**: For testing on testnet

#### Knowledge

- **TypeScript**: App is written in TypeScript
- **React/Next.js**: Frontend framework
- **Web3**: wagmi, viem libraries
- **The Graph**: Subgraph development

## For Administrators (Deploying & Hosting)

### Required

#### 1. Deployment Platform

Choose one:

**Option A: Vercel (Recommended)**
- Vercel account: [vercel.com](https://vercel.com/)
- GitHub/GitLab repository
- Free tier available

**Option B: Self-Hosted**
- Linux server (Ubuntu/Debian recommended)
- Node.js 18.17+ installed
- Web server (nginx/Apache)
- SSL certificate (Let's Encrypt)
- Domain name (optional)

#### 2. Subgraph Deployment

- The Graph Studio account
- Deployed TimelockController (with address and start block)
- Graph CLI installed: `npm install -g @graphprotocol/graph-cli`

#### 3. Environment Configuration

**Required environment variables**:
```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=...
```

**Optional but recommended**:
```bash
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=...    # Custom RPC endpoint
OPENAI_API_KEY=...                      # For AI explanations
```

See: [Environment Configuration](../developer-guide/environment-configuration.md)

### Recommended

#### Production Setup

- **Custom RPC endpoint**: Better reliability than public nodes
  - Run your own Rootstock node, or
  - Use premium RPC service

- **Monitoring**: Error tracking and analytics
  - Sentry for error tracking
  - Vercel Analytics or similar

- **Backup**: Redundancy for critical services
  - Multiple RPC endpoints
  - Backup subgraph instances

#### Security

- **HTTPS**: Required for wallet connections
- **Environment secrets**: Use platform secrets management
- **Regular updates**: Keep dependencies updated

## System Requirements

### Client (Browser)

**Minimum**:
- Modern browser (Chrome, Firefox, Brave, Edge)
- JavaScript enabled
- Cookies enabled (for localStorage)
- Stable internet connection

**Recommended**:
- Desktop/laptop (mobile works but limited)
- Screen resolution 1280x720 or higher
- Broadband internet (for fast loading)

### Server (Self-Hosted)

**Minimum**:
- 1 CPU core
- 512 MB RAM
- 1 GB storage
- Linux OS (Ubuntu 20.04+)

**Recommended**:
- 2+ CPU cores
- 2 GB RAM
- 5 GB storage
- Ubuntu 22.04 LTS

## Compatibility

### Networks

- ✅ Rootstock Mainnet (Chain ID 30)
- ✅ Rootstock Testnet (Chain ID 31)
- ❌ Ethereum (not compatible)
- ❌ Other EVM chains (not tested)

### Wallets

- ✅ MetaMask
- ✅ WalletConnect v2 compatible wallets
- ✅ Rabby
- ✅ Defiant
- ⚠️ Coinbase Wallet (may have issues)
- ❌ Wallet extensions without Rootstock support

### Browsers

- ✅ Chrome/Chromium 90+
- ✅ Firefox 90+
- ✅ Brave (latest)
- ✅ Edge 90+
- ⚠️ Safari (limited Web3 support)
- ❌ Internet Explorer (not supported)

## Checklist

Before proceeding, ensure you have:

### For Users
- [ ] Web3 wallet installed and configured
- [ ] Rootstock network added to wallet
- [ ] RBTC for gas fees (or testnet RBTC)
- [ ] Appropriate roles in TimelockController (if performing actions)

### For Developers
- [ ] Node.js 18.17+ installed
- [ ] npm installed
- [ ] Git installed
- [ ] WalletConnect Project ID obtained
- [ ] The Graph Studio account created

### For Administrators
- [ ] Deployment platform account (Vercel or server)
- [ ] Subgraph deployed and synced
- [ ] Environment variables configured
- [ ] Custom RPC endpoint (recommended)

## Getting Help

Can't meet a prerequisite?

- **Wallet issues**: See [Wallet Connection Issues](../troubleshooting/wallet-connection.md)
- **Network issues**: See [Network Errors](../troubleshooting/network-errors.md)
- **Developer setup**: See [Installation](../developer-guide/installation.md)
- **Deployment**: See [Deployment Guide](../deployment/README.md)

## Next Steps

Prerequisites met? Continue to:

- **Users**: [Quick Start](quick-start.md)
- **Developers**: [Installation](../developer-guide/installation.md)
- **Administrators**: [Subgraph Deployment](../subgraph-deployment/README.md)

---

**Ready to start?** → [Quick Start Guide](quick-start.md)
