# User Guide Overview

Welcome to the Timelock Manager user guide. This section provides complete documentation for all user-facing features and workflows.

## Who Is This For?

This guide is designed for governance participants, DAO members, and anyone who needs to interact with TimelockController contracts through the Timelock Manager interface.

## What You'll Learn

* How to connect your wallet and configure timelocks
* Browse and filter operations in the Operations Explorer
* Schedule new proposals using the step-by-step wizard
* Execute ready operations and cancel pending ones
* Decode and verify calldata before execution
* Understand roles and view permission grants
* Configure application settings and custom ABIs

## Guide Structure

### Getting Started

1. [Connecting Your Wallet](connecting-wallet.md) - Set up wallet connection with RainbowKit
2. [Dashboard Overview](dashboard.md) - Understand the main dashboard and statistics
3. [Settings & Configuration](settings-configuration.md) - Configure timelocks and preferences

### Working with Operations

4. [Operations Explorer](operations-explorer.md) - Browse, filter, and search operations
5. [Executing Operations](executing-operations.md) - Execute ready operations safely
6. [Cancelling Operations](cancelling-operations.md) - Cancel pending operations
7. [Calldata Decoder](calldata-decoder.md) - Decode and verify operation calldata

### Governance Participation

8. [Creating Proposals](creating-proposals.md) - Schedule new operations with the proposal wizard
9. [Understanding Roles](understanding-roles.md) - Learn about governance roles and permissions
10. [Viewing Permissions](viewing-permissions.md) - View role grants and member history

## Prerequisites

Before using Timelock Manager, ensure you have:

* A Web3 wallet (MetaMask, WalletConnect-compatible, etc.)
* Connection to Rootstock network (mainnet or testnet)
* Appropriate roles for the actions you want to perform
* Basic understanding of governance and timelock concepts

{% hint style="info" %}
If you're new to governance or timelocks, start with [Understanding Roles](understanding-roles.md) to learn about the permission system.
{% endhint %}

## Common Workflows

### As a Proposer

1. Connect wallet → Configure timelock
2. Create new proposal → Enter contract details → Schedule operation
3. Monitor proposal status in Operations Explorer

### As an Executor

1. Connect wallet → Navigate to Operations Explorer
2. Filter for "Ready" operations
3. Review operation details and decoded calldata
4. Execute operation after verification

### As a Security Reviewer

1. Browse all operations in Operations Explorer
2. Use Decoder to verify calldata
3. Check for high-risk functions
4. Review role grants in Permissions page

## Need Help?

* **Troubleshooting**: See [Common Errors & FAQ](../troubleshooting/common-errors.md)
* **Security**: Review [Best Practices](../security/best-practices.md)
* **Technical Details**: Check [Architecture](../architecture/architecture.md)
* **Glossary**: Unfamiliar terms? See [Glossary](../reference/glossary.md)

***

**Ready to start?** Begin with [Connecting Your Wallet](connecting-wallet.md).
