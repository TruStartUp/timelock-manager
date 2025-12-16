# Quickstart: Multi-Timelock Support

This guide explains how to integrate and use the multi-timelock feature, which allows users to configure and switch between different `TimelockController` contracts.

## Overview

The feature is built around a `TimelockContext` that provides global access to the list of user-defined timelock configurations and the currently active one. All data is stored client-side in `localStorage`.

-   **`localStorage` Key**: `timelock-manager:configurations`
-   **Data Model**: See [data-model.md](data-model.md) for the detailed `TimelockConfiguration` schema.

## Core Components

### 1. `TimelockProvider`

This React context provider is the root of the feature. It manages the state, interacts with `localStorage`, and exposes the data to the rest of the application.

**Usage**: Wrap the main application layout with the provider.

```tsx
// src/pages/_app.tsx (or a new Providers component)
import { TimelockProvider } from '@/context/TimelockContext';

function MyApp({ Component, pageProps }) {
  return (
    <TimelockProvider>
      {/* Other providers... */}
      <Component {...pageProps} />
    </TimelockProvider>
  );
}
```

### 2. `useTimelocks()` Hook

This custom hook is the primary way for components to interact with the timelock state.

**Returns**:

| Name | Type | Description |
| :--- | :--- | :--- |
| `configurations` | `TimelockConfiguration[]` | The full list of user-saved configurations. |
| `selected` | `TimelockConfiguration \| null` | The currently active timelock configuration. |
| `addConfig` | `(config: Omit<TimelockConfiguration, 'id'>) => void` | Adds a new configuration to the list. |
| `removeConfig` | `(id: string) => void` | Removes a configuration by its ID. |
| `select` | `(id: string) => void` | Sets a configuration as the active one. |

**Usage**:

```tsx
import { useTimelocks } from '@/hooks/useTimelocks';

const MyComponent = () => {
  const { selected, configurations, select } = useTimelocks();

  if (!selected) {
    return <div>No timelock selected. Please configure one in Settings.</div>;
  }

  return (
    <div>
      <h2>Current Timelock: {selected.name}</h2>
      <p>Address: {selected.address}</p>
      {/* ... use selected.subgraphUrl, etc. for data fetching */}
    </div>
  );
};
```

### 3. UI Components

-   **`TimelockSelector`**: A dropdown component that lists all `configurations` and uses the `select(id)` function to switch the active timelock. This should be placed in a global location like the main application header.
-   **`TimelockSettings`**: A settings modal or page that uses `addConfig` and `removeConfig` to allow users to manage their list of configurations.

## Development Workflow

1.  **Wrap the App**: Ensure the `TimelockProvider` is at the top level of the component tree.
2.  **Access State**: Use the `useTimelocks()` hook in any component that needs to know the current timelock or the list of available ones.
3.  **Update Endpoints**: Modify existing data-fetching logic (e.g., hooks that use `useSWR` or `TanStack Query`) to use the `address` and `subgraphUrl` from the `selected` timelock object provided by the `useTimelocks` hook. This makes your data queries dynamic and dependent on the user's selection.
