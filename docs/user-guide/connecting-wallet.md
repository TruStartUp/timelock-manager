# Connecting Your Wallet

How to connect your Web3 wallet to Timelock Manager.

## Overview

Connecting your wallet allows you to:
- View your roles and permissions
- Schedule new operations (if you have PROPOSER_ROLE)
- Execute ready operations (if you have EXECUTOR_ROLE)
- Cancel pending operations (if you have CANCELLER_ROLE)

**Note**: You can browse and view operations without connecting a wallet.

## Supported Wallets

- **MetaMask**: Browser extension (recommended)
- **WalletConnect**: Mobile wallets via QR code
- **Rabby**: Multi-chain wallet
- **Coinbase Wallet**: Browser extension or mobile
- **Any WalletConnect v2 compatible wallet**

## Step-by-Step Connection

### 1. Click Connect Wallet

Click the **"Connect Wallet"** button in the top-right corner of the page.

[Screenshot placeholder: Connect wallet button location]

### 2. Select Your Wallet

A modal appears with wallet options:
- **MetaMask**: If installed, appears first
- **WalletConnect**: For mobile wallets
- **Other options**: Based on installed extensions

Click your preferred wallet.

[Screenshot placeholder: Wallet selection modal]

### 3. Approve Connection

In your wallet:
1. Review the connection request
2. Check the website URL is correct
3. Click "Connect" or "Approve"

**What you're approving**: Access to view your address (read-only)

**Security note**: Connection does NOT give the app permission to spend tokens or make transactions without your approval.

### 4. Add/Switch Network (if needed)

If you're not on Rootstock network, the app will prompt you:

**Option A: Add Network** (first time)
1. Wallet shows "Add network" request
2. Review network details:
   - Network: Rootstock Mainnet (or Testnet)
   - RPC URL: `https://public-node.rsk.co`
   - Chain ID: 30 (mainnet) or 31 (testnet)
3. Click "Approve" to add network

**Option B: Switch Network**
1. Wallet shows "Switch network" request
2. Click "Switch network"
3. Wallet changes to Rootstock

[Screenshot placeholder: Network switch prompt]

### 5. Connection Complete

Success indicators:
- Your address appears in top-right (truncated)
- Wallet icon changes from disconnected to connected
- Network badge shows "Rootstock Mainnet" or "Testnet"

[Screenshot placeholder: Connected wallet showing address]

## Network Configuration

### Rootstock Mainnet

```
Network Name: Rootstock Mainnet
RPC URL: https://public-node.rsk.co
Chain ID: 30
Currency Symbol: RBTC
Block Explorer: https://rootstock.blockscout.com
```

### Rootstock Testnet

```
Network Name: Rootstock Testnet
RPC URL: https://public-node.testnet.rsk.co
Chain ID: 31
Currency Symbol: tRBTC
Block Explorer: https://rootstock-testnet.blockscout.com
```

{% hint style="info" %}
The app automatically provides these details when prompting you to add the network.
{% endhint %}

## Switching Networks

To switch between mainnet and testnet:

1. Click network name in wallet
2. Select "Rootstock Mainnet" or "Rootstock Testnet"
3. App automatically updates to match

Or click "Switch Network" button if app detects mismatch.

## Disconnecting Wallet

To disconnect:
1. Click your address in top-right
2. Select "Disconnect" from menu

Or disconnect directly in your wallet settings.

## Troubleshooting

### "Connect button does nothing"

**Solutions**:
- Refresh the page
- Ensure wallet extension is installed and unlocked
- Check browser console for errors
- Try different browser

### "Wrong network" warning

**Cause**: Wallet is on different network

**Solution**:
- Click "Switch to Rootstock" button, or
- Manually switch in wallet

### "Connection rejected"

**Cause**: You declined connection in wallet

**Solution**: Click "Connect Wallet" again and approve

See: [Wallet Connection Issues](../troubleshooting/wallet-connection.md) for more help.

---

**Next**: [Configure your timelock](settings-configuration.md) → [Browse operations](operations-explorer.md)
