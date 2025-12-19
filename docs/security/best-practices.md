# Security Best Practices

Essential security guidelines for safe governance operations.

## Overview

Timelock Manager interacts with powerful governance contracts. A single malicious or incorrect operation can have irreversible consequences. Follow these best practices to minimize risk.

## General Principles

### 1. Verify Before Execute

**Never execute without understanding**

- ✅ Always decode calldata and review what it does
- ✅ Check target contract addresses on Blockscout
- ✅ Verify parameter values (addresses, amounts, units)
- ✅ Use AI explanations for additional clarity
- ❌ Don't execute based solely on operation ID or proposer reputation

---

### 2. Test on Testnet First

**Dry-run complex operations**

- ✅ Deploy same contracts on testnet
- ✅ Schedule identical operation on testnet
- ✅ Execute and verify behavior
- ✅ Only then schedule on mainnet
- ❌ Don't test critical operations directly on mainnet

---

### 3. Multi-Signature for High-Risk Roles

**Distribute trust**

- ✅ Use multi-sig for PROPOSER_ROLE
- ✅ Use multi-sig for DEFAULT_ADMIN_ROLE
- ✅ Require multiple approvals for critical operations
- ❌ Don't give single EOA full control

---

### 4. Separation of Duties

**Implement checks and balances**

- ✅ Different addresses for different roles
- ✅ Proposer cannot execute their own proposals immediately
- ✅ Canceller provides safety net
- ❌ Don't grant all roles to one address

---

### 5. Principle of Least Privilege

**Grant minimum necessary permissions**

- ✅ Grant only required roles
- ✅ Revoke roles when no longer needed
- ✅ Regular audits of role memberships
- ❌ Don't grant roles "just in case"

---

## Before Scheduling Operations

### Verify Target Contract

1. **Check address on Blockscout**:
   - Confirm it's the intended contract
   - Verify contract is verified and matches expectations
   - Check if it's a proxy (verify implementation too)

2. **Review contract code**:
   - If open source, review function being called
   - Check for known vulnerabilities
   - Verify contract hasn't been exploited before

---

### Review Function Parameters

1. **Understand each parameter**:
   - What does this value do?
   - Is it in correct units (wei vs ether, seconds vs blocks)?
   - Are addresses checksummed correctly?

2. **Verify values make sense**:
   - Transfer amount: Is 1000000000000000000 wei = 1 RBTC correct?
   - Address: Is this the right recipient/target?
   - Time: Are seconds vs minutes vs hours correct?

---

### Decode and Review Calldata

1. **Use the Decoder**:
   - Paste calldata
   - Verify decoded output matches intent
   - Check for unexpected nested calls

2. **Verify ABI source**:
   - ✅ Verified contract (high confidence)
   - ⚠️ Guessed signature (low confidence - verify manually)

3. **Check for high-risk functions**:
   - upgradeTo() → Verify new implementation
   - transferOwnership() → Verify new owner
   - updateDelay() → Ensure delay remains reasonable

---

### Test Simulation

Before scheduling:

1. Check simulation results
2. "Simulation likely succeeds" is good
3. "Simulation may fail" → investigate why
4. "Simulation failed" → fix before scheduling

---

## High-Risk Operations

### Upgrade Operations

**Extra precautions for upgradeTo() calls**:

- ✅ Verify new implementation contract address
- ✅ Check implementation is audited
- ✅ Verify storage layout compatibility
- ✅ Test upgrade on testnet fork
- ✅ Have rollback plan
- ❌ Don't upgrade without thorough review

---

### Ownership Transfers

**Extra precautions for transferOwnership()**:

- ✅ Verify new owner address (triple-check!)
- ✅ Confirm new owner is multi-sig or DAO
- ✅ Test on testnet first
- ✅ Verify new owner can manage contract
- ❌ Don't transfer to EOA for production
- ❌ Don't transfer to unverified address

---

### Delay Changes

**Extra precautions for updateDelay()**:

- ✅ Verify new delay is reasonable (24-72 hours typical)
- ✅ Ensure delay doesn't become too short (<12 hours risky)
- ✅ Ensure delay doesn't become too long (>7 days reduces agility)
- ✅ Community consensus on delay change
- ❌ Don't reduce delay without strong justification

---

### Batch Operations

**All-or-nothing execution**:

- ✅ Test each call individually first
- ✅ Verify execution order is correct
- ✅ Confirm atomicity is desired
- ✅ Keep batches small (<10 calls)
- ❌ Don't create complex batches without testing

---

## Role Management

### Granting Roles

**Before granting**:

- ✅ Verify recipient address (copy carefully!)
- ✅ Confirm they understand responsibilities
- ✅ Document reason for grant
- ✅ Use timelock delay for review
- ❌ Don't grant roles hastily

---

### Revoking Roles

**When to revoke**:

- 🔴 Immediately: Compromised private key
- 🔴 Immediately: Malicious behavior detected
- 🟡 Soon: Member no longer active
- 🟡 Soon: Role no longer needed

**How to revoke**:
1. Schedule revocation via timelock
2. Use delay for review
3. Execute after delay
4. Verify revocation succeeded

---

### Admin Role Security

**DEFAULT_ADMIN_ROLE is critical**:

- ✅ **MUST** be multi-sig or DAO
- ✅ **MUST** require multiple approvals
- ✅ Regular audits of admin members
- ❌ **NEVER** single EOA as admin in production
- ❌ **NEVER** admin keys on hot wallet

---

## Operation Dependencies

### Using Predecessor Field

**When one operation depends on another**:

- ✅ Set predecessor to first operation's ID
- ✅ Document dependency reason
- ✅ Verify first operation is legitimate
- ❌ Don't create circular dependencies
- ❌ Don't create complex dependency chains

---

## Monitoring & Response

### Active Monitoring

**Watch for unexpected operations**:

- ✅ Check Operations Explorer daily
- ✅ Review all new Pending operations
- ✅ Set up alerts for new operations (if possible)
- ✅ Monitor role changes
- ❌ Don't assume all operations are legitimate

---

### Incident Response

**If malicious operation detected**:

1. **DO NOT PANIC** - You have until delay expires
2. **Verify** - Confirm it's actually malicious
3. **Cancel** - Use CANCELLER_ROLE immediately
4. **Investigate** - Who scheduled it? How?
5. **Revoke** - Remove compromised role
6. **Document** - Record incident for post-mortem
7. **Notify** - Alert community

---

### Compromised Role

**If a role is compromised**:

1. **Revoke immediately** via admin
2. **Cancel pending operations** from that address
3. **Review history** - what did they schedule?
4. **Rotate keys** - Set up new address
5. **Post-mortem** - How did compromise occur?

---

## Audit Trail

### Leverage Blockchain Immutability

**All actions are recorded**:

- ✅ Transaction hashes provide proof
- ✅ Timestamps establish sequence
- ✅ Proposer addresses establish accountability
- ✅ Event logs are immutable

---

### Query Historical Operations

Use subgraph to audit:

```graphql
{
  operations(
    where: { proposer: "0xAddress" }
    orderBy: scheduledAt
    orderDirection: desc
  ) {
    id
    target
    scheduledAt
    executedAt
    status
  }
}
```

---

## Network Security

### RPC Endpoints

**Secure your connection**:

- ✅ Use trusted RPC providers
- ✅ Consider running your own node
- ✅ Monitor for RPC manipulation
- ❌ Don't use untrusted public RPCs for critical operations

---

### Wallet Security

**Protect your keys**:

- ✅ Use hardware wallets for production
- ✅ Never share private keys
- ✅ Verify transaction details in wallet
- ✅ Be wary of phishing
- ❌ Don't use same keys across chains
- ❌ Don't keep large amounts in hot wallets

---

## Checklist: Before Executing

Use this checklist for every execution:

- [ ] Operation purpose is clear and documented
- [ ] Target contract verified on Blockscout
- [ ] Calldata decoded and reviewed
- [ ] All parameters validated
- [ ] Tested on testnet (if complex operation)
- [ ] No high-risk warnings (or justified and reviewed)
- [ ] Predecessor operation (if any) is legitimate
- [ ] Ready timestamp is appropriate
- [ ] Simulation succeeds
- [ ] Using correct wallet (not compromised)
- [ ] Multi-sig approval obtained (if required)
- [ ] Team notified of execution

---

## Red Flags

**Cancel or investigate if you see**:

- 🚩 Unknown proposer address
- 🚩 Target contract not verified
- 🚩 Unexplained parameter values
- 🚩 Very short delay (<12 hours)
- 🚩 Unusual timing (middle of night)
- 🚩 High-risk function without explanation
- 🚩 Multiple similar operations in short time
- 🚩 Operation scheduled immediately after role grant

---

## Resources

- **OpenZeppelin Security**: [docs.openzeppelin.com/contracts/security](https://docs.openzeppelin.com/contracts/)
- **Timelock Documentation**: [docs.openzeppelin.com/contracts/api/governance#TimelockController](https://docs.openzeppelin.com/contracts/api/governance#TimelockController)
- **Verifying Operations**: [Verifying Operations](verifying-operations.md)
- **Dangerous Operations**: [Dangerous Operations](dangerous-operations.md)

---

## Remember

**Security is everyone's responsibility**

- Trust but verify
- Question everything
- Document decisions
- Learn from mistakes
- When in doubt, ask

**The delay period exists for review - use it!**

---

**Stay vigilant and govern safely!**
