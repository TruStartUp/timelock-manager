---
hidden: true
---

# Subgraph Issues

Solutions for common subgraph problems and data loading issues.

## No Operations Loading

### Symptoms

* Operations Explorer shows empty state
* Dashboard shows zero operations
* Browser console: "Subgraph unavailable, using Blockscout"

### Diagnosis

**Check 1: Is subgraph URL set?**

```bash
# Check .env.local
cat .env.local | grep SUBGRAPH_URL
```

**Check 2: Is subgraph deployed?**

* Go to The Graph Studio
* Check your subgraph exists
* Check deployment status

**Check 3: Test subgraph directly**

* Open subgraph Playground in Studio
* Run test query:

```graphql
{ _meta { hasIndexingErrors } }
```

### Solutions

**Problem: URL not set**

```bash
# Add to .env.local
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...
```

Restart app: `npm run dev`

**Problem: Wrong URL format**

```bash
# ❌ Wrong (Studio UI URL):
https://thegraph.com/studio/subgraph/rootstock-timelock-testnet

# ✅ Correct (Query URL):
https://api.studio.thegraph.com/query/12345/rootstock-timelock-testnet/v0.0.1
```

**Problem: Subgraph not deployed**

* Follow [Deploying to Testnet](../subgraph-deployment/deploying-testnet.md)

**Workaround: Use Blockscout fallback**

* App automatically falls back to Blockscout
* Slower but functional
* No configuration needed

***

## Subgraph Syncing Slowly

### Symptoms

* Studio shows "Syncing" for long time
* Progress percentage stuck
* Operations not appearing in app

### Expected Sync Times

* **Testnet**: 5-30 minutes (typical)
* **Mainnet**: 1-4 hours (if long chain)
* **Fresh deployment**: Faster

### Check Progress

In The Graph Studio:

1. Go to your subgraph
2. Check "Indexing Status"
3. View sync percentage and current block

**Normal**: Steady progress, percentage increasing

**Problem**: Stuck at same percentage for >30 minutes

### Solutions

**If stuck**:

1. Check Studio logs for errors
2. Verify `startBlock` is correct
3. Check contract address is valid
4. Redeploy if needed

**While waiting**:

* App works via Blockscout fallback
* Queries are slower but functional
* Wait for sync to complete for full performance

***

## Stale Data

### Symptoms

* Executed operation still shows "Ready"
* New operations not appearing
* Data seems outdated

### Check Sync Status

Query `_meta` in Studio Playground:

```graphql
{
  _meta {
    block {
      number
      timestamp
    }
  }
}
```

Compare block number to current block on Blockscout.

**Normal lag**: 1-5 blocks behind

**Problem**: >20 blocks behind

### Solutions

**Client-side cache**:

```javascript
// In browser console
localStorage.clear()
location.reload()
```

**TanStack Query cache**:

* Wait 30 seconds (auto-refresh)
* Or refresh page

**Subgraph lag**:

* Check Studio for sync status
* If far behind, may be indexing issue
* Check logs for errors

***

## Indexing Errors

### Symptoms

* Studio shows "Failed" status
* Red errors in logs
* Operations missing

### Common Errors

**Error: "Unknown contract address"**

```
Could not find contract at address 0x...
```

**Cause**: Wrong `startBlock` (before deployment) or wrong address

**Solution**:

1. Find correct deployment block on Blockscout
2. Update `networks.json` and `subgraph.yaml`
3. Redeploy:

```bash
cd subgraph/rootstock-timelock-testnet
npm run deploy
```

***

**Error: "Revert in mapping"**

```
Mapping terminated at...
```

**Cause**: Bug in mapping code or unexpected data

**Solution**:

1. Check Studio logs for specific error
2. Review `src/mapping.ts`
3. Fix bug
4. Redeploy

***

**Error: "Network not supported"**

```
Network rootstock-testnet not found
```

**Cause**: Network name mismatch

**Solution**: Verify `network:` in `subgraph.yaml` matches Studio configuration

***

## Query Performance Issues

### Symptoms

* Operations take >5 seconds to load
* Timeout errors
* Slow page loads

### Diagnosis

Check query complexity:

* How many operations?
* How many filters?
* Date range size?

### Solutions

**Reduce query size**:

* Use pagination (first: 25)
* Narrow date range
* Apply specific filters

**Check subgraph health**:

* Studio → Health
* Look for "Out of sync" warnings

**Consider subgraph optimization**:

* Review schema for missing indexes
* Optimize mapping code

***

## Subgraph Unavailable

### Symptoms

* Console: "Subgraph unavailable, using Blockscout"
* All queries fail
* 404 or 500 errors

### Check Status

**1. Test URL manually**:

```bash
curl https://api.studio.thegraph.com/query/.../.../_meta
```

**2. Check Studio dashboard**:

* Is deployment active?
* Any errors shown?

**3. Check The Graph status**:

* [status.thegraph.com](https://status.thegraph.com/)

### Solutions

**Problem: Wrong URL**

* Verify URL from Studio
* Check for typos
* Ensure version in URL is correct

**Problem: Subgraph unpublished**

* Redeploy subgraph
* Wait for "Active" status

**Problem: The Graph down**

* Wait for service restoration
* App falls back to Blockscout (slower but works)

***

## CORS Errors

### Symptoms

* Browser console: "CORS policy error"
* Network tab shows blocked requests
* Subgraph queries fail

### Cause

Unusual - The Graph Studio allows CORS by default

### Solutions

**Check URL**: Ensure using official Studio URL

**Check browser extensions**: Disable ad blockers temporarily

**Try different browser**: Test in incognito mode

***

## Deployment Issues

### Error: "Subgraph name already exists"

**Cause**: Trying to create duplicate

**Solution**: Use existing subgraph or choose different name

***

### Error: "Authentication failed"

**Cause**: Invalid or expired deploy key

**Solution**:

```bash
# Re-authenticate
npx graph auth --studio <NEW_DEPLOY_KEY>
```

Get new key from Studio dashboard.

***

### Error: "Build failed"

**Cause**: Syntax error or invalid configuration

**Solution**:

1. Check error message details
2. Common causes:
   * Invalid ABI JSON
   * Syntax error in mappings
   * Missing imports
3. Fix and rebuild:

```bash
npm run build
```

***

## Version Confusion

### Symptoms

* Deployed new version but app shows old data
* URL changed after deployment

### Solutions

**Update .env.local**:

```bash
# Old URL (v0.0.1):
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=.../v0.0.1

# New URL (v0.0.2):
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=.../v0.0.2
```

**Restart app**:

```bash
npm run dev
```

**Check Studio**: Verify "Current" label on desired version

***

## Debugging Checklist

When troubleshooting subgraph issues:

* [ ] Subgraph deployed and showing "Synced" status
* [ ] Query URL correct in `.env.local`
* [ ] App restarted after env changes
* [ ] Test query works in Studio Playground
* [ ] No indexing errors in Studio logs
* [ ] `startBlock` is before first operation
* [ ] Contract address matches deployment
* [ ] Both `networks.json` and `subgraph.yaml` updated
* [ ] Browser cache cleared
* [ ] No CORS errors in console
* [ ] The Graph status page shows no outages

***

## Getting Help

**Studio Logs**: Check deployment logs in The Graph Studio for detailed errors

**The Graph Discord**: [discord.gg/thegraph](https://discord.gg/thegraph)

**Documentation**: [thegraph.com/docs](https://thegraph.com/docs)

**Fallback**: App automatically uses Blockscout when subgraph unavailable

***

## Prevention

**Best practices to avoid issues**:

1. ✅ Test queries in Playground before deploying app
2. ✅ Double-check `startBlock` and address
3. ✅ Update both config files together
4. ✅ Monitor Studio for sync status
5. ✅ Keep deploy keys secure
6. ✅ Document subgraph URLs for each environment

***

**Remember**: App works without subgraph via Blockscout fallback. Subgraph provides better performance but isn't required for functionality.
