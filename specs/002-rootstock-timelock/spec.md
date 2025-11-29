# Feature Specification: Rootstock Timelock Management App

**Feature Branch**: `002-rootstock-timelock`
**Created**: 2025-11-28
**Updated**: 2025-11-28
**Status**: UI Implementation In Progress
**Input**: User description: "Rootstock Timelock Management App with AccessManager and TimelockController exploration, operation management, and transaction building capabilities"

**Implementation Notes**: Primary UI views have been implemented with mock data structures representing the data flows described in this specification. The implemented views include: Dashboard (operations overview and role summary), Operations Explorer (filterable operations table with expandable details), New Proposal wizard (multi-step contract interaction builder), Calldata Decoder (hex decoding tool), and Permissions management (role holders and history). These views establish the UI patterns and information architecture; blockchain integration is pending.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Pending Timelock Operations (Priority: P1)

A governance participant needs to monitor all pending and ready operations in the TimelockController contract to understand what governance actions are queued and when they will be executable.

**Why this priority**: This is the core read-only functionality that provides immediate value. Users can understand the current state of governance without needing write permissions. This is the foundation for all other features.

**Independent Test**: Can be fully tested by connecting to a Rootstock network with an existing TimelockController contract and verifying that all scheduled operations are displayed with correct status, ETA, and details. Delivers value by providing transparency into governance operations.

**Acceptance Scenarios**:

1. **Given** a TimelockController contract with 5 pending operations, **When** user enters the contract address, **Then** all 5 operations are displayed with status "Pending" and their ETAs
2. **Given** an operation that has passed its ETA, **When** user views the operations list, **Then** the operation is displayed with status "Ready" and the execute button is visible
3. **Given** an operation with multiple batched calls, **When** user clicks to expand the operation details, **Then** all target addresses, values, and calldata are displayed for each call
4. **Given** a verified contract as the target, **When** viewing operation call details, **Then** decoded function name and parameters are shown with a "Verified" badge
5. **Given** an unverified contract as the target, **When** viewing operation call details, **Then** raw calldata is shown with a warning badge indicating "Unverified - showing raw hex"

---

### User Story 2 - Execute Ready Timelock Operations (Priority: P2)

A user with EXECUTOR_ROLE needs to execute operations that have passed their timelock delay to enact approved governance decisions.

**Why this priority**: This enables the core governance workflow completion. While viewing is important, the ability to execute operations is what makes the timelock functional. Prioritized after viewing because users need to see operations before executing them.

**Independent Test**: Can be tested by connecting a wallet with EXECUTOR_ROLE to a testnet TimelockController with a ready operation, executing it, and verifying the transaction succeeds and the operation status changes to "Executed".

**Acceptance Scenarios**:

1. **Given** a connected wallet with EXECUTOR_ROLE and an operation in "Ready" status, **When** user clicks the "Execute" button, **Then** a transaction is prepared showing the operation details for confirmation
2. **Given** a user confirms the execution transaction, **When** the transaction is submitted, **Then** the operation status updates to "Executed" and the execute button is disabled
3. **Given** a connected wallet without EXECUTOR_ROLE, **When** viewing a ready operation, **Then** the execute button is disabled with a tooltip explaining "Your wallet does not have the EXECUTOR_ROLE"
4. **Given** user is on the wrong network, **When** attempting to execute an operation, **Then** a "Wrong network" banner is shown and all action buttons are disabled

---

### User Story 3 - View and Understand Role Permissions (Priority: P2)

A governance administrator needs to understand which addresses hold PROPOSER, EXECUTOR, CANCELLER, and ADMIN roles to audit access control and ensure proper governance security.

**Why this priority**: Security and transparency are critical for governance. Understanding who can perform actions is essential for trust. Tied with P2 because it's equally important as execution but serves a different use case (audit vs action).

**Independent Test**: Can be tested by querying a TimelockController contract and verifying that all role holders are correctly displayed and the connected wallet's permissions are accurately reflected in button states.

**Acceptance Scenarios**:

1. **Given** a TimelockController contract, **When** user navigates to the Roles/Permissions view, **Then** all four standard roles (PROPOSER, EXECUTOR, CANCELLER, ADMIN) are displayed with their role hashes
2. **Given** a role with 3 addresses holding it, **When** viewing the role details, **Then** all 3 addresses are listed with copy buttons for each
3. **Given** a role with RoleGranted and RoleRevoked historical events, **When** viewing the role history, **Then** events are displayed in chronological order with action type, target address, transaction hash, and timestamp
4. **Given** DEFAULT_ADMIN_ROLE is held by an AccessManager contract, **When** viewing the admin role, **Then** a link is displayed indicating "Managed by AccessManager [address]"
5. **Given** user connects their wallet, **When** the wallet holds a role, **Then** that role is visually highlighted in the interface

---

### User Story 4 - Schedule New Timelock Operations (Priority: P3)

A user with PROPOSER_ROLE needs to schedule new governance operations by selecting a target contract, choosing a function, providing arguments, and setting timelock parameters.

**Why this priority**: This enables proactive governance but requires all the foundational read capabilities first. Users need to understand existing operations and roles before creating new ones. More complex than read operations.

**Independent Test**: Can be tested by connecting a wallet with PROPOSER_ROLE, selecting a verified contract, building a transaction with valid parameters, scheduling it, and verifying the new operation appears in the operations list with correct parameters.

**Acceptance Scenarios**:

1. **Given** a verified contract address, **When** user enters it in the proposal builder, **Then** the contract ABI is automatically fetched and all functions are available for selection
2. **Given** a proxy contract address, **When** user enters it in the proposal builder, **Then** the implementation contract's ABI is fetched and used for function selection
3. **Given** an unverified contract address, **When** user attempts to proceed, **Then** the interface blocks progression and prompts for manual ABI input via a modal
4. **Given** a selected function with typed parameters, **When** building the proposal, **Then** typed form fields are auto-generated (address with checksum validation, uint with range inputs, bytes as hex)
5. **Given** a user sets a delay less than getMinDelay(), **When** attempting to schedule, **Then** a validation error is shown indicating the minimum required delay
6. **Given** a high-risk function like "upgradeTo" or "transferOwnership", **When** reviewing the proposal, **Then** an extra confirmation step requires typing "CONFIRM" before submission
7. **Given** a successfully scheduled operation, **When** the transaction confirms, **Then** the operation ID, ETA, and transaction hash are displayed

---

### User Story 5 - Decode Arbitrary Calldata for Safety Verification (Priority: P3)

A governance participant needs to decode raw transaction calldata to verify what actions will be performed before voting or executing, ensuring transparency and preventing malicious proposals.

**Why this priority**: This is a safety and transparency tool that enhances all other features but can function independently. Lower priority because it's supplementary to the core governance workflow.

**Independent Test**: Can be tested by pasting calldata from a known transaction, optionally providing a contract address or ABI, and verifying the decoded output matches the expected function and parameters with appropriate confidence indicators.

**Acceptance Scenarios**:

1. **Given** raw calldata and a verified contract address, **When** user submits for decoding, **Then** the function signature and all parameters are decoded and displayed with a "Verified" confidence badge
2. **Given** raw calldata with manual ABI input, **When** user provides a matching ABI JSON, **Then** decoding proceeds with high confidence indication
3. **Given** raw calldata without contract address or ABI, **When** the decoder attempts 4byte directory lookup, **Then** results are shown with a warning "⚠️ Decoded using guessed signature. Verification recommended"
4. **Given** calldata for a TimelockController execute or executeBatch function, **When** decoded, **Then** the inner calls are recursively decoded and displayed as nested operations
5. **Given** calldata that cannot be decoded by any method, **When** decoding fails, **Then** only raw hex is shown with a clear "Cannot decode" message

---

### User Story 6 - Cancel Pending Operations (Priority: P4)

A user with CANCELLER_ROLE needs to cancel pending operations that are no longer desired or were scheduled in error, before they become executable.

**Why this priority**: Important for governance safety but less frequently used than viewing, executing, or scheduling. Serves as a safety mechanism rather than primary workflow.

**Independent Test**: Can be tested by connecting a wallet with CANCELLER_ROLE, selecting a pending operation, canceling it, and verifying the status changes to "Canceled" and the operation is no longer executable.

**Acceptance Scenarios**:

1. **Given** a connected wallet with CANCELLER_ROLE and a pending operation, **When** user clicks "Cancel", **Then** a confirmation dialog shows the operation details
2. **Given** user confirms cancellation, **When** the transaction is submitted, **Then** the operation status updates to "Canceled" and all action buttons are disabled
3. **Given** a connected wallet without CANCELLER_ROLE, **When** viewing a pending operation, **Then** the cancel button is disabled with tooltip "Your wallet does not have the CANCELLER_ROLE"

---

### User Story 7 - Filter and Search Operations (Priority: P4)

A user monitoring many timelock operations needs to filter by status, search by proposer address, target address, or operation ID to quickly find relevant operations.

**Why this priority**: Enhances usability for power users but is not essential for basic functionality. All operations can still be viewed without filtering.

**Independent Test**: Can be tested by applying various filters (status tabs, address search, date range) and verifying only matching operations are displayed.

**Acceptance Scenarios**:

1. **Given** 50 total operations with mixed statuses, **When** user clicks the "Pending" filter tab, **Then** only operations with Pending status are displayed
2. **Given** operations from multiple proposers, **When** user searches by a specific proposer address, **Then** only operations from that proposer are shown
3. **Given** operations with various target contracts, **When** user filters by target address, **Then** only operations calling that contract are displayed
4. **Given** operations over a 6-month period, **When** user applies a date range filter, **Then** only operations scheduled within that range are shown

---

### User Story 8 - Manage Custom Network and ABI Settings (Priority: P4)

An advanced user or developer needs to configure custom RPC endpoints for Rootstock networks or import custom contract ABIs for specialized governance contracts.

**Why this priority**: Power user feature that most users won't need. Default configuration works for standard use cases.

**Independent Test**: Can be tested by entering a custom RPC URL, testing the connection, saving it, and verifying operations continue to work with the custom endpoint. Similarly, importing a custom ABI and verifying it's used for decoding.

**Acceptance Scenarios**:

1. **Given** user enables custom RPC in settings, **When** a valid RPC URL is entered and tested, **Then** connection success is indicated and the setting can be saved
2. **Given** user imports a custom contract ABI JSON, **When** the JSON is valid, **Then** the ABI is stored and appears in the ABI management list
3. **Given** stored custom ABIs, **When** user exports all ABIs, **Then** a JSON file containing all ABIs is downloaded
4. **Given** a stored custom ABI, **When** user deletes it, **Then** the ABI is removed and no longer used for decoding

---

### Edge Cases

- **Network Mismatch**: What happens when the connected wallet is on Ethereum mainnet but the app is configured for Rootstock? System displays "Wrong network" banner and disables all transaction buttons while maintaining read-only functionality.

- **Subgraph Unavailable**: How does the system handle The Graph subgraph being down or unavailable? System falls back to Blockscout API for fetching events and displays a notice about using fallback data source.

- **Proxy Detection Failure**: What happens when a proxy contract doesn't follow EIP-1967/EIP-1822 patterns? Manual ABI input modal is shown with explanation that proxy implementation couldn't be automatically detected.

- **Extremely Large Batch Operations**: How does the UI handle an operation with 50+ batched calls? Implement pagination or virtualization in the calls list display, showing 10 calls at a time with expand/collapse controls.

- **Role Changes During Session**: What happens if a user's role is revoked while they're using the app? Real-time RPC checks before transaction submission will catch this and display an error. Add periodic background refresh of role status.

- **Concurrent Execution Attempts**: How does the system handle two EXECUTOR users trying to execute the same operation simultaneously? The second transaction will fail on-chain with a clear error message "Operation already executed". UI should reflect status change when detected.

- **Malformed Calldata**: What happens when user pastes invalid hex or non-calldata into the decoder? Validation shows error message "Invalid calldata format. Must be hexadecimal starting with 0x."

- **Very Long Delay Times**: How are operations scheduled years in the future displayed? Show both relative time (e.g., "in 2 years, 3 months") and absolute UTC timestamp.

- **Missing Contract Interfaces**: What happens when TimelockController doesn't implement supportsInterface? Fallback to checking for presence of known functions like getMinDelay, hashOperation, schedule, execute.

## Requirements _(mandatory)_

### Functional Requirements

#### Network & Wallet

- **FR-001**: System MUST support connection via RainbowKit-compatible wallets including MetaMask, WalletConnect, and injected providers
- **FR-002**: System MUST support exactly two networks: Rootstock mainnet (chainId 30) and Rootstock testnet (chainId 31)
- **FR-003**: System MUST display a "Wrong network" banner when connected wallet is on an unsupported network
- **FR-004**: System MUST disable all transaction buttons (execute, cancel, schedule) when user is on wrong network while maintaining read-only functionality
- **FR-005**: System MUST prompt users to add Rootstock network configuration to their wallet using wallet_addEthereumChain when network is not present
- **FR-006**: System MUST load RPC URLs from environment variables (NEXT_PUBLIC_RSK_MAINNET_RPC_URL and NEXT_PUBLIC_RSK_TESTNET_RPC_URL)

#### Contract Discovery & Validation

- **FR-007**: System MUST accept TimelockController contract addresses as input for exploration
- **FR-008**: System MUST validate TimelockController contracts by checking supportsInterface or presence of functions: getMinDelay, hashOperation, schedule, execute
- **FR-009**: System MUST retrieve and display the current minDelay value from TimelockController via getMinDelay()
- **FR-010**: System MUST identify whether roles are stored locally on the Timelock (AccessControl) or on an external AccessManager contract

#### Role & Permission Management

- **FR-011**: System MUST display the four standard TimelockController roles: PROPOSER_ROLE (0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1), EXECUTOR_ROLE (0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63), CANCELLER_ROLE (0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b6223913e945f67199f), DEFAULT_ADMIN_ROLE (0x0000000000000000000000000000000000000000000000000000000000000000)
- **FR-012**: System MUST fetch role member lists by querying The Graph subgraph for RoleGranted and RoleRevoked events emitted by the TimelockController
- **FR-013**: System MUST verify current user's role permissions in real-time using RPC calls to hasRole(role, userAddress) before enabling action buttons
- **FR-014**: System MUST display a link to AccessManager contract when DEFAULT_ADMIN_ROLE is held by a contract implementing IAccessManager
- **FR-015**: System MUST show role grant/revoke history with action type, target address, transaction hash, and timestamp for each role

#### Operations Explorer

- **FR-016**: System MUST fetch operation data primarily from The Graph subgraphs indexing TimelockController events (CallScheduled, CallExecuted, Cancelled)
- **FR-017**: System MUST fall back to Rootstock Blockscout API when subgraph is unavailable
- **FR-018**: System MUST calculate and display operation status as: Pending (scheduled but timestamp < ETA and not cancelled), Ready (timestamp ≥ ETA and not done/cancelled), Executed (isOperationDone returns true), Canceled (Cancelled event emitted)
- **FR-019**: System MUST display operations list with columns: Operation ID, Status, Number of calls, Targets (truncated with "+ N more" for multiple), ETA, Scheduled timestamp, Proposer address
- **FR-020**: System MUST provide filter tabs/chips for: All, Pending, Ready, Executed, Canceled statuses
- **FR-021**: System MUST provide search/filter by: Status, Target address, Proposer address, Executor address, Date range, Function name/selector
- **FR-022**: System MUST display operation detail view showing: Status, ETA, delay, scheduled timestamp, operation ID, predecessor, salt, current minDelay
- **FR-023**: System MUST display all calls in an operation with: Target address, Value in rBTC, Raw calldata
- **FR-024**: System MUST decode calldata when ABI is available, showing function name, signature, and typed arguments
- **FR-025**: System MUST display ABI confidence indicator: ✅ "Verified contract" (green) for Blockscout-verified contracts, ⚠️ "Unverified - showing raw hex" (yellow) for unverified contracts
- **FR-026**: System MUST provide a link from operation details to the Decoder view with calldata preloaded

#### Operation Execution & Cancellation

- **FR-027**: System MUST provide "Execute" action for operations in Ready status that calls execute() or executeBatch() on the TimelockController
- **FR-028**: System MUST provide "Cancel" action for pending operations that calls cancel(id) on the TimelockController
- **FR-029**: System MUST disable Execute button when connected wallet does not have EXECUTOR_ROLE, with tooltip "Your wallet does not have the EXECUTOR_ROLE"
- **FR-030**: System MUST disable Cancel button when connected wallet does not have CANCELLER_ROLE, with tooltip "Your wallet does not have the CANCELLER_ROLE"
- **FR-031**: System MUST show explicit call summary before executing any operation
- **FR-032**: System MUST highlight dangerous functions (upgrade, admin changes, updateDelay) with visual warnings

#### Proposal Builder / Scheduler

- **FR-033**: System MUST support scheduling both single-call operations via schedule() and batch operations via scheduleBatch()
- **FR-034**: System MUST accept target contract address as input for proposal building
- **FR-035**: System MUST fetch contract ABI via Blockscout API (/api/v2/smart-contracts/{address}) for verified contracts
- **FR-036**: System MUST detect proxy contracts and automatically fetch the implementation contract's ABI when target is a proxy following EIP-1967/EIP-1822 patterns
- **FR-037**: System MUST check known contracts registry for pre-configured ABIs of common contracts (TimelockController, AccessManager)
- **FR-038**: System MUST provide manual ABI input modal when contract is not verified, with clear message "Contract not verified"
- **FR-039**: System MUST block proposal progression when ABI cannot be obtained
- **FR-040**: System MUST display all available functions from ABI for user selection
- **FR-041**: System MUST generate typed form fields based on function ABI parameters: address (with checksum validation), uint (with range inputs), bytes (hex input), arrays, structs
- **FR-042**: System MUST validate that delay parameter is ≥ getMinDelay() from the TimelockController
- **FR-043**: System MUST accept predecessor (bytes32, default 0x0) and salt (bytes32, default 0x0) parameters
- **FR-044**: System MUST accept value parameter for each call in rBTC
- **FR-045**: System MUST display human-readable summary on review screen showing: target.function(arg1, arg2), delay, minDelay, predecessor, salt
- **FR-046**: System MUST show preview of encoded calldata and computed operation ID before submission
- **FR-047**: System MUST require additional "CONFIRM" text input for high-risk functions: upgradeTo, transferOwnership, setAdmin, updateDelay
- **FR-048**: System MUST encode calldata using viem library functions (encodeFunctionData)
- **FR-049**: System MUST display operation ID, ETA, and transaction hash on successful scheduling

#### Calldata Decoder

- **FR-050**: System MUST provide standalone decoder accepting: Raw calldata (0x...), Optional contract address, Optional ABI JSON, Transaction hash
- **FR-051**: System MUST attempt ABI resolution in priority order: Manual ABI (highest), Session cache, Blockscout API with proxy resolution, Known contracts registry, 4byte directory (lowest)
- **FR-052**: System MUST query 4byte directory (https://www.4byte.directory/api/v1/signatures/) for function signatures when higher-priority methods fail
- **FR-053**: System MUST show warning "⚠️ Decoded using guessed signature. Verification recommended" for 4byte directory matches
- **FR-054**: System MUST display raw hex only when no decoding method succeeds
- **FR-055**: System MUST display decoded output showing: Function name, Full function signature, Parameter table (Name, Type, Value), Confidence indicator (Verified vs Guessed)
- **FR-056**: System MUST recursively decode inner calls when calldata is for execute() or executeBatch() TimelockController functions
- **FR-057**: System MUST store user-provided ABIs in sessionStorage for reuse during the session

#### Design System & Branding

- **FR-058**: System MUST use Rootstock Brand color palette: Primary Orange (#FF9100), Black (#000000), Off-White (#FAF9F5), Secondary accents (Pink #FF71E1, Green #79C600, Purple #9E76FF, Cyan #08FFD0, Lime #DEFF1A)
- **FR-059**: System MUST implement "Editor Mode" aesthetic with: Black background, Colored text containers, Off-White text on black, Colored blocks with black text for highlights
- **FR-060**: System MUST use Rootstock Sans or functional sans-serif fallback (Inter/Roboto Mono) for typography
- **FR-061**: System MUST style buttons with 3D effect using two-stroke/layer technique
- **FR-062**: System MUST use lozenge/pill-shaped nametags for addresses and roles, with height 120% of text size
- **FR-063**: System MUST maintain 10% spacing rule for internal padding and margins based on component height

#### Data Architecture & Performance

- **FR-064**: System MUST use The Graph subgraphs as primary data source for operations and role events
- **FR-065**: System MUST deploy one subgraph per network (mainnet and testnet) indexing: CallScheduled, CallExecuted, Cancelled, RoleGranted, RoleRevoked events
- **FR-066**: System MUST use Blockscout API as fallback when subgraph is unavailable
- **FR-067**: System MUST cache fetched ABIs in sessionStorage to avoid repeated fetches
- **FR-068**: System MUST paginate operation lists to avoid loading entire chain history
- **FR-069**: System MUST never fail silently - always show error states and fallback indicators

### Key Entities

- **TimelockController Contract**: The primary governance contract being explored. Contains operations, roles, and delay settings. Has functions: schedule, scheduleBatch, execute, executeBatch, cancel, getMinDelay, hashOperation, getTimestamp, isOperationPending, isOperationReady, isOperationDone. Emits events: CallScheduled, CallExecuted, Cancelled.

- **Operation**: A scheduled governance action in the TimelockController. Key attributes: operation ID (bytes32 hash), status (Pending/Ready/Executed/Canceled), target addresses (array), values (array of rBTC amounts), calldata (array of encoded function calls), predecessor (bytes32), salt (bytes32), delay (seconds), ETA (Unix timestamp), proposer address, executor address (if executed). May contain single or multiple batched calls.

- **Role**: An AccessControl permission in the TimelockController. Key attributes: role hash (bytes32), role name (PROPOSER/EXECUTOR/CANCELLER/ADMIN), member addresses (array), grant/revoke history (events with timestamp, transaction hash, granter address). Defines who can perform governance actions.

- **Call**: An individual function call within an operation. Key attributes: target contract address, value in rBTC, calldata (encoded function call), decoded function (if ABI available), decoded arguments (if ABI available), ABI confidence level (Verified/Guessed/None).

- **Contract ABI**: Application Binary Interface defining how to interact with a smart contract. Key attributes: source (Blockscout verified / Manual / Known registry / 4byte), contract address, ABI JSON, confidence level, proxy status (implementation vs proxy). Used for decoding calldata and building proposals.

- **Network Configuration**: Settings for connecting to Rootstock blockchain. Key attributes: chain ID (30 or 31), network name (Mainnet/Testnet), RPC URL, Blockscout API URL, Subgraph URL, connection status.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can view all operations in a TimelockController contract within 5 seconds of entering the contract address
- **SC-002**: System correctly displays operation status (Pending/Ready/Executed/Canceled) with 100% accuracy based on on-chain state
- **SC-003**: Users with appropriate roles can execute a ready operation in under 3 clicks (select operation → review → confirm transaction)
- **SC-004**: System successfully decodes calldata for 90% or more of operations involving verified contracts on Rootstock
- **SC-005**: Users can schedule a new operation for a verified contract in under 5 minutes from start to transaction submission
- **SC-006**: System falls back to Blockscout API within 2 seconds when The Graph subgraph is unavailable, with no loss of core functionality
- **SC-007**: System correctly identifies and displays all role holders for PROPOSER, EXECUTOR, CANCELLER, and ADMIN roles
- **SC-008**: Action buttons (Execute/Cancel/Schedule) are enabled or disabled in real-time based on connected wallet's actual on-chain role permissions
- **SC-009**: System automatically detects and fetches implementation ABIs for proxy contracts following EIP-1967/EIP-1822 standards
- **SC-010**: Users receive clear visual feedback distinguishing between verified contract decoding (high confidence) and 4byte directory guesses (low confidence)
- **SC-011**: System prevents scheduling operations with delay less than minDelay through validation before transaction submission
- **SC-012**: System displays "Wrong network" warning and disables transaction buttons when wallet is connected to non-Rootstock network
- **SC-013**: Users can filter a list of 100+ operations to find specific operations by status or address in under 3 seconds
- **SC-014**: System successfully handles batch operations with up to 20 calls without UI performance degradation
- **SC-015**: 95% of users can understand operation details without technical blockchain knowledge, through decoded function names and parameters

## Assumptions

1. **Subgraph Availability**: We assume The Graph infrastructure for Rootstock is stable and can be deployed with our custom subgraph. Fallback to Blockscout API mitigates this risk.

2. **Standard TimelockController Implementation**: We assume target contracts implement OpenZeppelin's standard TimelockController with AccessControl, using the standard role hashes. Custom timelock implementations may require additional configuration.

3. **Proxy Standards**: We assume proxy contracts follow EIP-1967 or EIP-1822 standards for automatic implementation detection. Non-standard proxies will require manual ABI input.

4. **RPC Reliability**: We assume Rootstock public RPC nodes are sufficiently reliable for real-time hasRole checks. High-availability deployments may need to configure custom RPC endpoints.

5. **Blockscout API Schema**: We assume Rootstock Blockscout APIs follow the standard Blockscout v2 schema for contract verification and ABI fetching.

6. **Wallet Compatibility**: We assume RainbowKit-supported wallets (MetaMask, WalletConnect providers) work correctly with Rootstock networks. Some wallet-specific bugs may occur.

7. **4byte Directory Coverage**: We assume the 4byte directory has reasonable coverage of common function signatures but acknowledge it won't match everything, hence the "guessed" confidence indicator.

8. **Session-Only ABI Storage**: We assume users are comfortable with manually imported ABIs persisting only for the session (sessionStorage). Permanent storage would require additional privacy considerations and UX for management.

9. **Single Timelock at a Time**: MVP assumes users interact with one TimelockController contract at a time. Multi-timelock comparison or favorites can be added post-MVP.

10. **English Language Only**: We assume initial deployment targets English-speaking users. Internationalization is not in scope for v1.

## Dependencies

- **External**: The Graph (subgraph indexing), Rootstock Blockscout API (contract verification & ABI), 4byte Directory (function signature lookup), Rootstock RPC nodes (on-chain state queries)
- **Internal**: OpenZeppelin TimelockController contract must be already deployed on target networks

## Out of Scope

- Writing or deploying TimelockController contracts (app only interacts with existing contracts)
- Governance voting mechanisms (app handles timelock operations, not the voting that precedes them)
- Multi-signature wallet integration beyond standard wallet connection
- Historical analytics or governance participation metrics
- Email notifications for operation status changes
- Mobile native applications (web-responsive only)
- Integration with non-Rootstock EVM chains (Rootstock-specific)
- DAO framework integration (Snapshot, Tally, etc.)
