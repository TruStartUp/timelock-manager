# Research: Support Multiple Timelocks

This document outlines the decisions made to resolve technical uncertainties during the planning phase for the "Support Multiple Timelocks" feature.

## 1. Global State Management for Selected Timelock

**Decision**: A new React Context will be created to manage and provide the list of user-configured timelocks and the currently selected timelock configuration.

**Rationale**:

*   **Simplicity & Alignment**: The application does not currently have a global state management library (like Redux or Zustand) for client-side state. Introducing one for this single feature would be overkill. React Context is the idiomatic, built-in solution for sharing state within a component tree.
*   **Sufficiency**: The state is simple: an array of objects (`TimelockConfiguration[]`) and a single object for the selected timelock. The update frequency is low (only when the user explicitly changes settings or selects a different timelock). A custom hook (`useTimelock()`) will be exposed by the context provider to abstract away the `localStorage` logic and provide a clean API for components.
*   **Performance**: The performance impact of a context for this small amount of data is negligible and avoids adding a new third-party dependency.

**Alternatives Considered**:

*   **Zustand/Jotai**: Lightweight global state managers. While excellent, they are not yet used in the project. Introducing a new dependency for this feature is not justified when a native solution is sufficient.
*   **Prop Drilling**: Passing state down through component props. This is not a viable option as the selected timelock needs to be accessed by deeply nested components and components in different parts of the tree (header, dashboard, etc.).

## 2. LocalStorage Schema and Key

**Decision**:

*   **LocalStorage Key**: `timelock-manager:configurations`
*   **Schema**: The data will be stored as a JSON string representing an array of `TimelockConfiguration` objects. A `zod` schema will be used for validation upon retrieval to ensure type safety.

**JSON Schema for `TimelockConfiguration`**:

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1 },
    "address": { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
    "network": { "type": "string", "enum": ["rsk_mainnet", "rsk_testnet"] },
    "subgraphUrl": { "type": "string", "format": "uri" }
  },
  "required": ["id", "name", "address", "network", "subgraphUrl"]
}
```

**Rationale**:

*   **Namespacing**: Using a namespaced key (`timelock-manager:`) prevents conflicts with other applications or libraries that might use `localStorage` on the same domain.
*   **Type Safety**: Retrieving data from `localStorage` yields a string, which is then parsed into a JavaScript object of type `any`. Using a validation library like `zod` (or a manual validation function) is crucial to guarantee the data conforms to the expected `TimelockConfiguration[]` type at runtime, upholding the constitution's principle of type safety.
*   **Clear Structure**: A formal JSON schema provides a clear, unambiguous contract for the data structure, which is essential for development and future maintenance. The inclusion of an `id` field will help with list rendering and management in React.

**Alternatives Considered**:

*   **Using separate `localStorage` keys for each configuration**: This would be inefficient and harder to manage than storing a single array.
*   **No validation**: Directly casting the parsed JSON (`as TimelockConfiguration[]`) is unsafe and violates the project's type-safety principles. It would introduce the risk of runtime errors if the data in `localStorage` becomes corrupted or is manually edited into an invalid state.
