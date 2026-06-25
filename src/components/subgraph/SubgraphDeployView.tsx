import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTimelocks } from '@/hooks/useTimelocks'
import { SUBGRAPH_DOCS_URL as subgraphDocsUrl } from '@/lib/docs'

type SubgraphNetwork = 'rsk_mainnet' | 'rsk_testnet'

type SubgraphDeployViewProps = {
  initialAddress?: string
  initialStartBlock?: string | number
  initialNetwork?: SubgraphNetwork
}

export default function SubgraphDeployView({ initialAddress, initialStartBlock, initialNetwork }: SubgraphDeployViewProps) {
  const { addConfig } = useTimelocks()

  const [address, setAddress] = useState(initialAddress ?? '')
  const [startBlock, setStartBlock] = useState(initialStartBlock != null ? String(initialStartBlock) : '')
  const [network, setNetwork] = useState<SubgraphNetwork>(initialNetwork ?? 'rsk_testnet')
  const [deployKey, setDeployKey] = useState('')
  const [subgraphSlug, setSubgraphSlug] = useState('')
  const [pastedSubgraphUrl, setPastedSubgraphUrl] = useState('')
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [origin, setOrigin] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const subgraphDir = useMemo(
    () =>
      network === 'rsk_mainnet'
        ? 'rootstock-timelock-mainnet'
        : 'rootstock-timelock-testnet',
    [network]
  )

  const deployCommand = useMemo(() => {
    const trimmedAddress = address.trim()
    const trimmedDeployKey = deployKey.trim()
    const trimmedSlug = subgraphSlug.trim()
    const startBlockNum = Number(startBlock)

    if (!origin) {
      return '# Waiting for browser environment to determine app URL...'
    }

    if (!trimmedAddress || !Number.isFinite(startBlockNum) || startBlockNum < 0) {
      return '# Fill timelock address and start block above to see the deploy command.'
    }

    if (!trimmedDeployKey || !trimmedSlug) {
      return '# Enter your Graph Studio deploy key and subgraph slug to see the full deploy command.'
    }

    const payload = `{"address":"${trimmedAddress}","startBlock":${startBlockNum},"network":"${network}"}`

    return `curl -X POST \\
  -H 'Content-Type: application/json' \\
  -d '${payload}' \\
  '${origin}/api/subgraph/prepare' \\
  --output subgraph-timelock.zip && \\
unzip -o subgraph-timelock.zip -d subgraph-timelock && \\
cd subgraph-timelock && \\
npm install @graphprotocol/graph-cli && \\
npx graph auth '${trimmedDeployKey}' && \\
npx graph deploy --node https://api.studio.thegraph.com/deploy/ '${trimmedSlug}'`
  }, [address, deployKey, network, origin, startBlock, subgraphSlug])

  const handleSaveToApp = useCallback(() => {
    setSaveSuccess(null)
    setSaveError(null)
    const trimmedAddress = address.trim()
    const trimmedUrl = pastedSubgraphUrl.trim()

    if (!trimmedAddress) {
      setSaveError('Timelock address is required.')
      return
    }
    if (!trimmedUrl) {
      setSaveError('Subgraph Query URL is required.')
      return
    }

    const lower = trimmedAddress.toLowerCase()
    const normalizedAddress = (lower.startsWith('0x') ? lower : `0x${lower}`) as `0x${string}`

    addConfig({
      name: 'Deployed Timelock',
      address: normalizedAddress,
      network,
      subgraphUrl: trimmedUrl,
    })
    setSaveSuccess('Timelock saved to the app with this subgraph URL.')
  }, [addConfig, address, network, pastedSubgraphUrl])

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Settings
          </Link>
          <h1 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
            Deploy subgraph for timelock
          </h1>
          <p className="mt-3 text-base font-normal leading-normal text-text-secondary">
            A subgraph is <span className="font-semibold text-text-primary">optional</span> — the app reads from
            Blockscout by default. Deploy one only if you want faster indexed queries for a very active timelock.
            This page builds a ready-to-deploy package and a command you run in your own terminal; your Graph Studio
            deploy key stays on your machine and never reaches this app&apos;s server.
          </p>
        </div>

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
          <span className="material-symbols-outlined mt-0.5 text-red-400" aria-hidden>
            warning
          </span>
          <div className="space-y-2 text-sm leading-relaxed text-text-secondary">
            <p className="font-semibold text-text-primary">
              Don&apos;t create this subgraph with <code className="text-red-300">graph init</code>
            </p>
            <p>
              The Timelock Manager queries a <span className="font-semibold text-text-primary">custom aggregated
              schema</span> — entities like <code>Operation</code>, <code>Call</code>, <code>Role</code> and{' '}
              <code>RoleAssignment</code>. A subgraph scaffolded with <code className="text-red-300">graph init</code>{' '}
              only produces raw per-event entities (<code>CallScheduled</code>, <code>RoleGranted</code>, …), so the
              app&apos;s queries return nothing and the timelock appears broken.
            </p>
            <p>
              Always deploy from the prepared package below (recommended) or from the templates in{' '}
              <code>subgraph/</code> in the repo — both ship the correct schema.
            </p>
          </div>
        </div>

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <span className="material-symbols-outlined mt-0.5 text-amber-500" aria-hidden>
            terminal
          </span>
          <div className="space-y-2 text-sm leading-relaxed text-text-secondary">
            <p className="font-semibold text-text-primary">
              You&apos;ll finish this in your terminal
            </p>
            <p>
              Deploying can&apos;t be done from the browser alone. You need{' '}
              <a href="https://thegraph.com/studio/" target="_blank" rel="noreferrer" className="text-primary underline">
                a Graph Studio account
              </a>
              , its deploy key, and Node.js 18+. Follow the numbered steps below, or read the{' '}
              <a href={subgraphDocsUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                full deployment guide
              </a>
              .
            </p>
          </div>
        </div>

        <div className="app-card space-y-6 p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              1
            </span>
            <h2 className="text-lg font-bold text-text-primary">
              Identify your timelock
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="timelock-address">
                Timelock address
              </label>
              <input
                id="timelock-address"
                type="text"
                className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="timelock-start-block">
                Start block
              </label>
              <input
                id="timelock-start-block"
                type="number"
                min={0}
                className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                placeholder="Deployment block for this timelock"
                value={startBlock}
                onChange={(e) => setStartBlock(e.target.value)}
              />
              <p className="mt-1 text-xs text-text-secondary">
                Block number when this timelock contract was deployed (for example, from its deployment transaction in the explorer).
              </p>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-text-primary">Network</span>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setNetwork('rsk_mainnet')}
                className={`px-4 py-2 rounded-full text-sm font-medium border ${
                  network === 'rsk_mainnet'
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-color bg-surface text-text-primary hover:bg-surface-elevated'
                }`}
              >
                Rootstock Mainnet
              </button>
              <button
                type="button"
                onClick={() => setNetwork('rsk_testnet')}
                className={`px-4 py-2 rounded-full text-sm font-medium border ${
                  network === 'rsk_testnet'
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-color bg-surface text-text-primary hover:bg-surface-elevated'
                }`}
              >
                Rootstock Testnet
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border-color pt-6">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              2
            </span>
            <h2 className="text-lg font-bold text-text-primary">
              Build &amp; deploy the prepared package
              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                Recommended
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="deploy-key">
                  Graph Studio deploy key
                </label>
                <input
                  id="deploy-key"
                  type="password"
                  className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                  placeholder="studio-..."
                  value={deployKey}
                  onChange={(e) => setDeployKey(e.target.value)}
                />
                <p className="mt-1 text-xs text-text-secondary">
                  Your Graph Studio deploy key (from the Studio UI). It is only used locally in this browser to build the command and is never sent to this app&apos;s server.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="subgraph-slug">
                  Subgraph slug
                </label>
                <input
                  id="subgraph-slug"
                  type="text"
                  className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                  placeholder="your-account/timelock-subgraph"
                  value={subgraphSlug}
                  onChange={(e) => setSubgraphSlug(e.target.value)}
                />
                <p className="mt-1 text-xs text-text-secondary">
                  The slug you use when deploying this subgraph to Graph Studio (e.g. in the Studio UI).
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">Copy and run this command in your terminal.</span>{' '}
                It downloads the prepared subgraph from this app, unzips it, and runs{' '}
                <code className="text-primary">graph auth</code> and <code className="text-primary">graph deploy</code>{' '}
                locally. Your deploy key never leaves your machine. Need help?{' '}
                <a href={subgraphDocsUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  Read the deployment guide
                </a>
                .
              </p>
              <pre className="w-full overflow-x-auto whitespace-pre rounded-lg border border-border-color bg-slate-950 p-3 text-xs text-slate-100">
                <code>{deployCommand}</code>
              </pre>
            </div>

            <details className="rounded-lg border border-border-color bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                Prefer to deploy manually from the cloned repo?
              </summary>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-secondary">
                <p>
                  Use the template in <code>subgraph/{subgraphDir}</code>. The key step is setting your timelock in{' '}
                  <span className="font-semibold text-text-primary">both</span> files — they must match, or the build
                  fails:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <code>networks.json</code> → <code>TimelockController.address</code> and{' '}
                    <code>startBlock</code>
                  </li>
                  <li>
                    <code>subgraph.yaml</code> → <code>source.address</code> and <code>source.startBlock</code>
                  </li>
                </ul>
                <pre className="w-full overflow-x-auto whitespace-pre rounded-lg border border-border-color bg-slate-950 p-3 text-xs text-slate-100">
                  <code>{`git clone https://github.com/TruStartUp/timelock-manager.git
cd timelock-manager/subgraph/${subgraphDir}

# Edit networks.json AND subgraph.yaml with your address + startBlock (must match)

npm install
npm run codegen   # generate types from schema.graphql
npm run build     # compile the subgraph

npx graph auth <YOUR_DEPLOY_KEY>
npx graph deploy --node https://api.studio.thegraph.com/deploy/ <YOUR_SLUG>`}</code>
                </pre>
                <p>
                  Don&apos;t run <code className="text-red-300">graph init</code> — it overwrites the schema with the
                  default per-event one the app can&apos;t query.
                </p>
              </div>
            </details>
          </div>

          <div className="mt-2 flex items-center gap-3 border-t border-border-color pt-6">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              3
            </span>
            <h2 className="text-lg font-bold text-text-primary">
              Connect it back to the app
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="subgraph-query-url">
                Subgraph Query URL (paste after deploying)
              </label>
              <input
                id="subgraph-query-url"
                type="url"
                className="app-input w-full rounded-lg px-4 py-2 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                placeholder="https://api.studio.thegraph.com/query/..."
                value={pastedSubgraphUrl}
                onChange={(e) => setPastedSubgraphUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveToApp}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80"
              >
                Save this timelock to the app
              </button>
            </div>
            {saveSuccess && (
              <p className="text-sm text-emerald-700 dark:text-green-400">
                Timelock saved. You can now select it in Settings or from the header to view its operations.
              </p>
            )}
            {saveError && <p className="text-sm text-rose-700 dark:text-red-400">{saveError}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}
