# Production Deployment Checklist

Use this checklist when promoting from staging to production.

## Configuration

- [ ] WalletConnect
  - [ ] `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` set for production domain
- [ ] Subgraphs
  - [ ] `NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL` set (Rootstock mainnet)
  - [ ] `NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL` set (optional in prod, but recommended)
- [ ] RPC endpoints
  - [ ] `NEXT_PUBLIC_RSK_MAINNET_RPC_URL` set (use a reliable provider for production)
  - [ ] `NEXT_PUBLIC_RSK_TESTNET_RPC_URL` set (optional)
- [ ] Blockscout endpoints (optional overrides)
  - [ ] `NEXT_PUBLIC_RSK_MAINNET_BLOCKSCOUT_URL`
  - [ ] `NEXT_PUBLIC_RSK_TESTNET_BLOCKSCOUT_URL`
- [ ] 4byte directory (optional override)
  - [ ] `NEXT_PUBLIC_4BYTE_DIRECTORY_URL`

## Build / deploy

- [ ] `npm run build` succeeds locally
- [ ] Vercel production deploy succeeds
- [ ] No console errors on first load

## Smoke tests (production)

- [ ] Wallet connects and shows correct address/balance
- [ ] Wrong network banner appears on unsupported chain and disables actions
- [ ] Operations Explorer loads operations (subgraph) for a known mainnet timelock
- [ ] Blockscout fallback works when subgraph is temporarily unavailable
- [ ] Pagination and virtual scrolling behave correctly
- [ ] Execute/Cancel dialogs show simulation preview and clear error states
- [ ] Scheduling requires PROPOSER_ROLE + delay ≥ minDelay and shows tx hash + operation id after success
- [ ] Permissions view shows role holders + history
- [ ] Decoder works and shows confidence indicators

## Post-deploy

- [ ] Verify subgraph indexing health (no indexing errors)
- [ ] Verify rate limiting behavior for Blockscout (no UI lockups under load)
- [ ] Confirm support contacts / ownership (who rotates keys, who updates env vars)


