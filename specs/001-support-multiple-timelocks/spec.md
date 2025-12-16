# Feature Specification: Support Multiple Timelocks

**Feature Branch**: `001-support-multiple-timelocks`  
**Created**: 2025-12-16  
**Status**: Draft  
**Input**: User description: "Right now the timelock contract subgraph and the contract is a hardcoded variable or from the env variables. I want to know how can we extend this project to support multiple timelocks"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select Active Timelock (Priority: P1)

As a user, I want to be able to select a timelock contract from a list of available options so that I can view its specific operations, roles, and settings.

**Why this priority**: This is the core functionality required to support multiple timelocks. Without it, the application remains bound to a single contract.

**Independent Test**: The application can be loaded, a different timelock can be selected from a UI element, and the dashboard view updates to show data for the newly selected contract. This delivers the immediate value of multi-timelock visibility.

**Acceptance Scenarios**:

1. **Given** the application is loaded with a default timelock, **When** I select a different timelock from a dropdown list in the application header, **Then** the dashboard view updates to show the operations and roles for the selected timelock contract.
2. **Given** I am viewing a specific timelock's data, **When** I refresh the page, **Then** the application reloads the data for the same selected timelock.

---

### User Story 2 - Manage Timelock Configurations (Priority: P2)

As an administrator, I want a way to add, view, and remove timelock contract configurations so that the list of available timelocks for users is accurate and up-to-date.

**Why this priority**: This provides the necessary administrative control to manage the feature long-term. While a static config file could work initially, a management interface is required for non-developer administration.

**Independent Test**: An administrator can access a dedicated settings area, add a new valid timelock configuration, and see it appear in the user-facing selection list.

**Acceptance Scenarios**:

1. **Given** I am an administrator on a dedicated settings page, **When** I fill in a form with a new timelock's name, address, network, and subgraph URL and save it, **Then** the new timelock appears in the user-facing selection list.
2. **Given** I am an administrator viewing the list of configured timelocks, **When** I select the 'remove' option for a specific timelock, **Then** it is no longer available in the user-facing selection list.

---

### Edge Cases

- **Error Handling**: What happens if a user selects a timelock whose subgraph or contract endpoint is unavailable? The application should display a clear error message and allow the user to select a different timelock.
- **Invalid Configuration**: How does the system handle an administrator adding a configuration with an invalid contract address or a non-existent subgraph URL? The system should provide validation feedback and prevent saving the invalid configuration.
- **No Configurations**: What is displayed if no timelock contracts are configured? The application should show an informative empty state guiding an admin to add the first configuration.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow users to switch the active timelock contract context.
- **FR-002**: The system MUST fetch and display operations, roles, and other data relevant to the currently selected timelock contract.
- **FR-003**: The application state MUST persist the selected timelock across page loads and browser sessions for user convenience.
- **FR-004**: The system MUST store and manage the list of available timelock configurations in the user's local browser storage.
- **FR-005**: The user interface for switching between timelocks MUST be a dropdown component located in the application's header.
- **FR-006**: Any connected user MUST have the permission to add or remove their own timelock configurations, as they are stored locally.

### Key Entities

- **TimelockConfiguration**: Represents a single timelock contract instance.
    - **Attributes**: Display Name, Contract Address, Network (e.g., Rootstock Mainnet, Testnet), Subgraph Endpoint URL.

### Assumptions

- The application will have a default timelock contract to display on first load if one is not otherwise specified.
- The information required for each timelock (address, network, subgraph URL) will be provided by an administrator.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Switching between two different timelock contracts and seeing the updated data on the dashboard takes less than 5 seconds.
- **SC-002**: An administrator can successfully add and save a new timelock configuration in under 90 seconds.
- **SC-003**: The system must support at least 20 configured timelock contracts without a noticeable degradation in UI performance.
- **SC-004**: The application should successfully load and display data for a newly selected timelock with a 99% success rate, assuming valid configurations.