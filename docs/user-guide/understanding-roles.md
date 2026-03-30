# Understanding Roles

Complete guide to TimelockController roles and permissions.

## Overview

TimelockController uses role-based access control (RBAC) to manage who can perform different governance actions. Understanding roles is essential for safe and effective governance participation.

## The Four Core Roles

### PROPOSER_ROLE

**Permission**: Schedule new operations

**Role Hash**: `0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1`

**Actions**:
- Schedule single operations via `schedule()`
- Schedule batch operations via `scheduleBatch()`
- **Cannot** execute or cancel (separation of duties)

**Risk Level**: 🔴 High

**Why it's high risk**: Can schedule ANY operation, including malicious ones. However, the delay period provides time for review and cancellation.

**Best practices**:
- Grant to trusted DAO members or multi-sig
- Require multiple approvals for proposals
- Monitor all scheduled operations
- Revoke immediately if compromised

---

### EXECUTOR_ROLE

**Permission**: Execute operations that are ready

**Role Hash**: `0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63`

**Actions**:
- Execute ready operations via `execute()`
- Execute ready batch operations via `executeBatch()`
- **Cannot** schedule or cancel

**Risk Level**: 🟡 Medium

**Why medium risk**: Can only execute operations that were already scheduled and reviewed during the delay period. Cannot create new operations.

**Best practices**:
- Grant to operational team members
- Separate from proposer role (checks and balances)
- Monitor execution transactions
- Ensure executors verify operations before executing

---

### CANCELLER_ROLE

**Permission**: Cancel pending or ready operations

**Role Hash**: `0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783`

**Actions**:
- Cancel operations via `cancel()`
- Cancel both pending and ready operations
- **Cannot** schedule or execute

**Risk Level**: 🟢 Low

**Why low risk**: Can only prevent execution (defensive action). Cannot create or execute operations. Worst case is DoS by cancelling legitimate operations.

**Best practices**:
- Grant to security team and incident responders
- Broader access than proposer (quick response)
- Use for emergency situations
- Document cancellation reasons

---

### DEFAULT_ADMIN_ROLE

**Permission**: Grant and revoke all roles

**Role Hash**: `0x0000000000000000000000000000000000000000000000000000000000000000`

**Actions**:
- Grant any role via `grantRole()`
- Revoke any role via `revokeRole()`
- Control entire governance system

**Risk Level**: 🔴🔴 Critical

**Why critical**: Has ultimate control. Can grant itself or others any role, effectively controlling all governance.

**Best practices**:
- **MUST** be multi-sig or DAO contract
- **NEVER** grant to externally owned account (EOA)
- Require governance vote for role changes
- Minimal number of admins
- Regular audits of role grants

## Role Relationships

```
DEFAULT_ADMIN_ROLE (God mode)
    │
    ├─ Can grant/revoke → PROPOSER_ROLE
    ├─ Can grant/revoke → EXECUTOR_ROLE
    ├─ Can grant/revoke → CANCELLER_ROLE
    └─ Can grant/revoke → DEFAULT_ADMIN_ROLE (itself)

PROPOSER_ROLE → Schedules → Operations
EXECUTOR_ROLE → Executes → Ready Operations
CANCELLER_ROLE → Cancels → Pending/Ready Operations
```

## Checking Your Roles

### In Timelock Manager

1. Navigate to **Permissions** page
2. Your roles are highlighted
3. Shows "You" tag next to your address

Or check individual role pages:
- Click any role to see all members
- Your address marked with "You" indicator

### Required Roles for Actions

| Action | Required Role | Page |
|--------|---------------|------|
| View operations | None (public) | Operations Explorer |
| Decode calldata | None (public) | Decoder |
| **Schedule operation** | **PROPOSER_ROLE** | New Proposal |
| **Execute operation** | **EXECUTOR_ROLE** | Operations Explorer |
| **Cancel operation** | **CANCELLER_ROLE** | Operations Explorer |
| View roles | None (public) | Permissions |
| Grant/revoke roles | DEFAULT_ADMIN_ROLE | Direct contract call |

## Multiple Roles

An address can have multiple roles:

**Example**:
- Alice has PROPOSER + CANCELLER
  - Can schedule and cancel
  - Cannot execute (separation of duties)

- Bob has EXECUTOR only
  - Can only execute
  - Cannot schedule or cancel

- Multi-sig has DEFAULT_ADMIN_ROLE
  - Can grant/revoke all roles
  - Controlled by multiple signers

## Role Grant Process

Roles are granted on-chain through the TimelockController:

### How Roles Are Granted

1. **Admin proposes role grant**:
   - Calls `schedule(grantRole(ROLE, address))`
   - Sets appropriate delay

2. **Community reviews during delay**

3. **Executor executes the grant**:
   - Calls `execute(grantRole(ROLE, address))`
   - Role is granted

4. **New member can now act**:
   - Uses their new role permissions

### How Roles Are Revoked

Same process but with `revokeRole()`:
1. Admin schedules revocation
2. Delay period for review
3. Executor executes revocation
4. Address loses role

## Best Practices by Role

### For Proposers

- ✅ Test on testnet first
- ✅ Document all proposals
- ✅ Use descriptive parameters
- ✅ Verify addresses before scheduling
- ✅ Expect delays for review

### For Executors

- ✅ Verify operations before executing
- ✅ Check simulation succeeds
- ✅ Decode and understand calldata
- ✅ Confirm ready timestamp passed
- ✅ Execute promptly when ready

### For Cancellers

- ✅ Monitor for suspicious operations
- ✅ Cancel only when necessary
- ✅ Document cancellation reasons
- ✅ Notify community after cancellation
- ✅ Investigate how malicious proposals were scheduled

### For Admins

- ✅ Use multi-sig wallet
- ✅ Require governance vote
- ✅ Regular role audits
- ✅ Revoke compromised addresses immediately
- ✅ Document all role changes

## Common Role Configurations

### Small DAO

```
DEFAULT_ADMIN_ROLE: 3-of-5 multi-sig
PROPOSER_ROLE: 2-of-3 core team multi-sig
EXECUTOR_ROLE: Trusted operator (EOA)
CANCELLER_ROLE: All core team members
```

### Large DAO

```
DEFAULT_ADMIN_ROLE: DAO governance contract
PROPOSER_ROLE: Elected governance committee (5-of-9)
EXECUTOR_ROLE: Operational team (3 addresses)
CANCELLER_ROLE: Security team (10 addresses)
```

### Protocol with Timelock

```
DEFAULT_ADMIN_ROLE: Timelock itself (self-governed)
PROPOSER_ROLE: DAO voting contract
EXECUTOR_ROLE: Public (anyone can execute)
CANCELLER_ROLE: Emergency multi-sig
```

## Role Security

### Separation of Duties

**Best practice**: Don't give one address all roles

**Why**: Checks and balances
- Proposer cannot immediately execute their own proposals
- Executor cannot schedule malicious operations
- Canceller provides safety net

**Example of good separation**:
```
✅ Alice: PROPOSER
✅ Bob: EXECUTOR
✅ Carol: CANCELLER
✅ Multi-sig: DEFAULT_ADMIN
```

**Example of bad configuration**:
```
❌ Alice: PROPOSER + EXECUTOR + CANCELLER
   (Can schedule and immediately execute without review)
```

### Principle of Least Privilege

Grant only necessary roles:
- Need to schedule? → PROPOSER only
- Need to execute? → EXECUTOR only
- Need both? → Consider if really necessary

### Regular Audits

Periodically review:
- Who has which roles?
- Are all role holders still active/trusted?
- Any addresses need revocation?
- Any new members need roles?

View role history in Permissions page to track changes.

## Troubleshooting

### "You don't have permission"

**Cause**: You lack required role

**Check**:
1. Permissions page → See your roles
2. Verify you're using correct wallet
3. Verify you're on correct network

**Solution**: Ask admin to grant required role

---

### "Access denied"

**Cause**: Transaction requires role you don't have

**Solution**: Use different wallet that has the role, or request role grant

See: [Permission Errors](../troubleshooting/permission-errors.md)

## Related Documentation

- [Viewing Permissions](viewing-permissions.md) - Check role grants
- [Role Management](../security/role-management.md) - Secure role practices
- [Role Types](../reference/role-types.md) - Technical reference

---

**Understanding roles is key to safe governance participation. When in doubt, ask before acting!**
