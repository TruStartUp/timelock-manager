import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { isAddress } from 'viem'
import { useTimelocks } from '@/hooks/useTimelocks'
import { ROOTSTOCK_CHAINS } from '@/lib/constants'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

function normalizeAddress(value: string): string {
  const t = value.trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

function isValidAddress(value: string): boolean {
  return isAddress(normalizeAddress(value))
}

export default function DeployTimelockView() {
  const { address: walletAddress, isConnected } = useAccount()
  const chainId = useChainId()
  const { addConfig } = useTimelocks()
  const [minDelay, setMinDelay] = useState('86400')
  const [proposers, setProposers] = useState<string[]>([''])
  const [executors, setExecutors] = useState<string[]>([''])
  const [admin, setAdmin] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [compileError, setCompileError] = useState<string | null>(null)

  const { sendTransaction, data: txHash, isPending: isSendPending, error: sendError } = useSendTransaction()
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  const isDeployPending = isSendPending || isConfirming
  const isDeploySuccess = !!txHash && isConfirmed
  const deployedAddress = receipt?.contractAddress ?? null

  const addProposer = useCallback(() => setProposers((p) => [...p, '']), [])
  const removeProposer = useCallback((i: number) => setProposers((p) => p.filter((_, j) => j !== i)), [])
  const setProposer = useCallback((i: number, v: string) => {
    setProposers((p) => {
      const next = [...p]
      next[i] = v
      return next
    })
    setErrors((e) => ({ ...e, [`proposer_${i}`]: '' }))
  }, [])

  const addExecutor = useCallback(() => setExecutors((e) => [...e, '']), [])
  const removeExecutor = useCallback((i: number) => setExecutors((e) => e.filter((_, j) => j !== i)), [])
  const setExecutor = useCallback((i: number, v: string) => {
    setExecutors((e) => {
      const next = [...e]
      next[i] = v
      return next
    })
    setErrors((err) => ({ ...err, [`executor_${i}`]: '' }))
  }, [])

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    const delayNum = Number(minDelay)
    if (!Number.isFinite(delayNum) || delayNum < 0) {
      newErrors.minDelay = 'Min delay must be a non-negative number (seconds)'
    }
    const proposerList = proposers.map((p) => p.trim()).filter(Boolean)
    if (proposerList.length === 0) {
      newErrors.proposers = 'At least one proposer address is required'
    }
    proposerList.forEach((p, i) => {
      if (!isValidAddress(p)) newErrors[`proposer_${i}`] = 'Invalid address'
    })
    const executorList = executors.map((e) => e.trim()).filter(Boolean)
    if (executorList.length === 0) {
      newErrors.executors = 'At least one executor address is required (use 0x0 for “any address”)'
    }
    executorList.forEach((e, i) => {
      if (!isValidAddress(e)) newErrors[`executor_${i}`] = 'Invalid address'
    })
    if (admin.trim() && !isValidAddress(admin)) {
      newErrors.admin = 'Invalid address (leave empty for no admin)'
    }
    setErrors(newErrors)
    setCompileError(null)
    return Object.keys(newErrors).length === 0
  }, [minDelay, proposers, executors, admin])

  const handleDeploy = useCallback(async () => {
    if (!validate() || !walletAddress) return
    setCompileError(null)

    const proposerList = proposers.map((p) => p.trim()).filter(Boolean).map(normalizeAddress)
    const executorList = executors.map((e) => e.trim()).filter(Boolean).map(normalizeAddress)
    if (proposerList.length === 0 || executorList.length === 0) return
    const adminAddr = admin.trim() ? normalizeAddress(admin.trim()) : ZERO_ADDRESS

    try {
      const res = await fetch('/api/deploy-timelock/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minDelay: minDelay.trim() ? String(Number(minDelay)) : '0',
          proposers: proposerList,
          executors: executorList,
          admin: adminAddr,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCompileError(json.error ?? 'Compile request failed')
        return
      }
      const data = json.data as `0x${string}`
      if (!data || typeof data !== 'string') {
        setCompileError('Invalid response from compile API')
        return
      }
      sendTransaction({ to: undefined, data, value: BigInt(0) })
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : 'Failed to get deployment data')
    }
  }, [validate, walletAddress, proposers, executors, admin, minDelay, sendTransaction])

  const addToApp = useCallback(() => {
    const address = deployedAddress
    if (!address || !isConfirmed) return
    const network = chainId === ROOTSTOCK_CHAINS.MAINNET ? 'rsk_mainnet' : 'rsk_testnet'
    const subgraphUrl =
      chainId === ROOTSTOCK_CHAINS.MAINNET
        ? process.env.NEXT_PUBLIC_RSK_MAINNET_SUBGRAPH_URL ?? ''
        : process.env.NEXT_PUBLIC_RSK_TESTNET_SUBGRAPH_URL ?? ''
    addConfig({
      name: 'Deployed Timelock',
      address,
      network,
      subgraphUrl: subgraphUrl || `https://api.studio.thegraph.com/query/0/rootstock-timelock-${network === 'rsk_mainnet' ? 'mainnet' : 'testnet'}/version/latest`,
    })
  }, [deployedAddress, isConfirmed, chainId, addConfig])

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
            Deploy Timelock
          </h1>
          <p className="text-text-dark-secondary text-base font-normal leading-normal mt-3">
            Deploy a new OpenZeppelin TimelockController contract on Rootstock. Configure min delay, proposers, executors, and optional admin.
          </p>
        </div>

        <div className="rounded-lg border border-[#55493a] bg-surface-dark p-8">
          {isDeploySuccess ? (
            <div className="space-y-4">
              <p className="text-white font-medium">Contract deployed successfully.</p>
              {deployedAddress && (
                <p className="text-text-dark-secondary text-sm">
                  Contract address: <code className="text-primary break-all">{deployedAddress}</code>
                </p>
              )}
              <p className="text-text-dark-secondary text-sm">
                Transaction: <code className="text-primary break-all">{txHash}</code>
              </p>
              {deployedAddress && (
                <button
                  type="button"
                  onClick={addToApp}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-black bg-primary hover:bg-primary/80"
                >
                  Add this timelock to the app
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2" htmlFor="min-delay">
                    Min delay (seconds)
                  </label>
                  <input
                    id="min-delay"
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                    placeholder="e.g. 86400 for 1 day"
                    value={minDelay}
                    onChange={(e) => {
                      setMinDelay(e.target.value)
                      setErrors((err) => ({ ...err, minDelay: '' }))
                    }}
                  />
                  {errors.minDelay && <p className="text-sm text-red-400 mt-1">{errors.minDelay}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white">Proposers</label>
                    <button type="button" onClick={addProposer} className="text-sm text-primary hover:underline">
                      + Add
                    </button>
                  </div>
                  {proposers.map((p, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                        placeholder="0x..."
                        value={p}
                        onChange={(e) => setProposer(i, e.target.value)}
                      />
                      <button type="button" onClick={() => removeProposer(i)} className="p-2 text-red-400 hover:text-red-300" aria-label="Remove">−</button>
                    </div>
                  ))}
                  {errors.proposers && <p className="text-sm text-red-400">{errors.proposers}</p>}
                  {proposers.map((_, i) => errors[`proposer_${i}`] && <p key={i} className="text-sm text-red-400">{errors[`proposer_${i}`]}</p>)}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white">Executors</label>
                    <button type="button" onClick={addExecutor} className="text-sm text-primary hover:underline">
                      + Add
                    </button>
                  </div>
                  <p className="text-text-dark-secondary text-xs mb-2">Use 0x0000000000000000000000000000000000000000 for “any address”.</p>
                  {executors.map((e, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                        placeholder="0x... or 0x0 for any"
                        value={e}
                        onChange={(ev) => setExecutor(i, ev.target.value)}
                      />
                      <button type="button" onClick={() => removeExecutor(i)} className="p-2 text-red-400 hover:text-red-300" aria-label="Remove">−</button>
                    </div>
                  ))}
                  {errors.executors && <p className="text-sm text-red-400">{errors.executors}</p>}
                  {executors.map((_, i) => errors[`executor_${i}`] && <p key={i} className="text-sm text-red-400">{errors[`executor_${i}`]}</p>)}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2" htmlFor="admin">Admin (optional)</label>
                  <input
                    id="admin"
                    type="text"
                    className="w-full rounded-lg border border-[#55493a] bg-surface-dark px-4 py-2.5 text-white placeholder:text-text-dark-secondary focus:border-primary focus:ring-primary/50"
                    placeholder="Leave empty for no admin (self-administered)"
                    value={admin}
                    onChange={(e) => {
                      setAdmin(e.target.value)
                      setErrors((err) => ({ ...err, admin: '' }))
                    }}
                  />
                  {errors.admin && <p className="text-sm text-red-400 mt-1">{errors.admin}</p>}
                </div>
              </div>

              {compileError && <p className="text-sm text-red-400 mt-4">{compileError}</p>}
              {sendError && <p className="text-sm text-red-400 mt-4">{sendError.message}</p>}

              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <button
                  type="button"
                  onClick={handleDeploy}
                  disabled={!isConnected || isDeployPending}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-black bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeployPending ? 'Deploying…' : 'Deploy Timelock'}
                </button>
                {!isConnected && <span className="text-text-dark-secondary text-sm">Connect a wallet to deploy.</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
