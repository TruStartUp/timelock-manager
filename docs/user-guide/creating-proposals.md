# Creating Proposals

Complete guide to scheduling new operations using the 3-step proposal wizard.

## Overview

The New Proposal wizard guides you through scheduling operations in your TimelockController. It supports both single function calls and batch operations (multiple calls executed atomically).

**Required Role**: PROPOSER_ROLE

## Accessing the Wizard

Click **"New Proposal"** in the left sidebar.

[Screenshot placeholder: New Proposal wizard - Step 1]

## The 3-Step Process

```
Step 1: Target Contract → Step 2: Configure Operations → Step 3: Review & Schedule
```

Each step must be completed before advancing to the next.

---

## Step 1: Target Contract

Select the contract you want to interact with and fetch its ABI.

### Enter Contract Address

1. Enter the target contract address in the input field
2. Address validation happens automatically
3. Green checkmark appears for valid addresses

**Examples**:
- `0x1234567890123456789012345678901234567890` (full address)
- Accepts mixed case (checksummed or lowercase)

### Fetch ABI

Click **"Fetch ABI"** button to retrieve the contract's ABI.

#### Automatic ABI Resolution

The app attempts to fetch the ABI from multiple sources:

1. **Blockscout Verified Contract** (best)
   - Contract is verified on Rootstock Blockscout
   - High confidence, full function names and parameters
   - Shows ✅ "Verified contract" badge

2. **Proxy Detection**
   - Automatically detects proxy contracts
   - Resolves implementation address
   - Shows implementation info
   - Fetches implementation ABI

3. **Manual ABI** (fallback)
   - If contract is unverified, modal opens
   - Paste ABI JSON manually
   - See [Manual ABI section](#manual-abi-upload) below

#### ABI Fetch Success

When ABI is successfully fetched:
- Shows ABI source (Blockscout verified)
- Shows confidence level (High/Medium/Low)
- Shows function count (e.g., "23 functions")
- Shows proxy info if applicable
- **Automatically advances to Step 2**

[Screenshot placeholder: Step 1 success with ABI loaded]

#### Manual ABI Upload

If contract is not verified:

1. Modal opens: "Contract ABI not found"
2. Paste your ABI JSON in the textarea
3. Click "Use This ABI"
4. ABI is validated and cached for this session

**ABI Format**: Standard JSON array of function/event definitions

**Example**:
```json
[
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"type": "bool"}]
  }
]
```

**Where to get ABI**:
- From contract developers
- From deployment artifacts
- From other block explorers (if verified elsewhere)
- From contract source code compilation

---

## Step 2: Configure Operations

Configure the function call(s) for your operation.

### Single Operation (Default)

By default, one operation card is shown:

#### 1. Contract Address (Pre-filled or Editable)

For batch operations, you can target different contracts:
- Leave as-is to use same contract from Step 1
- Or enter different contract address
- Click "Fetch ABI" if different contract

#### 2. Value (RBTC to Send)

Enter amount of RBTC to send with this call:
- **Format**: Wei (smallest unit)
- **Example**: `1000000000000000000` = 1 RBTC
- **Default**: `0` (no RBTC sent)

**Use case**: Sending RBTC along with function call (e.g., depositing funds)

#### 3. Function Selector

Dropdown showing all **write** functions from the ABI:

- Functions sorted alphabetically
- Only shows state-changing functions (not view/pure)
- Select the function you want to call

**Example functions**:
- `transfer(address,uint256)`
- `approve(address,uint256)`
- `upgradeTo(address)`

#### 4. Function Parameters

Dynamic form fields appear based on selected function:

**For each parameter**:
- **Label**: Parameter name and type (e.g., "to (address)")
- **Input**: Text field for entering value
- **Validation**: Real-time validation of input

**Parameter types**:
- `address`: Ethereum address (0x...)
- `uint256`: Unsigned integer (any size)
- `bool`: Dropdown (true/false)
- `bytes`: Hex string (0x...)
- `string`: Text string
- Arrays: One input per element (or comma-separated)

**Example**:
```
Function: transfer(address to, uint256 amount)

to (address):        0x1234567890123456789012345678901234567890
amount (uint256):    1000000000000000000
```

#### 5. Validation Indicator

Each operation card shows validation status:
- ✅ Green checkmark: All required fields filled, valid inputs
- ⚠️ Yellow warning: Missing required fields or invalid inputs

### Batch Operations

Schedule multiple calls that execute atomically (all-or-nothing).

#### Add Operation

Click **"+ Add Operation"** button at bottom:
- Creates new operation card
- Maximum: 50 operations per batch (configured limit)
- Each operation is independent (can target different contracts)

#### Remove Operation

Click **trash icon** on operation card:
- Removes that operation from batch
- Cannot remove if only one operation remains

#### Operation Order

Operations execute in the order shown (top to bottom):
- First card executes first
- If any operation fails, entire batch reverts
- Drag to reorder (if implemented) or recreate in desired order

### Navigation

- **Back**: Return to Step 1 (preserves Step 2 data)
- **Next**: Advance to Step 3 (only enabled when all operations valid)

[Screenshot placeholder: Step 2 with multiple operations configured]

---

## Step 3: Review & Schedule

Final review and scheduling parameters.

### Batch Summary (if multiple operations)

Shows overview:
- **Total Operations**: Count of operations in batch
- **Total Value**: Sum of RBTC across all operations
- **Unique Targets**: Number of different contracts being called

### Operation Details Review

For each operation:

#### Operation Card
- **Operation number**: 1, 2, 3, etc.
- **Target contract**: Address being called
- **Value**: RBTC being sent (in wei)
- **Function**: Function signature with parameters

#### Parameters Table
- **Name**: Parameter name
- **Type**: Solidity type
- **Value**: Your input value
- Validation checkmark per parameter

#### Encoded Calldata
- Read-only textarea showing hex-encoded calldata
- Useful for verification and record-keeping
- Copy button to copy full calldata

### High-Risk Function Gate

If any operation calls a dangerous function:

**Detected high-risk functions**:
- `upgradeTo(address)` - Proxy upgrades
- `upgradeToAndCall(address,bytes)` - Upgrade with initialization
- `transferOwnership(address)` - Ownership transfers
- `updateDelay(uint256)` - Timelock delay changes
- `setImplementation(address)` - Implementation changes

**Protection mechanism**:
1. Red warning banner appears
2. Lists all dangerous functions in your batch
3. Submit button is **disabled**
4. Must type "CONFIRM" in text field to enable submit

**Warning example**:
```
⚠️ HIGH RISK OPERATION DETECTED

This proposal includes the following dangerous functions:
• upgradeTo(address) in Operation #1

Type CONFIRM to proceed:
[_________]
```

**Why this matters**: These functions can have severe consequences if called incorrectly. The confirmation gate forces you to acknowledge the risk.

### Timelock Settings

#### Timelock Controller Address

Enter your TimelockController contract address:
- Must be valid Rootstock address
- This is the contract that will schedule the operation
- **Not the same as target contract** (common confusion)
- Shows minDelay for this timelock once entered

**Example**: `0xabcdef...` (your TimelockController)

#### Delay (seconds)

Time to wait before operation can be executed:
- **Format**: Seconds
- **Minimum**: Must be ≥ minDelay (shown below field)
- **Typical**: 172800 (48 hours), 86400 (24 hours)

**Displays**:
- Minimum delay from contract (e.g., "48 hours")
- Calculated ready timestamp (e.g., "Ready at: Dec 25, 2025, 3:00 PM UTC")

**Example**:
```
Delay (seconds): 172800
Minimum delay: 48 hours (172800 seconds)
Ready at: December 25, 2025, 3:00 PM UTC
```

#### Salt (bytes32)

Random value for operation uniqueness:
- **Format**: 32-byte hex string
- **Auto-generated**: Random salt generated when entering Step 3
- **Purpose**: Allows duplicate target/data combinations
- **Change**: Enter custom value if needed

**Default**: `0x1234abcd...` (random)

**When to customize**: If you need specific salt for tracking/identification

#### Predecessor (bytes32)

Operation that must execute before this one:
- **Format**: 32-byte operation ID
- **Default**: `0x0000...` (no prerequisite)
- **Use case**: Enforcing execution order between operations

**Example**: If Operation B depends on Operation A:
1. Schedule Operation A (note its operation ID)
2. Schedule Operation B with predecessor = Operation A's ID
3. Operation B cannot execute until A is executed

**Leave as zero** if no dependency required.

### Permission Check

Shows your PROPOSER_ROLE status:
- ✅ "You have permission to schedule operations" (green)
- ❌ "You don't have PROPOSER_ROLE" (red)

If you lack permission:
- Submit button is disabled
- Contact your timelock administrator
- Request PROPOSER_ROLE for your address

### Transaction Simulation

Before you submit, simulation runs automatically:

**Status indicators**:
- ⏳ "Running simulation..." (checking)
- ✅ "Simulation likely succeeds" (good to go)
- ⚠️ "Simulation may fail" (warning, review carefully)
- ❌ "Simulation failed: [error message]" (will not work)

**What it checks**:
- You have PROPOSER_ROLE
- Delay is ≥ minDelay
- Calldata encoding is valid
- Timelock contract is accessible

**Note**: Simulation checks `schedule()` call, not the final `execute()` call.

### Submit Operation

Click **"Schedule Operation"** button:

1. Final validation runs
2. Your wallet opens for approval
3. Review gas fee and approve
4. Transaction is submitted
5. Wait for confirmation

**Transaction details** (in wallet):
- **To**: TimelockController address
- **Function**: `schedule()` or `scheduleBatch()`
- **Gas**: Varies (typically 100k-300k gas)

### Success Screen

After successful scheduling:

#### Success Message
```
✅ Operation scheduled successfully!
```

#### Operation Details
- **Transaction Hash**: Link to Blockscout
- **Operation ID**: Unique identifier (bytes32)
  - Copy button
  - Used to track operation
- **Estimated ETA**: When operation becomes ready
  - Calculated from current time + delay
  - Example: "Ready at: December 25, 2025, 3:00 PM UTC"

#### Next Steps
- **Schedule Another**: Resets wizard for new operation
- **View in Explorer**: Opens Operations Explorer filtered to your operation

[Screenshot placeholder: Success screen with operation ID]

---

## Common Workflows

### Simple Token Transfer

**Goal**: Transfer tokens from timelock

**Steps**:
1. Step 1: Enter token contract address, fetch ABI
2. Step 2: Select `transfer(address,uint256)`
   - `to`: Recipient address
   - `amount`: Token amount (in token's smallest unit)
   - `value`: 0 (no RBTC)
3. Step 3: Set delay, schedule

### Contract Upgrade

**Goal**: Upgrade proxy contract

**Steps**:
1. Step 1: Enter proxy contract address
2. Step 2: Select `upgradeTo(address)`
   - `newImplementation`: Address of new implementation
   - `value`: 0
3. Step 3: Type "CONFIRM" for high-risk gate, schedule

### Batch Treasury Payment

**Goal**: Pay multiple recipients in one atomic operation

**Steps**:
1. Step 1: Enter token contract
2. Step 2:
   - Operation 1: `transfer(recipient1, amount1)`
   - Click "+ Add Operation"
   - Operation 2: `transfer(recipient2, amount2)`
   - Repeat for all recipients
3. Step 3: Review batch summary, schedule

**Benefit**: All transfers succeed together or all fail (atomic)

---

## Best Practices

### Before Scheduling

- ✅ **Verify contract address**: Double-check on Blockscout
- ✅ **Test on testnet first**: Always test complex operations
- ✅ **Verify parameters**: Check addresses, amounts, units
- ✅ **Document purpose**: Keep record of why operation was scheduled
- ✅ **Check simulation**: Ensure simulation succeeds
- ✅ **Review delay**: Ensure delay is appropriate for operation importance

### For Batch Operations

- ✅ **Test individually**: Test each call separately first
- ✅ **Verify order**: Ensure execution order is correct
- ✅ **Check atomicity**: Confirm all-or-nothing is desired behavior
- ✅ **Keep small**: Limit to 5-10 operations for easier review
- ✅ **Document**: Write down what the batch accomplishes

### For High-Risk Operations

- ✅ **Extra verification**: Triple-check upgrade target addresses
- ✅ **Community review**: Share operation ID for review during delay
- ✅ **Test exhaustively**: Test on testnet with identical parameters
- ✅ **Have rollback plan**: Know how to respond if something goes wrong

---

## Troubleshooting

### "Cannot fetch ABI"

**Causes**:
- Contract not verified on Blockscout
- Network error
- Invalid address

**Solutions**:
- Verify contract on Blockscout first
- Use manual ABI upload
- Check network connection

---

### "Simulation failed"

**Causes**:
- Don't have PROPOSER_ROLE
- Delay less than minDelay
- Timelock contract inaccessible

**Solutions**:
- Check your roles in Permissions page
- Increase delay to meet minDelay
- Verify timelock address is correct

---

### "Invalid parameter value"

**Causes**:
- Wrong format for parameter type
- Out of range value
- Invalid address checksum

**Solutions**:
- Check parameter type (address, uint256, etc.)
- Use correct format (0x for addresses/bytes)
- Copy addresses carefully

---

## Tips

### Finding ABIs

If contract isn't verified:
- Check other block explorers (Ethereum, BSC) - may be same code
- Ask contract developers
- Check project's GitHub repository
- Compile source code yourself

### Testing Parameters

Before scheduling on mainnet:
- Deploy same contract on testnet
- Schedule identical operation on testnet
- Execute and verify behavior
- Then schedule on mainnet with confidence

### Organizing Operations

For tracking:
- Use descriptive comments (external documentation)
- Note operation IDs
- Track in spreadsheet or project management tool
- Link to related governance discussions

---

## Related Documentation

- **Operations Explorer**: [Operations Explorer](operations-explorer.md) - View scheduled operations
- **Executing Operations**: [Executing Operations](executing-operations.md) - Execute ready operations
- **Understanding Roles**: [Understanding Roles](understanding-roles.md) - Learn about PROPOSER_ROLE
- **Security**: [Verifying Operations](../security/verifying-operations.md) - Verification best practices
- **Advanced**: [Batch Operations](../advanced-topics/batch-operations.md) - Advanced batch patterns

---

**Ready to create your first proposal?** Start with a simple operation on testnet to get familiar with the process!
