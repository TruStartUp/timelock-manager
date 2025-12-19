# Timelock Manager Documentation

Welcome to the comprehensive documentation for **Timelock Manager**, a complete governance interface for OpenZeppelin TimelockController contracts on Rootstock networks.

## What is Timelock Manager?

Timelock Manager is a Next.js Web3 application that provides a user-friendly interface for managing timelock-based governance operations. It enables governance participants to schedule, review, execute, and cancel operations with full visibility into the governance process.

[Screenshot placeholder: Dashboard overview showing operations and roles]

## Key Features

- **Operations Explorer**: Browse, filter, and search all timelock operations with advanced filtering capabilities
- **Proposal Wizard**: Step-by-step interface for scheduling new operations with automatic ABI resolution
- **Calldata Decoder**: Recursively decode complex operations with AI-powered explanations
- **Role Management**: View and audit role grants, members, and permission history
- **Multi-Timelock Support**: Manage multiple TimelockController contracts from a single interface
- **Dual Data Sources**: Seamless fallback between The Graph subgraphs and Blockscout API
- **Transaction Simulation**: Preview execution results before submitting transactions
- **Security Features**: High-risk function detection, verification workflows, and audit trails

## Quick Start

Get up and running in minutes:

1. [Install dependencies and configure environment variables](getting-started/quick-start.md)
2. [Deploy The Graph subgraph for your timelock](subgraph-deployment/deploying-testnet.md)
3. [Connect your wallet and configure your timelock](user-guide/connecting-wallet.md)
4. [Start exploring operations](user-guide/operations-explorer.md)

## Documentation Structure

### For Governance Participants

If you're using Timelock Manager to participate in governance, start here:

- [Connecting Your Wallet](user-guide/connecting-wallet.md)
- [Dashboard Overview](user-guide/dashboard.md)
- [Operations Explorer Guide](user-guide/operations-explorer.md)
- [Creating Proposals](user-guide/creating-proposals.md)
- [Understanding Roles & Permissions](user-guide/understanding-roles.md)

### For Developers & Administrators

If you're setting up or customizing Timelock Manager:

- [Installation Guide](developer-guide/installation.md)
- [Environment Configuration](developer-guide/environment-configuration.md)
- [Deploying Subgraphs](subgraph-deployment/README.md)
- [Project Structure](developer-guide/project-structure.md)
- [Architecture Overview](architecture/README.md)

### For Security Auditors

For those reviewing governance operations and security:

- [Security Best Practices](security/best-practices.md)
- [Verifying Operations](security/verifying-operations.md)
- [Dangerous Operations](security/dangerous-operations.md)
- [Audit Trail](security/audit-trail.md)

## Common Tasks

### I want to...

- **Execute a ready operation** → [Executing Operations](user-guide/executing-operations.md)
- **Schedule a new proposal** → [Creating Proposals](user-guide/creating-proposals.md)
- **Decode unknown calldata** → [Calldata Decoder](user-guide/calldata-decoder.md)
- **View who has roles** → [Viewing Permissions](user-guide/viewing-permissions.md)
- **Deploy a subgraph** → [Subgraph Deployment](subgraph-deployment/deploying-testnet.md)
- **Fix subgraph issues** → [Troubleshooting Subgraphs](troubleshooting/subgraph-issues.md)
- **Configure custom RPC** → [Custom RPC Endpoints](integrations/custom-rpc-endpoints.md)
- **Understand the architecture** → [Architecture Overview](architecture/README.md)

## Support

- **Troubleshooting**: Check our [Troubleshooting Guide](troubleshooting/README.md) for common issues
- **Glossary**: Unfamiliar terms? See the [Glossary](reference/glossary.md)
- **Contributing**: Interested in contributing? Read our [Contributing Guide](contributing/README.md)

## Technology Stack

Timelock Manager is built with modern Web3 technologies:

- **Framework**: Next.js 14 (Pages Router)
- **Web3**: wagmi, viem, RainbowKit
- **Data**: The Graph, Blockscout API, TanStack Query
- **Blockchain**: Rootstock (RSK) Mainnet & Testnet
- **Styling**: Tailwind CSS

For complete tech stack details, see [Tech Stack](developer-guide/tech-stack.md).

## Next Steps

Choose your path:

<table>
  <tr>
    <td><b>New User?</b><br/>Start with <a href="getting-started/quick-start.md">Quick Start</a></td>
    <td><b>Developer?</b><br/>Begin with <a href="developer-guide/installation.md">Installation</a></td>
  </tr>
  <tr>
    <td><b>Administrator?</b><br/>Deploy a <a href="subgraph-deployment/README.md">Subgraph</a></td>
    <td><b>Auditor?</b><br/>Review <a href="security/best-practices.md">Security Practices</a></td>
  </tr>
</table>

---

**Ready to get started?** Head to the [Quick Start Guide](getting-started/quick-start.md) or explore the documentation sections above.
