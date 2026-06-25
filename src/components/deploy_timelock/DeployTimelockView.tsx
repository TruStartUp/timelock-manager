import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { isAddress } from 'viem'
import { useTimelocks } from '@/hooks/useTimelocks'
import { ROOTSTOCK_CHAINS } from '@/lib/constants'
import { getBlockscoutExplorerUrl } from '@/services/blockscout/client'

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
  const router = useRouter()
  const [minDelay, setMinDelay] = useState('86400')
  const [proposers, setProposers] = useState<string[]>([''])
  const [executors, setExecutors] = useState<string[]>([''])
  const [admin, setAdmin] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [compileError, setCompileError] = useState<string | null>(null)
  const [verifyPending, setVerifyPending] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifySuccess, setVerifySuccess] = useState(false)
  const [addedToApp, setAddedToApp] = useState(false)
  const [pastedSubgraphUrl, setPastedSubgraphUrl] = useState('')
  const [saveName, setSaveName] = useState('')

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
    // Default to Blockscout (empty subgraphUrl); only set a subgraph if the user pasted one.
    addConfig({
      name: saveName.trim() || 'My Timelock',
      address,
      network,
      subgraphUrl: pastedSubgraphUrl.trim(),
    })
    setAddedToApp(true)
  }, [deployedAddress, isConfirmed, chainId, addConfig, pastedSubgraphUrl, saveName])

  const handleVerify = useCallback(async () => {
    if (!deployedAddress || chainId !== ROOTSTOCK_CHAINS.MAINNET && chainId !== ROOTSTOCK_CHAINS.TESTNET) return
    const proposerList = proposers.map((p) => p.trim()).filter(Boolean).map(normalizeAddress)
    const executorList = executors.map((e) => e.trim()).filter(Boolean).map(normalizeAddress)
    if (proposerList.length === 0 || executorList.length === 0) return
    const adminAddr = admin.trim() ? normalizeAddress(admin.trim()) : ZERO_ADDRESS
    setVerifyError(null)
    setVerifySuccess(false)
    setVerifyPending(true)
    try {
      const res = await fetch('/api/deploy-timelock/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: deployedAddress,
          chainId,
          minDelay: minDelay.trim() ? String(Number(minDelay)) : '0',
          proposers: proposerList,
          executors: executorList,
          admin: adminAddr,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setVerifyError(json.error ?? 'Verification failed')
        return
      }
      setVerifySuccess(true)
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification request failed')
    } finally {
      setVerifyPending(false)
    }
  }, [deployedAddress, chainId, proposers, executors, admin, minDelay])

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
            Deploy Timelock
          </h1>
          <p className="mt-3 text-base font-normal leading-normal text-text-secondary">
            Deploy a new OpenZeppelin TimelockController contract on Rootstock. Configure min delay, proposers, executors, and optional admin.
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Connect a wallet on Rootstock Mainnet or Testnet to deploy a new OpenZeppelin TimelockController from this app.
          </p>
        </div>

        <div className="app-card p-8">
          {isDeploySuccess ? (
            <div className="space-y-4">
              <p className="font-medium text-text-primary">Contract deployed successfully.</p>
              {deployedAddress && (
                <p className="text-sm text-text-secondary">
                  Contract address: <code className="text-primary break-all">{deployedAddress}</code>
                </p>
              )}
              <p className="text-sm text-text-secondary">
                Transaction: <code className="text-primary break-all">{txHash}</code>
              </p>

              {(chainId === ROOTSTOCK_CHAINS.MAINNET || chainId === ROOTSTOCK_CHAINS.TESTNET) && deployedAddress && txHash && (
                  <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Blockscout</p>
                  <div className="flex flex-col gap-1">
                    <a
                      href={`${getBlockscoutExplorerUrl(chainId)}/address/${deployedAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline"
                    >
                      View contract
                    </a>
                    <a
                      href={`${getBlockscoutExplorerUrl(chainId)}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline"
                    >
                      View transaction
                    </a>
                  </div>
                </div>
              )}

              {isDeploySuccess &&
                deployedAddress &&
                receipt?.blockNumber != null &&
                (chainId === ROOTSTOCK_CHAINS.MAINNET || chainId === ROOTSTOCK_CHAINS.TESTNET) && (
                  <div className="mt-4 space-y-3 border-t border-border-color pt-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                      Subgraph for this timelock
                    </p>
                    <p className="text-sm text-text-secondary">
                      Generate a ready-to-deploy subgraph package for this timelock so you can deploy it from your
                      machine with your Graph Studio deploy key and then save the Query URL back into the app.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!deployedAddress || receipt?.blockNumber == null) return
                        const network = chainId === ROOTSTOCK_CHAINS.MAINNET ? 'rsk_mainnet' : 'rsk_testnet'
                        const params = new URLSearchParams({
                          address: deployedAddress,
                          startBlock: String(Number(receipt.blockNumber)),
                          network,
                        })
                        router.push(`/subgraph/deploy?${params.toString()}`)
                      }}
                      className="app-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      Go to subgraph deploy
                    </button>
                  </div>
                )}

              {deployedAddress && !addedToApp && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="deploy-save-name">
                      Name
                    </label>
                    <input
                      id="deploy-save-name"
                      type="text"
                      className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                      placeholder="My Timelock"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="deploy-save-subgraph">
                      Subgraph URL <span className="text-text-secondary">(optional)</span>
                    </label>
                    <input
                      id="deploy-save-subgraph"
                      type="url"
                      className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                      placeholder="Leave empty to use Blockscout"
                      value={pastedSubgraphUrl}
                      onChange={(e) => setPastedSubgraphUrl(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-text-secondary">
                      Leave empty and the app reads from Blockscout — no subgraph required. You can
                      add or change this anytime in Settings.
                    </p>
                  </div>
                </div>
              )}

              {deployedAddress && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={addToApp}
                    disabled={addedToApp}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addedToApp ? 'Added to the app ✓' : 'Add this timelock to the app'}
                  </button>
                  {(chainId === ROOTSTOCK_CHAINS.MAINNET || chainId === ROOTSTOCK_CHAINS.TESTNET) && (
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifyPending}
                      className="app-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {verifyPending ? 'Verifying…' : 'Verify contract on Blockscout'}
                    </button>
                  )}
                </div>
              )}
              {addedToApp && (
                <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400">
                  Timelock added to the app. You can now select it from Settings.
                </div>
              )}
              {verifySuccess && (
                <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400">
                  Contract verified successfully on Blockscout.
                </div>
              )}
              {verifyError && (
                <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400">
                  Verification failed. Check the parameters and try again, or verify the contract manually on Blockscout.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="min-delay">
                    Min delay (seconds)
                  </label>
                  <input
                    id="min-delay"
                    type="number"
                    min={0}
                    className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                    placeholder="e.g. 86400 for 1 day"
                    value={minDelay}
                    onChange={(e) => {
                      setMinDelay(e.target.value)
                      setErrors((err) => ({ ...err, minDelay: '' }))
                    }}
                  />
                  {errors.minDelay && <p className="text-sm text-red-400 mt-1">{errors.minDelay}</p>}
                  <p className="mt-2 text-xs text-text-secondary">
                    Minimum time (in seconds) between scheduling and execution. Longer delays give users more time to review and react to proposed changes.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-primary">Proposers</label>
                    <button type="button" onClick={addProposer} className="text-sm text-primary hover:underline">
                      + Add
                    </button>
                  </div>
                  {proposers.map((p, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="app-input flex-1 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                        placeholder="0x..."
                        value={p}
                        onChange={(e) => setProposer(i, e.target.value)}
                      />
                      <button type="button" onClick={() => removeProposer(i)} className="p-2 text-red-400 hover:text-red-300" aria-label="Remove">−</button>
                    </div>
                  ))}
                  {errors.proposers && <p className="text-sm text-red-400">{errors.proposers}</p>}
                  {proposers.map((_, i) => errors[`proposer_${i}`] && <p key={i} className="text-sm text-red-400">{errors[`proposer_${i}`]}</p>)}
                  <p className="mt-2 text-xs text-text-secondary">
                    Addresses that can schedule new operations on this timelock. At least one proposer is required.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-primary">Executors</label>
                    <button type="button" onClick={addExecutor} className="text-sm text-primary hover:underline">
                      + Add
                    </button>
                  </div>
                  <p className="mb-2 text-xs text-text-secondary">Use 0x0000000000000000000000000000000000000000 for “any address”.</p>
                  {executors.map((e, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="app-input flex-1 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                        placeholder="0x... or 0x0 for any"
                        value={e}
                        onChange={(ev) => setExecutor(i, ev.target.value)}
                      />
                      <button type="button" onClick={() => removeExecutor(i)} className="p-2 text-red-400 hover:text-red-300" aria-label="Remove">−</button>
                    </div>
                  ))}
                  {errors.executors && <p className="text-sm text-red-400">{errors.executors}</p>}
                  {executors.map((_, i) => errors[`executor_${i}`] && <p key={i} className="text-sm text-red-400">{errors[`executor_${i}`]}</p>)}
                  <p className="mt-2 text-xs text-text-secondary">
                    Addresses that can execute ready operations. Use 0x0000000000000000000000000000000000000000 if you want any address to be able to execute (use with caution).
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="admin">Admin (optional)</label>
                  <input
                    id="admin"
                    type="text"
                    className="app-input w-full rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                    placeholder="Leave empty for no admin (self-administered)"
                    value={admin}
                    onChange={(e) => {
                      setAdmin(e.target.value)
                      setErrors((err) => ({ ...err, admin: '' }))
                    }}
                  />
                  {errors.admin && <p className="text-sm text-red-400 mt-1">{errors.admin}</p>}
                  <p className="mt-2 text-xs text-text-secondary">
                    Optional admin that can manage roles. Leave empty for a self-administered timelock with no single admin account.
                  </p>
                </div>
              </div>

              {compileError && <p className="text-sm text-red-400 mt-4">{compileError}</p>}
              {sendError && <p className="text-sm text-red-400 mt-4">{sendError.message}</p>}

              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <button
                  type="button"
                  onClick={handleDeploy}
                  disabled={!isConnected || isDeployPending}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeployPending ? 'Deploying…' : 'Deploy Timelock'}
                </button>
                {!isConnected && <span className="text-sm text-text-secondary">Connect a wallet to deploy.</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
