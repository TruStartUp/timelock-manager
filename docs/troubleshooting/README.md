# Troubleshooting Guide

Solutions to common problems and issues when using Timelock Manager.

## Quick Diagnosis

Having an issue? Find your problem category:

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| Can't connect wallet | Network/wallet config | [Wallet Connection Issues](wallet-connection.md) |
| No operations loading | Subgraph down/misconfigured | [Subgraph Issues](subgraph-issues.md) |
| Transaction fails | Permissions/timing/gas | [Transaction Failures](transaction-failures.md) |
| Can't decode calldata | Missing ABI | [ABI Resolution Errors](abi-resolution-errors.md) |
| "Permission denied" error | Missing role | [Permission Errors](permission-errors.md) |
| Network errors | RPC issues | [Network Errors](network-errors.md) |

## Troubleshooting Guides

### Connection & Network
- [Wallet Connection Issues](wallet-connection.md) - Cannot connect wallet, wrong network, etc.
- [Network Errors](network-errors.md) - RPC failures, timeout errors, chain mismatches

### Data & Operations
- [Subgraph Issues](subgraph-issues.md) - Operations not loading, stale data, sync problems
- [ABI Resolution Errors](abi-resolution-errors.md) - Cannot decode calldata, ABI fetch failures
- [Transaction Failures](transaction-failures.md) - Execution reverts, gas issues, simulation failures

### Permissions & Access
- [Permission Errors](permission-errors.md) - "Access denied", missing roles, authorization failures

### General
- [Common Errors & FAQ](common-errors.md) - Frequently asked questions and quick solutions

## General Troubleshooting Steps

### Step 1: Check the Basics

```bash
# Verify environment variables are set
cat .env.local | grep NEXT_PUBLIC

# Check you're on correct network
# Open browser console and check network ID

# Restart the app
npm run dev
```

### Step 2: Check Browser Console

Open DevTools (F12) and look for:
- Red error messages in Console tab
- Failed network requests in Network tab
- React error boundaries

### Step 3: Verify Configuration

- **Wallet**: Connected to Rootstock (mainnet 30 or testnet 31)?
- **Timelock**: Configured in Settings?
- **Subgraph**: URL correct in `.env.local`?
- **RPC**: Custom RPC endpoint working?

### Step 4: Check External Services

- **The Graph**: Is your subgraph synced? Check Studio dashboard
- **Blockscout**: Is Blockscout API responding? Visit in browser
- **RPC**: Is your RPC endpoint healthy? Check status page

## Common Error Patterns

### "Subgraph unavailable, using Blockscout"

**Cause**: The Graph subgraph is down or misconfigured

**Solution**: See [Subgraph Issues](subgraph-issues.md)

**Workaround**: App automatically falls back to Blockscout (slower but functional)

---

### "User rejected the request"

**Cause**: User cancelled transaction in wallet

**Solution**: Re-try the action and approve in wallet

---

### "Insufficient permissions"

**Cause**: Connected wallet doesn't have required role

**Solution**: See [Permission Errors](permission-errors.md)

**Check**: Visit Permissions page to verify your roles

---

### "Execution reverted"

**Cause**: Transaction simulation failed

**Possible reasons**:
- Operation not yet ready (timestamp in future)
- Already executed or cancelled
- Missing executor role
- Target contract will revert

**Solution**: See [Transaction Failures](transaction-failures.md)

---

### "Network request failed"

**Cause**: Cannot reach RPC endpoint or external service

**Solution**: See [Network Errors](network-errors.md)

**Check**:
- Internet connection
- RPC endpoint status
- Firewall/proxy settings

## Debug Mode

Enable verbose logging:

```javascript
// In browser console
localStorage.setItem('DEBUG', 'timelock:*')
location.reload()
```

This enables detailed console logs for debugging.

## Still Stuck?

If none of these guides solve your issue:

1. **Check the logs**: Browser console (F12) → Console tab
2. **Try testnet**: Easier to debug with testnet
3. **Simplify**: Try with minimal configuration
4. **Search docs**: Use GitBook search for specific errors
5. **Check GitHub**: Look for similar issues in repository

## Getting Help

When asking for help, please include:

- **Error message**: Exact error text from console
- **Environment**: Mainnet/testnet, browser, wallet
- **Configuration**: Env vars (redact sensitive info)
- **Steps to reproduce**: What actions led to the error
- **Screenshots**: If applicable

## Related Documentation

- **User Guide**: [User Guide](../user-guide/README.md)
- **Developer Guide**: [Developer Guide](../developer-guide/README.md)
- **Subgraph Deployment**: [Subgraph Deployment](../subgraph-deployment/README.md)
- **Reference**: [Error Codes](../reference/error-codes.md)

---

**Find your issue**: Use the table above or browse the troubleshooting guides.
