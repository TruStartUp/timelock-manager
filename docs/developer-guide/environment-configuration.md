# Environment Configuration

Complete reference for configuring environment variables in Timelock Manager.

## Overview

Timelock Manager uses environment variables for configuration. Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser; others are server-side only.

The only strictly required variable is `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`. By default the app reads on-chain data directly from Blockscout (no API key, no proxy), so a subgraph is optional. Everything else below is optional and enables or customizes specific features.

## Configuration File

Create `.env.local` in the project root (never commit this file):

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values.

## Required Variables

### NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

**Purpose**: WalletConnect Cloud project ID for RainbowKit wallet connections

**Format**: String (UUID-like)

**Example**:
```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123def456ghi789jkl012mno345pq
```

**How to get**:
1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com/)
2. Create account (free)
3. Create new project
4. Copy Project ID from dashboard

**Default**: `'YOUR_PROJECT_ID'` (placeholder - app will work but show warning)

**Required for**: Wallet connections (MetaMask works without, but WalletConnect requires it)

---

## Subgraph URLs (Optional)

Blockscout is the default data source, so these are optional. Set them only if you deploy a subgraph and want to use The Graph as the data source; leave them empty to read directly from Blockscout.

### NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL

**Purpose**: The Graph query URL for Rootstock testnet operations

**Format**: HTTPS URL to Graph Studio query endpoint

**Example**:
```bash
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/12345/rootstock-timelock-testnet/v0.0.1
```

**How to get**:
1. Deploy testnet subgraph to The Graph Studio
2. Copy "Queries (HTTP)" URL from deployment output
3. Or find in Studio dashboard → Subgraph → Details

**Optional**: If unset, testnet operations data is read directly from Blockscout

**See**: [Deploying to Testnet](../subgraph-deployment/deploying-testnet.md)

---

### NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL

**Purpose**: The Graph query URL for Rootstock mainnet operations

**Format**: HTTPS URL to Graph Studio query endpoint

**Example**:
```bash
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/12345/rootstock-timelock-mainnet/v0.0.1
```

**Optional**: If unset, mainnet operations data is read directly from Blockscout

**See**: [Deploying to Mainnet](../subgraph-deployment/deploying-mainnet.md)

---

## Optional Variables

### Network Configuration

#### NEXT_PUBLIC_RSK_MAINNET_RPC_URL

**Purpose**: Custom RPC endpoint for Rootstock mainnet

**Default**: `https://public-node.rsk.co`

**Example**:
```bash
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-custom-rpc.example.com
```

**When to use**: Production deployments for better reliability and rate limits

---

#### NEXT_PUBLIC_RSK_TESTNET_RPC_URL

**Purpose**: Custom RPC endpoint for Rootstock testnet

**Default**: `https://public-node.testnet.rsk.co`

**Example**:
```bash
NEXT_PUBLIC_RSK_TESTNET_RPC_URL=https://your-testnet-rpc.example.com
```

---

### Blockscout API URLs

#### NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL

**Purpose**: Custom Blockscout API endpoint for mainnet

**Default**: `https://rootstock.blockscout.com/api/v2`

**Example**:
```bash
NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL=https://custom-blockscout.example.com/api/v2
```

**When to use**: If running your own Blockscout instance

---

#### NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL

**Purpose**: Custom Blockscout API endpoint for testnet

**Default**: `https://rootstock-testnet.blockscout.com/api/v2`

---

### 4byte Directory

#### NEXT_PUBLIC_4BYTE_DIRECTORY_URL

**Purpose**: Function signature lookup service

**Default**: `https://www.4byte.directory/api/v1/`

**When to change**: If using alternative signature database

---

### Testnet Support

#### NEXT_PUBLIC_ENABLE_TESTNETS

**Purpose**: Enable testnet network in UI

**Format**: `"true"` or `"false"` (string)

**Default**: `false` (testnet hidden)

**Example**:
```bash
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

**Effect**: Shows Rootstock Testnet in network selector

---

### Documentation Link

#### NEXT_PUBLIC_DOCS_URL

**Purpose**: Override the base URL used for the in-app documentation links

**Default**: `https://github.com/TruStartUp/timelock-manager/tree/main/docs`

**Example**:
```bash
NEXT_PUBLIC_DOCS_URL=https://your-docs-site.example.com
```

**When to use**: If you host the documentation elsewhere (e.g. a custom docs site)

---

### OpenAI Integration (Optional)

#### OPENAI_API_KEY

**Purpose**: Enable AI-powered operation explanations

**Format**: OpenAI API key (string starting with `sk-proj-`)

**Security**: ⚠️ **SERVER-SIDE ONLY** (no `NEXT_PUBLIC_` prefix)

**Example**:
```bash
OPENAI_API_KEY=sk-proj-abc123def456...
```

**How to get**:
1. Go to [platform.openai.com](https://platform.openai.com/)
2. Create account
3. Go to API Keys
4. Create new secret key

**Cost**: Pay-as-you-go (operations explanations use ~500-1000 tokens each)

**Optional**: App works fully without this

**When enabled**: "Explain with AI" buttons are active in Operations Explorer and Decoder

**When unset**: The "Explain with AI" button is disabled (the key is never exposed to the browser)

---

#### OPENAI_MODEL

**Purpose**: Specify which OpenAI model to use

**Default**: `gpt-5-nano`

**Example**:
```bash
OPENAI_MODEL=gpt-5-nano
```

**Options**: Any OpenAI chat model (`gpt-4o`, `gpt-4o-mini`, etc.)

**Cost consideration**: Larger models = better explanations but higher cost

---

## Configuration Profiles

### Minimal (Development) — Default

For local development reading directly from Blockscout (the default data source):

```bash
# .env.local
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

**Functionality**:
- ✅ Wallet connection works
- ✅ Operations load (directly from Blockscout)
- ❌ No AI explanations

---

### Optional (Development with Subgraph)

For local development using a deployed subgraph instead of Blockscout:

```bash
# .env.local
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

**Functionality**:
- ✅ Operations queries served by the subgraph
- ✅ Full feature set
- ❌ No AI explanations

---

### Complete (Production)

Full production configuration:

```bash
# .env.local (or Vercel environment variables)

# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Subgraphs (optional — omit to read directly from Blockscout)
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../mainnet/...
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../testnet/...

# Custom RPC (recommended for production)
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-dedicated-rpc.com

# Optional: AI features
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5-nano

# Optional: Testnet support
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

**Functionality**: All features enabled

---

## Platform-Specific Configuration

### Vercel

Set environment variables in Vercel dashboard:

1. Go to Project → Settings → Environment Variables
2. Add each variable
3. Select environments (Production, Preview, Development)
4. Redeploy for changes to take effect

**Important**: Changing `NEXT_PUBLIC_*` variables requires rebuild

---

### Docker

Pass via `docker run`:

```bash
docker run \
  -e NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123 \
  -e NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://... \
  -p 3000:3000 \
  timelock-manager
```

Or use `.env` file with `docker-compose`:

```yaml
services:
  app:
    image: timelock-manager
    env_file: .env
    ports:
      - "3000:3000"
```

---

## Validation

### Check Current Configuration

In browser console:

```javascript
// Check public variables
console.log(process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID)
console.log(process.env.NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL)

// Server-side variables are undefined in browser
console.log(process.env.OPENAI_API_KEY) // undefined (correct)
```

### Test Configuration

1. **WalletConnect**: Try connecting wallet (should work if ID is set)
2. **Subgraph**: Check Operations Explorer (if URL is set, loads fast)
3. **AI**: Look for "Explain" buttons (if API key is set)

---

## Security Best Practices

### Never Commit Secrets

❌ **Never commit** `.env.local` or `.env.production`

✅ **Do commit** `.env.example` (with placeholders)

Add to `.gitignore`:
```
.env.local
.env*.local
.env.production
```

---

### Public vs Private Variables

**Public (NEXT_PUBLIC_*)**: Exposed to browser
- ✅ Safe: API endpoints, feature flags, public URLs
- ❌ Unsafe: API keys, secrets, private credentials

**Private (no prefix)**: Server-side only
- ✅ Safe: OpenAI API key, database credentials
- ⚠️ Never accessible in browser code

---

### API Key Rotation

Regularly rotate sensitive keys:
- OpenAI API key: Rotate monthly
- WalletConnect Project ID: Rotate if compromised

---

## Troubleshooting

### "WalletConnect Project ID required"

**Cause**: Missing or invalid `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

**Solution**:
1. Check `.env.local` has correct variable name
2. Restart dev server (`npm run dev`)
3. Verify Project ID from WalletConnect Cloud

---

### "Subgraph unavailable, using Blockscout"

**Cause**: A subgraph URL is set but the subgraph is unreachable. This is informational — Blockscout is the default data source, so operations still load.

**Solution** (only if you intend to use a subgraph):
1. Check `NEXT_PUBLIC_RSK_*_SUBGRAPH_URL` is set
2. Verify URL is correct (copy from Graph Studio)
3. Check subgraph is deployed and synced
4. Restart app

---

### Environment changes not applying

**Cause**: Next.js caches environment variables

**Solution**:
1. Stop dev server
2. Delete `.next` folder: `rm -rf .next`
3. Restart: `npm run dev`

---

## Reference

Complete variable list with defaults:

```bash
# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=

# Subgraphs (optional — empty = read directly from Blockscout)
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=

# RPC Endpoints (optional)
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://public-node.rsk.co
NEXT_PUBLIC_RSK_TESTNET_RPC_URL=https://public-node.testnet.rsk.co

# Blockscout (optional — defaults below; browser calls Blockscout directly)
NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL=https://rootstock.blockscout.com/api/v2
NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL=https://rootstock-testnet.blockscout.com/api/v2

# 4byte (optional)
NEXT_PUBLIC_4BYTE_DIRECTORY_URL=https://www.4byte.directory/api/v1/

# Docs link (optional)
NEXT_PUBLIC_DOCS_URL=https://github.com/TruStartUp/timelock-manager/tree/main/docs

# Features (optional)
NEXT_PUBLIC_ENABLE_TESTNETS=false

# OpenAI (optional, server-side only)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
```

---

**See also**:
- [Environment Variables Reference](../reference/environment-variables.md) - Full reference
- [Installation](installation.md) - Setup guide
- [Deployment](../deployment/environment-variables.md) - Production configuration
