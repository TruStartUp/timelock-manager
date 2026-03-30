# Integrations

Documentation for all external services and APIs integrated with Timelock Manager.

## Overview

Timelock Manager integrates with multiple external services to provide a complete governance experience. This section documents how each integration works, how to configure it, and how to troubleshoot issues.

## Integration Guides

1. [The Graph Integration](the-graph.md) - Primary data source for indexed operations
2. [Blockscout API](blockscout-api.md) - ABI resolution and fallback data source
3. [4byte Directory](fourbyte-directory.md) - Function signature lookup service
4. [WalletConnect](walletconnect.md) - Wallet connection protocol
5. [OpenAI Explanations](openai-explanations.md) - AI-powered operation explanations
6. [Custom RPC Endpoints](custom-rpc-endpoints.md) - Configure custom blockchain RPC

## Integration Architecture

```
┌──────────────────────────────────────────────┐
│         Timelock Manager Application         │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ The Graph│  │Blockscout│  │  wagmi   │  │
│  │  Client  │  │  Client  │  │  (RPC)   │  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  │
│        │             │              │        │
└────────┼─────────────┼──────────────┼────────┘
         │             │              │
    ┌────▼────┐   ┌────▼────┐    ┌───▼────┐
    │The Graph│   │Blockscout│   │Rootstock│
    │ Studio  │   │Explorer  │   │   RPC   │
    └─────────┘   └──────┬──┘    └─────────┘
                         │
                    ┌────▼────┐
                    │ 4byte   │
                    │Directory│
                    └─────────┘
```

## Primary vs Fallback Services

### Primary Services (Always Used)
- **wagmi/viem**: Blockchain interaction (RPC)
- **RainbowKit**: Wallet connection UI
- **The Graph**: Operation data (when available)

### Secondary Services (Conditional)
- **Blockscout**: Fallback when subgraph unavailable, ABI resolution
- **4byte Directory**: Fallback for function signature lookup

### Optional Services
- **OpenAI**: AI explanations (requires API key)
- **Custom RPC**: Alternative to public endpoints

## Integration Overview

### The Graph (Primary Data Source)

**Purpose**: Fast, indexed queries for operations and roles

**Configuration**:
```bash
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
```

**Features**:
- GraphQL queries
- Real-time indexing
- Complex filtering
- Aggregations

**Limitations**:
- Requires deployment
- Sync lag on initial deploy
- May be unavailable during issues

See: [The Graph Integration](the-graph.md)

---

### Blockscout (Fallback & ABI Source)

**Purpose**: Contract verification, ABI fetching, event fallback

**Configuration**:
```bash
# Defaults to public Blockscout instances
NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL=https://rootstock.blockscout.com/api/v2
NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL=https://rootstock-testnet.blockscout.com/api/v2
```

**Features**:
- Contract verification status
- Verified contract ABIs
- Proxy detection
- Event log fetching
- Transaction details

**Limitations**:
- Rate limited (~10 RPS)
- Slower than subgraph
- No complex queries

See: [Blockscout API](blockscout-api.md)

---

### 4byte Directory (Signature Fallback)

**Purpose**: Function signature lookup for unverified contracts

**Configuration**:
```bash
# Defaults to public service
NEXT_PUBLIC_4BYTE_DIRECTORY_URL=https://www.4byte.directory/api/v1/
```

**Features**:
- Function selector → signature mapping
- Community-maintained database
- Free and open

**Limitations**:
- Low confidence (guesses)
- May have collisions
- Not always accurate
- Last resort only

See: [4byte Directory](fourbyte-directory.md)

---

### WalletConnect (Wallet Connection)

**Purpose**: Enable wallet connections via QR code and deep links

**Configuration**:
```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123...
```

**Get Project ID**: [cloud.walletconnect.com](https://cloud.walletconnect.com/)

**Features**:
- Mobile wallet support
- QR code connection
- Multi-wallet support
- Secure authentication

**Limitations**:
- Requires project ID
- Network connectivity required

See: [WalletConnect](walletconnect.md)

---

### OpenAI (Optional AI Features)

**Purpose**: Generate human-readable explanations of operations

**Configuration**:
```bash
# Server-side only (never exposed to client)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5-nano
```

**Features**:
- Operation summaries
- Per-call explanations
- Parameter interpretation
- Risk assessment

**Limitations**:
- Requires API key and budget
- Server-side only
- Not always accurate
- Optional feature

See: [OpenAI Explanations](openai-explanations.md)

---

### Custom RPC Endpoints

**Purpose**: Use your own RPC provider for better reliability

**Configuration**:
```bash
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-rpc-endpoint.com
NEXT_PUBLIC_RSK_TESTNET_RPC_URL=https://your-testnet-rpc.com
```

**Benefits**:
- Higher rate limits
- Better uptime
- Lower latency
- More control

**Providers**:
- Run your own Rootstock node
- Use premium RPC service
- Company infrastructure

See: [Custom RPC Endpoints](custom-rpc-endpoints.md)

## Rate Limits & Quotas

| Service | Rate Limit | Quota | Cost |
|---------|-----------|-------|------|
| The Graph | High (GraphQL) | Free tier available | Free for Studio |
| Blockscout | ~10 RPS | Public use | Free |
| 4byte Directory | Moderate | Public use | Free |
| WalletConnect | High | Free tier available | Free basic |
| OpenAI | Per API key | Pay-as-you-go | Paid |
| Custom RPC | Depends on provider | Depends on provider | Varies |

**Note**: Timelock Manager implements client-side rate limiting for Blockscout (6.6 RPS) to stay well under limits.

## Resilience & Fallbacks

### Data Fetching Hierarchy

1. **Try The Graph**: Fast indexed data
   - If unavailable → Fall back to Blockscout events

2. **Try Blockscout**: Raw event logs
   - If rate limited → Queue requests
   - If failed → Show error, retry with backoff

### ABI Resolution Hierarchy

1. **User-provided ABI**: Highest confidence
2. **Blockscout verified**: High confidence
3. **4byte directory**: Low confidence (guesses)
4. **Cannot decode**: Show raw hex

### Error Handling

All integrations implement:
- Exponential backoff on failures
- Maximum retry attempts
- Graceful degradation
- User-friendly error messages
- Detailed logging for debugging

## Monitoring Integration Health

### Check Integration Status

**The Graph**:
- Studio dashboard → Deployment status
- App console → "Subgraph unavailable" warnings

**Blockscout**:
- Visit API URL in browser
- Check for 429 (rate limit) errors in console

**RPC**:
- Settings page → Test Connection button
- Wagmi connection errors

**4byte**:
- Console warnings about "guessed signatures"
- ABI confidence badges in UI

### Common Integration Issues

**Subgraph not syncing** → See [Troubleshooting Subgraphs](../subgraph-deployment/troubleshooting-subgraph.md)

**Blockscout rate limits** → Client automatically queues requests

**RPC connection failures** → Check [Network Errors](../troubleshooting/network-errors.md)

**ABI resolution fails** → See [ABI Resolution Errors](../troubleshooting/abi-resolution-errors.md)

## Best Practices

### For Production Deployments

1. **Deploy your own subgraph** - Don't rely on shared instances
2. **Use custom RPC** - Better reliability than public endpoints
3. **Monitor quotas** - Track API usage for paid services
4. **Implement caching** - Reduce external service calls
5. **Have fallbacks** - App works even if services are down

### For Development

1. **Use testnet first** - Easier to debug
2. **Check rate limits** - Don't hit APIs too hard
3. **Cache aggressively** - Faster iteration
4. **Monitor console** - Catch integration errors early

## Configuration Examples

### Minimal (Development)

```bash
# Just wallet connection
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

App works with Blockscout fallback only.

### Recommended (Production)

```bash
# Wallet
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123

# Subgraphs
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...

# Custom RPC
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-rpc.com

# AI Features
OPENAI_API_KEY=sk-proj-...
```

### Complete (All Features)

```bash
# Wallet
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123

# Subgraphs
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...

# Custom RPC
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-mainnet-rpc.com
NEXT_PUBLIC_RSK_TESTNET_RPC_URL=https://your-testnet-rpc.com

# Custom Blockscout (optional)
NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL=https://custom-blockscout.com/api/v2

# AI Features
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5-nano

# Testnets
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

## Related Documentation

- **Developer Guide**: [Environment Configuration](../developer-guide/environment-configuration.md)
- **Architecture**: [Dual Data Sources](../architecture/dual-data-sources.md)
- **Reference**: [Environment Variables](../reference/environment-variables.md)
- **Troubleshooting**: [Network Errors](../troubleshooting/network-errors.md)

---

**Explore integrations**: [The Graph](the-graph.md) | [Blockscout](blockscout-api.md) | [OpenAI](openai-explanations.md)
