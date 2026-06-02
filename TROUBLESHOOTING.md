# Troubleshooting

Common errors when **running** or **using** the app, and how to fix them. Most are solved by
running a command or adjusting your wallet — no code changes required.

> If you hit an error that isn't listed here, open an issue with the exact message and the
> screen where it happened.

---

## 1. "Failed to compile contract: Compile failed (exit 127): sh: hardhat: command not found"

**Where:** the **Deploy Timelock** screen (`/deploy_timelock`), when clicking **Deploy Timelock**.

**Cause:** the deploy flow compiles the `TimelockController` contract with Hardhat in the
`contracts/` project. The root `npm install` does **not** install `contracts/` dependencies, so
if you never ran the build, Hardhat isn't available and compilation fails with `exit 127`
("command not found").

**Fix — run once:**

```bash
npm run build:contracts
```

This installs the `contracts/` dependencies and compiles the `TimelockController`, generating the
artifact (`contracts/artifacts/contracts/Timelock.sol/Timelock.json`) that the app uses to deploy.
After this, the **Deploy Timelock** button works.

> The full build (`npm run build`) also does this, since it runs `build:contracts` internally. On
> a production deploy (Vercel/hosting) this already happens during the build, so you'll only see
> this error in local development (`npm run dev`).

---

## 2. Deploy fails with "RPC submit: Internal server error" (code -32603)

**Where:** **after** compilation succeeds, when your wallet (MetaMask) tries to **send** the
deploy transaction.

**Cause:** this is **not** an app or contract problem (the transaction is valid). The Rootstock
RPC node rejected the submission. It's almost always one of these three:

1. **Wrong network in the wallet** — MetaMask is on Rootstock Mainnet when you meant testnet (or
   vice versa).
2. **No funds** — the account has no (t)RBTC to pay for gas. (A Timelock deploy costs ~2.5M gas.)
3. **Flaky public node** — RSK public nodes occasionally return transient internal errors.

**Fix:**

1. In MetaMask, **switch to the correct Rootstock network**:
   - **Testnet** (chainId **31**) for testing.
   - Mainnet (chainId **30**) only for real production.
2. Make sure the account has **(t)RBTC** for gas.
   - Testnet faucet: <https://faucet.rootstock.io/>
3. Click **Deploy Timelock** again.
4. If it keeps failing with `-32603` on testnet, **retry** (it's usually the public node). If it
   persists, change the **RPC URL** for the Rootstock network in MetaMask to a more reliable one,
   e.g. Rootstock RPC: `https://rpc.testnet.rootstock.io/<YOUR_API_KEY>`.

> **Checklist before deploying a timelock:** wallet connected → network = Rootstock Testnet (31)
> → account has tRBTC → click Deploy.

---

## 3. (Already fixed in code) "HHE201 ... missing peer dependency hardhat-ignition-viem"

If you're on an **old** checkout of the repo, you might see this error when compiling the
contract. It's already resolved in the current version (the unnecessary `hardhat-toolbox-viem`
plugin was removed from the Hardhat config).

**Fix:**

```bash
git pull
npm run build:contracts
```

---

## Handy command reference

| Command | What it does |
|---|---|
| `npm install` | Installs the app's dependencies (root). |
| `npm run build:contracts` | Installs `contracts/` deps and compiles the TimelockController. Required to use **Deploy Timelock** in dev. |
| `npm run dev` | Starts the development server at <http://localhost:3000>. |
| `npm run build` | Production build (includes `build:contracts`). |
| `npm test` | Runs the tests. |
