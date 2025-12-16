# Functional Requirements Validation Checklist (FR-001 → FR-069)

Use this checklist to manually validate the feature against the functional requirements in [`spec.md`](../spec.md).

## Notes

- Mark items as **[X]** only when verified on a live Rootstock network (mainnet/testnet) with a real `TimelockController`.
- For items involving fallbacks (subgraph → Blockscout), verify both the **primary path** and the **fallback path**.

## Network & Wallet

- [X] FR-001: System MUST support connection via RainbowKit-compatible wallets including MetaMask, WalletConnect, and injected providers
- [X] FR-002: System MUST support exactly two networks: Rootstock mainnet (chainId 30) and Rootstock testnet (chainId 31)
- [X] FR-003: System MUST display a "Wrong network" banner when connected wallet is on an unsupported network
- [ ] FR-004: System MUST disable all transaction buttons (execute, cancel, schedule) when user is on wrong network while maintaining read-only functionality
- [X] FR-005: System MUST prompt users to add Rootstock network configuration to their wallet using wallet_addEthereumChain when network is not present
- [X] FR-006: System MUST load RPC URLs from environment variables (NEXT_PUBLIC_RSK_MAINNET_RPC_URL and NEXT_PUBLIC_RSK_TESTNET_RPC_URL)

## Contract Discovery & Validation

- [ ] FR-007: System MUST accept TimelockController contract addresses as input for exploration
- [X] FR-008: System MUST validate TimelockController contracts by checking supportsInterface or presence of functions: getMinDelay, hashOperation, schedule, execute
- [X] FR-009: System MUST retrieve and display the current minDelay value from TimelockController via getMinDelay()
- [X] FR-010: System MUST identify whether roles are stored locally on the Timelock (AccessControl) or on an external AccessManager contract

## Role & Permission Management

- [X] FR-011: System MUST display the four standard TimelockController roles: PROPOSER_ROLE (0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1), EXECUTOR_ROLE (0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63), CANCELLER_ROLE (0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b6223913e945f67199f), DEFAULT_ADMIN_ROLE (0x0000000000000000000000000000000000000000000000000000000000000000)
- [X] FR-012: System MUST fetch role member lists by querying The Graph subgraph for RoleGranted and RoleRevoked events emitted by the TimelockController
- [X] FR-013: System MUST verify current user's role permissions in real-time using RPC calls to hasRole(role, userAddress) before enabling action buttons
- [X] FR-014: System MUST display a link to AccessManager contract when DEFAULT_ADMIN_ROLE is held by a contract implementing IAccessManager
- [X] FR-015: System MUST show role grant/revoke history with action type, target address, transaction hash, and timestamp for each role

## Operations Explorer

- [X] FR-016: System MUST fetch operation data primarily from The Graph subgraphs indexing TimelockController events (CallScheduled, CallExecuted, Cancelled)
- [X] FR-017: System MUST fall back to Rootstock Blockscout API when subgraph is unavailable
- [X] FR-018: System MUST calculate and display operation status as: Pending (scheduled but timestamp < ETA and not cancelled), Ready (timestamp ≥ ETA and not done/cancelled), Executed (isOperationDone returns true), Canceled (Cancelled event emitted)
- [X] FR-019: System MUST display operations list with columns: Operation ID, Status, Number of calls, Targets (truncated with "+ N more" for multiple), ETA, Scheduled timestamp, Proposer address
- [X] FR-020: System MUST provide filter tabs/chips for: All, Pending, Ready, Executed, Canceled statuses
- [X] FR-021: System MUST provide search/filter by: Status, Target address, Proposer address, Executor address, Date range, Function name/selector
- [X] FR-022: System MUST display operation detail view showing: Status, ETA, delay, scheduled timestamp, operation ID, predecessor, salt, current minDelay
- [X] FR-023: System MUST display all calls in an operation with: Target address, Value in rBTC, Raw calldata
- [X] FR-024: System MUST decode calldata when ABI is available, showing function name, signature, and typed arguments
- [X] FR-025: System MUST display ABI confidence indicator: ✅ "Verified contract" (green) for Blockscout-verified contracts, ⚠️ "Unverified - showing raw hex" (yellow) for unverified contracts
- [X] FR-026: System MUST provide a link from operation details to the Decoder view with calldata preloaded

## Operation Execution & Cancellation

- [ ] FR-027: System MUST provide "Execute" action for operations in Ready status that calls execute() or executeBatch() on the TimelockController
- [ ] FR-028: System MUST provide "Cancel" action for pending operations that calls cancel(id) on the TimelockController
- [ ] FR-029: System MUST disable Execute button when connected wallet does not have EXECUTOR_ROLE, with tooltip "Your wallet does not have the EXECUTOR_ROLE"
- [ ] FR-030: System MUST disable Cancel button when connected wallet does not have CANCELLER_ROLE, with tooltip "Your wallet does not have the CANCELLER_ROLE"
- [ ] FR-031: System MUST show explicit call summary before executing any operation
- [ ] FR-032: System MUST highlight dangerous functions (upgrade, admin changes, updateDelay) with visual warnings

## Proposal Builder / Scheduler

- [ ] FR-033: System MUST support scheduling both single-call operations via schedule() and batch operations via scheduleBatch()
- [ ] FR-034: System MUST accept target contract address as input for proposal building
- [ ] FR-035: System MUST fetch contract ABI via Blockscout API (/api/v2/smart-contracts/{address}) for verified contracts
- [ ] FR-036: System MUST detect proxy contracts and automatically fetch the implementation contract's ABI when target is a proxy following EIP-1967/EIP-1822 patterns
- [ ] FR-037: System MUST check known contracts registry for pre-configured ABIs of common contracts (TimelockController, AccessManager)
- [ ] FR-038: System MUST provide manual ABI input modal when contract is not verified, with clear message "Contract not verified"
- [ ] FR-039: System MUST block proposal progression when ABI cannot be obtained
- [ ] FR-040: System MUST display all available functions from ABI for user selection
- [ ] FR-041: System MUST generate typed form fields based on function ABI parameters: address (with checksum validation), uint (with range inputs), bytes (hex input), arrays, structs
- [ ] FR-042: System MUST validate that delay parameter is ≥ getMinDelay() from the TimelockController
- [ ] FR-043: System MUST accept predecessor (bytes32, default 0x0) and salt (bytes32, default 0x0) parameters
- [ ] FR-044: System MUST accept value parameter for each call in rBTC
- [ ] FR-045: System MUST display human-readable summary on review screen showing: target.function(arg1, arg2), delay, minDelay, predecessor, salt
- [ ] FR-046: System MUST show preview of encoded calldata and computed operation ID before submission
- [ ] FR-047: System MUST require additional "CONFIRM" text input for high-risk functions: upgradeTo, transferOwnership, setAdmin, updateDelay
- [ ] FR-048: System MUST encode calldata using viem library functions (encodeFunctionData)
- [ ] FR-049: System MUST display operation ID, ETA, and transaction hash on successful scheduling

## Calldata Decoder

- [ ] FR-050: System MUST provide standalone decoder accepting: Raw calldata (0x...), Optional contract address, Optional ABI JSON, Transaction hash
- [ ] FR-051: System MUST attempt ABI resolution in priority order: Manual ABI (highest), Session cache, Blockscout API with proxy resolution, Known contracts registry, 4byte directory (lowest)
- [ ] FR-052: System MUST query 4byte directory (https://www.4byte.directory/api/v1/signatures/) for function signatures when higher-priority methods fail
- [ ] FR-053: System MUST show warning "⚠️ Decoded using guessed signature. Verification recommended" for 4byte directory matches
- [ ] FR-054: System MUST display raw hex only when no decoding method succeeds
- [ ] FR-055: System MUST display decoded output showing: Function name, Full function signature, Parameter table (Name, Type, Value), Confidence indicator (Verified vs Guessed)
- [ ] FR-056: System MUST recursively decode inner calls when calldata is for execute() or executeBatch() TimelockController functions
- [ ] FR-057: System MUST store user-provided ABIs in sessionStorage for reuse during the session

## Design System & Branding

- [ ] FR-058: System MUST use Rootstock Brand color palette: Primary Orange (#FF9100), Black (#000000), Off-White (#FAF9F5), Secondary accents (Pink #FF71E1, Green #79C600, Purple #9E76FF, Cyan #08FFD0, Lime #DEFF1A)
- [ ] FR-059: System MUST implement "Editor Mode" aesthetic with: Black background, Colored text containers, Off-White text on black, Colored blocks with black text for highlights
- [ ] FR-060: System MUST use Rootstock Sans or functional sans-serif fallback (Inter/Roboto Mono) for typography
- [ ] FR-061: System MUST style buttons with 3D effect using two-stroke/layer technique
- [ ] FR-062: System MUST use lozenge/pill-shaped nametags for addresses and roles, with height 120% of text size
- [ ] FR-063: System MUST maintain 10% spacing rule for internal padding and margins based on component height

## Data Architecture & Performance

- [ ] FR-064: System MUST use The Graph subgraphs as primary data source for operations and role events
- [ ] FR-065: System MUST deploy one subgraph per network (mainnet and testnet) indexing: CallScheduled, CallExecuted, Cancelled, RoleGranted, RoleRevoked events
- [ ] FR-066: System MUST use Blockscout API as fallback when subgraph is unavailable
- [ ] FR-067: System MUST cache fetched ABIs in sessionStorage to avoid repeated fetches
- [ ] FR-068: System MUST paginate operation lists to avoid loading entire chain history
- [ ] FR-069: System MUST never fail silently - always show error states and fallback indicators


