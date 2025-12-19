# Deployment

Guide for deploying Timelock Manager to production environments.

## Overview

This section covers everything needed to deploy Timelock Manager to production, including platform-specific guides, configuration checklists, environment variables, and monitoring setup.

## Deployment Guides

1. [Vercel Deployment](vercel-deployment.md) - Deploy to Vercel (recommended)
2. [Production Checklist](production-checklist.md) - Pre-launch verification checklist
3. [Environment Variables](environment-variables.md) - Production environment configuration
4. [Monitoring](monitoring.md) - Health checks and monitoring setup

## Recommended Platform: Vercel

Timelock Manager is optimized for deployment on Vercel:

- **Framework**: Built with Next.js (Vercel's framework)
- **Performance**: Edge network for global distribution
- **Simplicity**: Git-based deployment workflow
- **Free tier**: Generous free tier for small projects

See: [Vercel Deployment](vercel-deployment.md)

## Quick Deployment

### Prerequisites
- Code pushed to GitHub/GitLab/Bitbucket
- Vercel account
- WalletConnect Project ID
- The Graph subgraph deployed

### Deploy in 5 Minutes

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com/)
   - Import your repository
   - Select "Next.js" framework preset

2. **Configure Environment Variables**
   ```
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
   NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...
   ```

3. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Visit your deployment URL

4. **Verify**
   - Connect wallet
   - Configure timelock
   - Test operations explorer

## Deployment Checklist

Before going to production, verify:

### Required

- [ ] **Subgraph Deployed** - Mainnet subgraph deployed and synced
- [ ] **Environment Variables** - All required vars configured
- [ ] **WalletConnect** - Project ID obtained and configured
- [ ] **DNS** - Custom domain configured (optional)
- [ ] **HTTPS** - SSL certificate active
- [ ] **Testing** - App tested on production URL

### Recommended

- [ ] **Custom RPC** - Using dedicated RPC endpoint
- [ ] **Monitoring** - Error tracking configured
- [ ] **Analytics** - Usage analytics set up
- [ ] **Documentation** - User guides prepared
- [ ] **Support** - Support channel established

### Optional

- [ ] **OpenAI API** - AI explanations enabled
- [ ] **Testnet Support** - Testnet enabled for testing
- [ ] **Custom Blockscout** - Custom Blockscout instance
- [ ] **Backup RPC** - Multiple RPC endpoints configured

See: [Production Checklist](production-checklist.md)

## Environment Configuration

### Minimal Production Config

```bash
# Required
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123...
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...
```

### Recommended Production Config

```bash
# Wallet Connection
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=abc123...

# Subgraphs
NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...
NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL=https://api.studio.thegraph.com/.../...

# Custom RPC (recommended for production)
NEXT_PUBLIC_RSK_MAINNET_RPC_URL=https://your-dedicated-rpc.com

# Testnet Support (optional)
NEXT_PUBLIC_ENABLE_TESTNETS=true

# AI Features (optional)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5-nano
```

See: [Environment Variables](environment-variables.md)

## Deployment Platforms

### Vercel (Recommended)

**Pros**:
- Optimized for Next.js
- Automatic HTTPS
- Git-based deployments
- Edge network
- Free tier

**Cons**:
- Serverless architecture (cold starts)
- Limited build minutes on free tier

See: [Vercel Deployment](vercel-deployment.md)

---

### Self-Hosted

**Pros**:
- Full control
- No platform limits
- Custom infrastructure

**Cons**:
- Manage infrastructure yourself
- SSL certificate setup
- Scaling complexity

**Requirements**:
- Node.js 18.17+
- npm or yarn
- Web server (nginx/Apache)
- Process manager (PM2)

---

### Docker

**Pros**:
- Consistent environment
- Easy to scale
- Portable

**Cons**:
- Requires Docker knowledge
- Image size considerations

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Build Process

### Local Build

```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Test production build locally
npm run start
```

Output: `.next/` directory with optimized build

### Environment-Specific Builds

Production build requires environment variables at build time for Next.js:

```bash
# Set build-time env vars
export NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
export NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL=...

# Build
npm run build
```

## Performance Optimization

### Build Optimizations

- **Code splitting**: Automatic per-page bundles
- **Tree shaking**: Removes unused code
- **Minification**: Compressed JavaScript and CSS
- **Image optimization**: Next.js Image component

### Runtime Optimizations

- **Static generation**: Pre-render where possible
- **ISR**: Incremental static regeneration for dynamic data
- **Edge caching**: CDN caching for static assets
- **API routes**: Server-side API calls

### Recommended Settings

```javascript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  reactStrictMode: true,
}
```

## Security Considerations

### Environment Variables

- **Never commit** `.env.local` or `.env.production`
- **Server-side only**: `OPENAI_API_KEY` is never exposed to client
- **Public variables**: All `NEXT_PUBLIC_*` vars are exposed in browser
- **Secrets management**: Use platform secrets (Vercel environment variables)

### Headers

Configure security headers:

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}
```

### Dependencies

- **Regular updates**: Keep dependencies up to date
- **Security audits**: Run `npm audit` regularly
- **Lock files**: Commit `package-lock.json`

## Monitoring & Observability

### Health Checks

- **Endpoint**: `/api/health` (create if needed)
- **Checks**: Database connectivity, external API health
- **Uptime monitoring**: UptimeRobot, Pingdom

### Error Tracking

Recommended tools:
- Sentry
- LogRocket
- Datadog

### Analytics

- **User analytics**: Plausible, Google Analytics
- **Performance**: Vercel Analytics, Web Vitals
- **RUM**: Real User Monitoring

See: [Monitoring](monitoring.md)

## Rollback Strategy

### Vercel Rollback

1. Go to Vercel dashboard
2. Select deployment
3. Click "Promote to Production" on previous deployment

### Git-Based Rollback

```bash
# Revert to previous commit
git revert HEAD
git push

# Or rollback to specific commit
git reset --hard <commit-hash>
git push --force
```

## Scaling Considerations

### Horizontal Scaling

- **CDN**: Static assets on edge network
- **Serverless functions**: Auto-scale API routes
- **Database**: If adding persistent storage, use scalable DB

### Caching Strategy

- **Static assets**: Cache forever with versioned filenames
- **API responses**: Cache with appropriate TTLs
- **TanStack Query**: Client-side caching reduces server load

### Rate Limiting

Consider implementing rate limiting for:
- API routes (especially `/api/explain_operation`)
- Expensive operations
- Public endpoints

## Custom Domain

### Vercel Custom Domain

1. Add domain in Vercel dashboard
2. Configure DNS (A/CNAME records)
3. Wait for SSL certificate provisioning
4. Access via custom domain

### Self-Hosted Domain

1. Configure web server (nginx/Apache)
2. Obtain SSL certificate (Let's Encrypt)
3. Configure reverse proxy
4. Update DNS records

## Continuous Deployment

### GitHub Actions (Example)

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Post-Deployment

After successful deployment:

1. **Verify functionality**: Test all features
2. **Monitor errors**: Watch error tracking
3. **Check performance**: Review Web Vitals
4. **Update documentation**: Document deployment URL
5. **Notify users**: Announce availability

## Related Documentation

- **Developer Guide**: [Installation](../developer-guide/installation.md)
- **Subgraph Deployment**: [Subgraph Overview](../subgraph-deployment/README.md)
- **Reference**: [Environment Variables](../reference/environment-variables.md)
- **Troubleshooting**: [Network Errors](../troubleshooting/network-errors.md)

---

**Start deploying**: [Vercel Deployment](vercel-deployment.md) | [Production Checklist](production-checklist.md)
