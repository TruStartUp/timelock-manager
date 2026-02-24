import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTimelocks } from '@/hooks/useTimelocks'

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
npx graph auth --studio '${trimmedDeployKey}' && \\
npx graph deploy --studio '${trimmedSlug}'`
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
            className="inline-flex items-center gap-2 text-text-dark-secondary text-sm font-medium hover:text-primary transition-colors mb-6"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Settings
          </Link>
          <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">
            Deploy subgraph for timelock
          </h1>
          <p className="text-text-dark-secondary text-base font-normal leading-normal mt-3">
            Prepare and deploy a subgraph for a specific timelock. This view generates a ready-to-deploy subgraph
            package and a one-liner you can run in your terminal with your Graph Studio deploy key and subgraph slug.
            Your deploy key is only used locally in your browser to build that command and is never sent to this app&apos;s
            server. For more details, see the{' '}
            <a
              href="https://github.com/TruStartUp/timelock-manager#subgraph-deployment-the-graph-studio"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              documentation
            </a>
            .
          </p>
        </div>

        <div className="rounded-lg border border-[#55493a] bg-surface-dark p-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-white mb-2" htmlFor="timelock-address">
                Timelock address
              </label>
              <input
                id="timelock-address"
                type="text"
                className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2" htmlFor="timelock-start-block">
                Start block
              </label>
              <input
                id="timelock-start-block"
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                placeholder="Deployment block for this timelock"
                value={startBlock}
                onChange={(e) => setStartBlock(e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-white mb-2">Network</span>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setNetwork('rsk_mainnet')}
                className={`px-4 py-2 rounded-full text-sm font-medium border ${
                  network === 'rsk_mainnet'
                    ? 'border-primary bg-primary text-black'
                    : 'border-[#55493a] text-white hover:bg-[#2a2218]'
                }`}
              >
                Rootstock Mainnet
              </button>
              <button
                type="button"
                onClick={() => setNetwork('rsk_testnet')}
                className={`px-4 py-2 rounded-full text-sm font-medium border ${
                  network === 'rsk_testnet'
                    ? 'border-primary bg-primary text-black'
                    : 'border-[#55493a] text-white hover:bg-[#2a2218]'
                }`}
              >
                Rootstock Testnet
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white mb-2" htmlFor="deploy-key">
                  Graph Studio deploy key
                </label>
                <input
                  id="deploy-key"
                  type="password"
                  className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                  placeholder="studio-..."
                  value={deployKey}
                  onChange={(e) => setDeployKey(e.target.value)}
                />
                <p className="mt-1 text-xs text-text-dark-secondary">
                  Used only to construct the command below in your browser. It is never sent to this app&apos;s server.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2" htmlFor="subgraph-slug">
                  Subgraph slug
                </label>
                <input
                  id="subgraph-slug"
                  type="text"
                  className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                  placeholder="your-account/timelock-subgraph"
                  value={subgraphSlug}
                  onChange={(e) => setSubgraphSlug(e.target.value)}
                />
                <p className="mt-1 text-xs text-text-dark-secondary">
                  The slug you use when deploying this subgraph to Graph Studio (e.g. in the Studio UI).
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-text-dark-secondary mb-2">
                Run this command in your terminal to download the prepared subgraph from this app, unzip it, and run{' '}
                <code className="text-primary">graph auth</code> and <code className="text-primary">graph deploy</code>{' '}
                locally. Your deploy key never leaves your machine.
              </p>
              <pre className="w-full whitespace-pre overflow-x-auto rounded-lg border border-[#55493a] bg-[#18120a] p-3 text-xs text-text-dark-secondary">
                <code>{deployCommand}</code>
              </pre>
            </div>
          </div>

          <div className="pt-2 border-t border-[#55493a] mt-2 space-y-3">
            <div>
              <label className="block text-sm font-medium text-white mb-1" htmlFor="subgraph-query-url">
                Subgraph Query URL (paste after deploying)
              </label>
              <input
                id="subgraph-query-url"
                type="url"
                className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                placeholder="https://api.studio.thegraph.com/query/..."
                value={pastedSubgraphUrl}
                onChange={(e) => setPastedSubgraphUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveToApp}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-black bg-primary hover:bg-primary/80"
              >
                Save this timelock to the app
              </button>
            </div>
            {saveSuccess && <p className="text-sm text-green-400">{saveSuccess}</p>}
            {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

