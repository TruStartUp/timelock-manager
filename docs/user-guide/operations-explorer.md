# Operations Explorer

Complete guide to browsing, filtering, and managing timelock operations.

## Overview

The Operations Explorer is the central hub for viewing all operations in your TimelockController. It provides powerful filtering, search, and management capabilities to help you find and act on operations efficiently.

[Screenshot placeholder: Operations Explorer with various filters applied]

## Accessing the Explorer

Click **"Operations Explorer"** in the left sidebar navigation or select "Operations Explorer" from the dashboard stats cards.

## Interface Layout

The Operations Explorer consists of:

1. **Filter Bar** (top): Status tabs and search/filter controls
2. **Active Filters** (below filter bar): Badges showing applied filters with clear buttons
3. **Operations Table** (main area): List of operations with key information
4. **Pagination Controls** (bottom): Page navigation and rows per page selector

## Understanding Operation Columns

### Operation ID

Truncated operation ID (first 8 characters of bytes32 hash).

- **Format**: `0xabc12345...`
- **Click**: Expands row to show full details
- **Copy**: Click to copy full ID to clipboard

### Status

Visual indicator of operation state:

- **Pending** (🟡 Yellow): Scheduled but not yet ready (waiting for delay)
- **Ready** (🟢 Green): Can be executed now
- **Executed** (🔵 Blue): Successfully executed
- **Cancelled** (🔴 Red): Cancelled before execution

Hover over status for tooltip explanation.

### Calls

Number of function calls in the operation:

- **Single call**: Shows "1"
- **Batch**: Shows count (e.g., "5" for batch of 5 calls)

### Targets

Target contract addresses:

- **Single**: Shows truncated address
- **Multiple**: Shows count + "+ N more"
- **Hover**: Tooltip shows all target addresses

### Ready At

Timestamp when operation becomes executable:

- **Future**: Shows countdown timer (e.g., "in 23h 45m")
- **Past**: Shows relative time (e.g., "2 days ago")
- **Color**: Yellow for pending, green when ready

### Proposer

Address that scheduled the operation:

- **Format**: Truncated address (e.g., `0xabc...xyz`)
- **You tag**: Shows "(You)" if it's your address
- **Click**: Opens Blockscout in new tab

### Actions

Available actions based on status and your roles:

- **Execute** (green button): For Ready operations if you have EXECUTOR_ROLE
- **Cancel** (red button): For Pending/Ready operations if you have CANCELLER_ROLE
- **Disabled**: Grayed out if you lack required role

## Filtering Operations

### Status Filter Tabs

Click status tabs to filter by operation state:

- **All**: Shows all operations (default)
- **Pending**: Only operations waiting for delay
- **Ready**: Only operations ready to execute
- **Executed**: Only completed operations
- **Cancelled**: Only cancelled operations

Active filter is highlighted with underline.

### Search by Operation ID

In the search field:

1. Enter full or partial operation ID
2. Search is case-insensitive
3. Matches anywhere in the ID
4. Clear with X button or backspace

**Example**: Search `0xabc` finds all operations with IDs containing "abc"

### Filter by Address

Filter operations by proposer or target address:

1. Click **"Address"** dropdown
2. Enter address (full or truncated)
3. Searches both proposer AND target addresses
4. Press Enter or click outside to apply

**Example**: `0x123...` finds operations proposed by or targeting `0x123...`

### Filter by Date Range

Narrow results to specific time period:

1. Click **"From"** date picker
2. Select start date
3. Click **"To"** date picker
4. Select end date
5. Filter applies immediately

**Filters**: Operations scheduled between selected dates

**Clear**: Click X on date badge or select blank date

### Combining Filters

All filters work together (AND logic):

**Example**: Status=Ready + From=Last Week + Address=0x123
→ Shows only Ready operations from last week involving 0x123

### Active Filter Badges

Applied filters show as badges below filter bar:

- **Status badge**: Shows selected status
- **Address badge**: Shows filtered address (truncated)
- **Date badges**: Shows from/to dates
- **Clear individual**: Click X on specific badge
- **Clear all**: Click "Clear all filters" button

## Expanding Operation Details

Click any operation row to expand full details:

### Operation Metadata

- **Operation ID**: Full bytes32 hash with copy button
- **Status**: Current state with color indicator
- **Proposer**: Full address with Blockscout link
- **Scheduled**: Timestamp when operation was scheduled
- **Ready At**: When operation becomes executable
- **Delay**: Wait time in human-readable format (e.g., "48 hours")
- **Minimum Delay**: TimelockController's minDelay setting
- **Predecessor**: Dependency operation ID (or "None")
- **Salt**: Random bytes32 for uniqueness

[Screenshot placeholder: Expanded operation showing metadata]

### Calls Details

For each call in the operation:

#### Call Header
- **Target Contract**: Address with verification badge
  - ✅ Green check: Verified on Blockscout
  - ⚠️ Yellow warning: Unverified contract
- **Value**: Native RBTC being sent (in ether)
- **Blockscout link**: Opens target contract

#### Decoded Function Call (if ABI available)
- **Function name**: e.g., `transfer(address,uint256)`
- **Parameters table**: Name, Type, Value columns
- **Verification badge**: Shows ABI source
  - ✅ "Verified contract" (Blockscout)
  - ⚠️ "Decoded using guessed signature" (4byte.directory)
  - 🔒 "Manual ABI"

#### Raw Calldata
- **Encoded data**: Full hex-encoded calldata
- **Selector**: First 4 bytes (function selector)
- **Copy button**: Copy calldata to clipboard

#### High-Risk Warnings
Dangerous functions are flagged with red warning:

```
⚠️ HIGH RISK: This operation calls a dangerous function
Function: upgradeTo(address)
```

Functions flagged as high-risk:
- `upgradeTo()` - Proxy upgrades
- `upgradeToAndCall()` - Upgrade with initialization
- `transferOwnership()` - Ownership changes
- `updateDelay()` - Timelock delay changes
- `setImplementation()` - Implementation changes

### AI Explanation (Optional)

If OpenAI integration is enabled:

1. Click **"Explain this operation"** button
2. Wait for AI analysis
3. View generated explanation:
   - **Summary**: What the operation does overall
   - **Per-call explanations**: What each call does
   - **Parameter explanations**: Human-readable parameter values

**Note**: AI explanations are best-effort and should be verified manually.

### Decoder Link

Click **"Open in Decoder"** to:
- Load calldata in standalone decoder
- Perform deeper analysis
- Share decoded operation via URL

## Executing Operations

For operations with **Ready** status and when you have EXECUTOR_ROLE:

### Step 1: Click Execute Button

Green **"Execute"** button appears in Actions column.

### Step 2: Review Execute Dialog

Modal shows:

#### Operation Summary
- Operation ID
- Target contract(s)
- Total value being sent
- Number of calls

#### Decoded Calls (if ABI available)
For each call:
- Function signature
- Typed parameters
- ABI verification status

#### Transaction Simulation
- **Running simulation...**: eth_call in progress
- **Simulation likely succeeds**: Transaction should work
- **Simulation may fail**: Warning about potential revert
- **Error details**: If simulation fails, shows revert reason

#### Actions
- **Open in Decoder**: Link to analyze calldata further
- **Cancel**: Close dialog without executing
- **Execute**: Proceed with execution

[Screenshot placeholder: Execute confirmation dialog]

### Step 3: Confirm Execution

1. Review all details carefully
2. Verify simulation succeeded
3. Click **"Execute"** button
4. Approve transaction in wallet
5. Wait for confirmation

### Step 4: Execution Complete

Success message shows:

```
✅ Operation executed successfully!
Transaction: 0xabc123... (View on Blockscout)
```

Operation status updates to **Executed** automatically.

### Execution Errors

Common errors:

**"TimelockController: operation is not ready"**
- Cause: Timestamp hasn't passed yet
- Solution: Wait until Ready At time

**"AccessControl: account ... is missing role"**
- Cause: Your address lacks EXECUTOR_ROLE
- Solution: Request role from admin or use different wallet

**"TimelockController: operation already executed"**
- Cause: Someone else executed it first
- Solution: Refresh page to see updated status

## Cancelling Operations

For operations with **Pending** or **Ready** status and when you have CANCELLER_ROLE:

### Step 1: Click Cancel Button

Red **"Cancel"** button appears in Actions column.

### Step 2: Review Cancel Dialog

Modal shows:

#### Operation Information
- Operation ID (full)
- Current status
- Proposer address
- Target contract(s)
- Scheduled timestamp

#### Simulation
- Runs `cancel()` simulation
- Shows if cancellation will succeed

#### Warning
```
⚠️ This action cannot be undone.
Are you sure you want to cancel this operation?
```

[Screenshot placeholder: Cancel confirmation dialog]

### Step 3: Confirm Cancellation

1. Review operation details
2. Verify it's the correct operation
3. Click **"Cancel Operation"** button
4. Approve transaction in wallet
5. Wait for confirmation

### Step 4: Cancellation Complete

Success message shows:

```
✅ Operation cancelled successfully!
Transaction: 0xabc123... (View on Blockscout)
```

Operation status updates to **Cancelled**.

### Why Cancel Operations?

**Security**: Malicious or incorrect proposal detected
**Changed plans**: Operation no longer needed
**Error correction**: Parameters were wrong
**Emergency response**: Prevent unwanted execution

## Pagination

Navigate large lists efficiently:

### Rows Per Page

Dropdown at bottom-left:
- Options: 25, 50, 100 rows
- Default: 25
- Higher values = fewer page loads, more scrolling

### Page Navigation

Bottom-right controls:
- **Previous**: Go to previous page (disabled on page 1)
- **Next**: Go to next page (disabled on last page)
- **Results counter**: Shows "1-25 of 150 operations"

### Virtualization

For performance, the table uses virtualization:
- Only visible rows are rendered
- Smooth scrolling even with 1000s of operations
- Minimal memory usage

## Performance Tips

### For Large Operation Lists

1. **Use filters**: Narrow results before browsing
2. **Increase rows per page**: Fewer page loads
3. **Search by ID**: Fastest way to find specific operation
4. **Date range**: Limit to recent operations

### For Slow Loading

If operations load slowly:

1. **Check subgraph status**: Console may show "Subgraph unavailable"
2. **App falls back to Blockscout**: Slower but works
3. **Wait for subgraph**: Performance improves when subgraph available
4. **Reduce filters**: Simpler queries are faster

## Keyboard Shortcuts

- **Enter**: Expand/collapse selected operation
- **Tab**: Navigate between filter inputs
- **Escape**: Close expanded operation details
- **Space**: Toggle checkboxes in filters

## Mobile View

On smaller screens:

- Table becomes scrollable horizontally
- Some columns hide to save space
- Touch to expand operations
- Filters stack vertically

## Integration with Other Features

### From Dashboard

Dashboard stat cards link directly to filtered views:
- **Pending count** → Opens with Status=Pending
- **Ready count** → Opens with Status=Ready
- **Executed count** → Opens with Status=Executed

### To Decoder

Click **"Open in Decoder"** to analyze calldata:
- Pre-loads operation calldata
- Pre-loads target contract address
- Maintains context for easy navigation back

### To Permissions

Click proposer address to:
- View on Blockscout
- See what roles that address has
- Check operation history for that proposer

## Troubleshooting

### No Operations Showing

**Possible causes**:
1. Subgraph not deployed or not synced
2. Wrong timelock selected
3. Network mismatch
4. Filters too restrictive

**Solutions**:
1. Check browser console for errors
2. Verify correct timelock selected in header
3. Clear all filters
4. Check wallet is on correct network

See: [Subgraph Issues](../troubleshooting/subgraph-issues.md)

---

### Operations Not Updating

**Cause**: Cache not invalidated

**Solution**:
- Refresh page
- Operations auto-refresh every 30 seconds
- New blocks trigger automatic refetch

---

### Cannot Execute/Cancel

**Cause**: Missing required role

**Solution**:
1. Check Permissions page for your roles
2. Ask admin to grant required role
3. Ensure wallet is connected and on correct network

See: [Permission Errors](../troubleshooting/permission-errors.md)

## Best Practices

### Regular Monitoring

- Check Operations Explorer daily
- Review all Pending operations
- Verify Ready operations before execution
- Monitor for unexpected proposals

### Before Executing

1. ✅ Verify operation details
2. ✅ Decode and understand calldata
3. ✅ Check simulation succeeds
4. ✅ Confirm Ready At timestamp passed
5. ✅ Verify you have authority to execute
6. ✅ Document execution reason

See: [Security Best Practices](../security/best-practices.md)

### Filtering Strategy

- **Daily use**: Filter by Status=Ready
- **Auditing**: Use date ranges for historical review
- **Monitoring specific addresses**: Filter by proposer
- **Finding operation**: Search by partial ID

## Related Pages

- **Creating proposals**: [Creating Proposals](creating-proposals.md)
- **Executing operations**: [Executing Operations](executing-operations.md)
- **Cancelling operations**: [Cancelling Operations](cancelling-operations.md)
- **Understanding roles**: [Understanding Roles](understanding-roles.md)
- **Decoder**: [Calldata Decoder](calldata-decoder.md)

---

**Master the Operations Explorer to effectively manage your timelock governance!**
