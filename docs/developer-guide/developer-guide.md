# Developer Overview

Comprehensive guide for developers working with Timelock Manager, including setup, configuration, architecture, and development workflows.

## Who Is This For?

This guide is for developers who want to:

* Set up a local development environment
* Understand the codebase architecture
* Contribute new features or fixes
* Deploy and customize their own instance
* Integrate Timelock Manager into their workflow

## What You'll Learn

* How to install and run Timelock Manager locally
* Configure environment variables and integrations
* Understand the project structure and tech stack
* Run tests and maintain code quality
* Deploy to production environments

## Quick Start for Developers

```bash
# Clone the repository
git clone <repository-url>
cd timelock-manager

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the app.

## Guide Structure

1. [Installation](installation.md) - Set up local development environment
2. [Environment Configuration](environment-configuration.md) - Configure env variables and API keys
3. [Running Locally](running-locally.md) - Development server and available commands
4. [Project Structure](project-structure.md) - Codebase organization and key directories
5. [Tech Stack](tech-stack.md) - Technologies, libraries, and frameworks used
6. [Testing](testing.md) - Running tests and writing new ones

## Prerequisites

### Required Software

* **Node.js**: v18.17 or higher
* **npm**: v9 or higher
* **Git**: For version control

### Required Accounts

* **WalletConnect Cloud**: Project ID for RainbowKit
* **The Graph Studio**: For deploying subgraphs (optional for development)

### Recommended Tools

* **VS Code**: With ESLint and Prettier extensions
* **MetaMask**: For testing wallet connections
* **Rootstock Testnet**: RBT

C for testing

## Development Workflow

```
┌─────────────────┐
│   Clone Repo    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Install Deps   │
└────────┬────────┘
         │
┌────────▼────────┐
│  Configure Env  │
└────────┬────────┘
         │
┌────────▼────────┐
│   Run Dev       │
└────────┬────────┘
         │
┌────────▼────────┐
│  Make Changes   │
└────────┬────────┘
         │
┌────────▼────────┐
│   Run Tests     │
└────────┬────────┘
         │
┌────────▼────────┐
│  Submit PR      │
└─────────────────┘
```

## Key Technologies

* **Next.js 14**: React framework with Pages Router
* **TypeScript**: Type-safe development
* **wagmi & viem**: Web3 React hooks and Ethereum library
* **RainbowKit**: Wallet connection UI
* **TanStack Query**: Data fetching and caching
* **The Graph**: Blockchain indexing
* **Tailwind CSS**: Utility-first styling

For complete details, see [Tech Stack](tech-stack.md).

## Project Principles

### Code Quality

* **TypeScript**: All code is type-safe
* **ESLint**: Enforced code standards
* **Prettier**: Consistent formatting
* **Vitest**: Comprehensive test coverage

### Architecture Patterns

* **Hooks-based**: React hooks for state and data
* **Context providers**: Shared state management
* **Service layer**: Separate API logic from UI
* **Dual data sources**: Resilient fallback strategy

### Best Practices

* Component composition over inheritance
* Server and client component separation
* Optimistic UI updates with cache invalidation
* Error boundaries and graceful degradation

## Common Development Tasks

### Adding a New Page

1. Create page in `src/pages/`
2. Create corresponding component in `src/components/`
3. Add route to navigation in `src/components/common/Layout.tsx`
4. Update tests

### Adding a New Hook

1. Create hook file in `src/hooks/`
2. Use TanStack Query for data fetching
3. Include proper cache keys and invalidation
4. Write unit tests

### Adding a New Integration

1. Create service in `src/services/`
2. Implement rate limiting and error handling
3. Add caching strategy
4. Document in integration guides

## Environment Setup

Minimal `.env.local` for development:

```bash
# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Optional (for full functionality)
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...
NEXT_PUBLIC_ENABLE_TESTNETS=true

# Optional (for AI features)
OPENAI_API_KEY=sk-proj-...
```

See [Environment Configuration](environment-configuration.md) for complete reference.

## Need Help?

* **Architecture Questions**: See [Architecture Overview](../architecture/architecture.md)
* **Subgraph Issues**: Check [Subgraph Deployment](../subgraph-deployment/subgraph-deployment.md)
* **Contributing**: Read [Contributing Guide](../contributing/contributing.md)
* **Troubleshooting**: Visit [Troubleshooting](../troubleshooting/troubleshooting.md)

***

**Ready to develop?** Start with [Installation](installation.md).
