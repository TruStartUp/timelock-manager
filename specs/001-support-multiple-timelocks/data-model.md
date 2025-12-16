# Data Model: Timelock Configuration

This document defines the data structure for the `TimelockConfiguration` entity, which is used to manage multiple timelock contracts within the application.

## Entity: TimelockConfiguration

Represents a single user-defined timelock contract configuration. A list of these objects is stored in the user's browser `localStorage`.

### Storage

-   **Location**: Browser `localStorage`
-   **Key**: `timelock-manager:configurations`
-   **Format**: JSON string representing an array of `TimelockConfiguration` objects (`TimelockConfiguration[]`).

### Attributes

| Attribute | Type | Description | Constraints | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | A unique identifier for the configuration entry. | Must be a UUID. Generated on creation. | `"a3d8f8d0-9d6c-4b0f-8f8b-3e4c6d2c1b4a"` |
| `name` | `string` | A user-friendly name for the timelock. | Required, non-empty. | `"RIF Treasury Timelock"` |
| `address` | `string` | The Ethereum address of the TimelockController contract. | Required, must be a valid 40-character hex string prefixed with `0x`. | `"0x1234...5678"` |
| `network` | `string` | The network where the contract is deployed. | Required. Must be one of `rsk_mainnet` or `rsk_testnet`. | `"rsk_mainnet"` |
| `subgraphUrl` | `string` | The full URL of the The Graph subgraph endpoint for this timelock. | Required, must be a valid URL. | `"https://subgraph.sovryn.app/subgraphs/name/DistributedCollective/rootstock-timelock"` |

### Validation

-   Data retrieved from `localStorage` MUST be parsed and validated against this schema before being used in the application.
-   A library like `zod` is recommended to create a runtime validator from a TypeScript type to ensure data integrity and prevent runtime errors from corrupted or malformed `localStorage` data.

### Example `localStorage` Value

```json
"[{\"id\":\"a3d8f8d0-9d6c-4b0f-8f8b-3e4c6d2c1b4a\",\"name\":\"RIF Treasury Timelock\",\"address\":\"0x820B3454c51545199523477102fE4B17d75dF7b5\",\"network\":\"rsk_mainnet\",\"subgraphUrl\":\"https://subgraph.sovryn.app/subgraphs/name/DistributedCollective/rootstock-timelock\"},{\"id\":\"b4e9...\",\"name\":\"Testnet Timelock\",\"address\":\"0x9876...5432\",\"network\":\"rsk_testnet\",\"subgraphUrl\":\"...\"}]"
```