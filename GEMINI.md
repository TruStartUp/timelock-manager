# GEMINI.md

## Project Overview

This project is a **Rootstock Timelock Management App**, a Web3 governance application designed to explore and manage OpenZeppelin TimelockController contracts on Rootstock networks (mainnet and testnet).

The application provides a user-friendly interface for:

- **Exploring Operations:** Viewing pending, ready, executed, and cancelled operations.
- **Managing Roles:** Auditing which addresses hold PROPOSER, EXECUTOR, CANCELLER, and ADMIN roles.
- **Executing/Cancelling Operations:** Allowing authorized users to execute or cancel operations.
- **Scheduling Proposals:** Providing a user-friendly wizard to build and schedule new operations.
- **Decoding Calldata:** Offering a tool to decode raw transaction calldata for verification purposes.

The application is built with a modern web stack, including:

- **Framework:** Next.js 15 with Pages Router

* **Language:** TypeScript (strict mode)
* **Web3:** wagmi, viem, RainbowKit for wallet integration and blockchain interaction
* **Data Fetching:** TanStack Query, with a primary reliance on The Graph for indexed data and Blockscout API as a fallback.
* **Styling:** Tailwind CSS, implementing the Rootstock "Editor Mode" design system.

## Building and Running

### 1. Installation

Install the necessary dependencies:

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file by copying the example:

```bash
cp .env.example .env.local
```

You will need to fill in the required environment variables, such as `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, as detailed in `specs/001-rootstock-timelock/quickstart.md`.

### 3. Running the Development Server

To run the app in development mode:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 4. Building for Production

To create a production build:

```bash
npm run build
```

### 5. Running in Production

To start the production server:

```bash
npm start
```

## Development Conventions

### Coding Style

- **TypeScript:** The project uses TypeScript with `strict` mode enabled. All types should be explicit, and `any` should be avoided.
- **Linting & Formatting:** ESLint and Prettier are used for code linting and formatting. Run `npm run lint` to check for issues and `npm run format` to format the code.

### Testing

- **Framework:** Testing is done with [Vitest](https://vitest.dev/) and [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro).
- **Test-First Workflow:** The project follows a test-first development approach. Tests should be written before the implementation.
- **Running Tests:**
  - `npm test`: Run all tests.
  - `npm run test:watch`: Run tests in watch mode.
  - `npm run test:coverage`: Run tests and generate a coverage report.

### Project Structure

The project follows a feature-based structure within the `src/` directory:

- `src/pages`: Next.js Pages Router pages. The Dashboard page (`src/pages/index.tsx`) is configured as the application's homepage.

* `src/components`: Reusable React components.
* `src/hooks`: Custom React hooks for business logic.
* `src/lib`: Core utilities, constants, and wagmi configuration.
* `src/services`: Clients for external APIs (The Graph, Blockscout).
* `src/types`: TypeScript type definitions.

### Specifications and Planning

The `specs/` directory contains all the planning and design documents, including:

- `spec.md`: The detailed feature specification with user stories and requirements.
- `plan.md`: The technical implementation plan.
- `data-model.md`: The application's data model.
- `quickstart.md`: A guide for developers to get started.
- `tasks.md`: A detailed list of implementation tasks.
