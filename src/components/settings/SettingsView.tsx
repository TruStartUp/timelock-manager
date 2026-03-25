import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createPublicClient, http, isAddress, type Address } from 'viem'
import { rootstock, rootstockTestnet } from 'wagmi/chains'
import { useChainId } from 'wagmi'
import { useNetworkConfig } from '@/hooks/useNetworkConfig'
import { useABIManager } from '@/hooks/useABIManager'
import { TimelockSettings } from '@/components/timelock/TimelockSettings'

const SettingsView = () => {
  const connectedChainId = useChainId()
  const { config: networkConfig, setEnabled, saveRpc, reset } = useNetworkConfig()
  const abiManager = useABIManager()

  const [rpcUrlDraft, setRpcUrlDraft] = useState('')
  const [rpcTest, setRpcTest] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error'
    message?: string
    chainId?: number
  }>({ status: 'idle' })

  const [showImport, setShowImport] = useState(false)
  const [importName, setImportName] = useState('')
  const [importAddress, setImportAddress] = useState('')
  const [importAbiJson, setImportAbiJson] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    deploy: false,
    timelock: false,
    subgraph: false,
    network: false,
    abi: false,
  })
  const toggleSection = (key: string) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    setRpcUrlDraft(networkConfig.rpcUrl || '')
  }, [networkConfig.rpcUrl])

  const isCustomRpcEnabled = networkConfig.enabled
  const canTestRpc = isCustomRpcEnabled && rpcUrlDraft.trim().length > 0

  const knownChainLabel = useMemo(() => {
    if (rpcTest.status !== 'success' || !rpcTest.chainId) return null
    if (rpcTest.chainId === rootstock.id) return 'Rootstock Mainnet'
    if (rpcTest.chainId === rootstockTestnet.id) return 'Rootstock Testnet'
    return `Chain ${rpcTest.chainId}`
  }, [rpcTest.chainId, rpcTest.status])

  const testRpcConnection = async () => {
    const url = rpcUrlDraft.trim()
    setRpcTest({ status: 'testing' })

    if (!/^https?:\/\//i.test(url)) {
      setRpcTest({
        status: 'error',
        message: 'RPC URL must start with http:// or https://',
      })
      return
    }

    try {
      const client = createPublicClient({
        transport: http(url),
      })
      // T098: verify connectivity by reading chain id
      const chainIdHex = await client.request({ method: 'eth_chainId' })
      const chainId = Number(BigInt(chainIdHex as any))

      const isRootstock = chainId === rootstock.id || chainId === rootstockTestnet.id
      if (!Number.isFinite(chainId) || chainId <= 0) {
        setRpcTest({ status: 'error', message: 'Invalid chain id returned by RPC.' })
        return
      }

      setRpcTest({
        status: 'success',
        chainId,
        message: isRootstock
          ? `Connected (${chainId})`
          : `Connected, but chainId ${chainId} is not Rootstock.`,
      })
    } catch (err) {
      setRpcTest({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const saveNetworkSettings = () => {
    if (!isCustomRpcEnabled) {
      reset()
      return
    }
    if (rpcTest.status !== 'success' || !rpcTest.chainId) {
      setRpcTest({
        status: 'error',
        message: 'Please “Test Connection” successfully before saving.',
      })
      return
    }
    saveRpc(rpcUrlDraft, rpcTest.chainId)
  }

  const handleImport = () => {
    setImportError(null)
    try {
      const parsed = JSON.parse(importAbiJson)
      abiManager.upsert({
        address: importAddress,
        name: importName,
        abi: parsed,
      })
      setImportName('')
      setImportAddress('')
      setImportAbiJson('')
      setShowImport(false)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  const downloadJson = (filename: string, obj: unknown) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAll = () => {
    downloadJson('custom-abis.json', abiManager.exportAll())
  }

  const shortenAddress = (addr: string) => {
    if (addr.length < 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const isConnectedToMainnet = connectedChainId === rootstock.id
  const isConnectedToTestnet = connectedChainId === rootstockTestnet.id
  const sectionCardClass =
    'mb-6 overflow-hidden rounded-xl border border-border-color bg-surface shadow-sm'
  const sectionHeaderClass =
    'flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-elevated/60'
  const sectionBodyClass = 'border-t border-border-color px-5 py-4'

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap justify-between gap-3 mb-10">
          <div className="flex min-w-72 flex-col gap-3">
            <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
              Configuration
            </p>
            <p className="text-text-secondary text-base font-normal leading-normal">
              Manage network preferences, custom RPC URLs, and contract ABIs.
            </p>
          </div>
        </div>

        {/* T015: Timelock Configurations Section */}
        <div className={sectionCardClass}>
          <button
            type="button"
            className={sectionHeaderClass}
            onClick={() => toggleSection('timelock')}
            aria-expanded={sectionOpen.timelock}
          >
            <h2 className="text-text-primary text-[22px] font-bold leading-tight tracking-[-0.015em]">
              Timelock configurations
            </h2>
            <span
              className={`material-symbols-outlined text-text-secondary transition-transform ${sectionOpen.timelock ? 'rotate-180' : ''}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
          {sectionOpen.timelock ? (
            <div className={`${sectionBodyClass} space-y-3`}>
              <p className="text-text-secondary text-sm">
                Timelocks and their subgraph URLs that this app uses for the Dashboard, Operations Explorer, and Permissions views.
              </p>
              <TimelockSettings />
            </div>
          ) : null}
        </div>


        {/* Network Configuration */}
        <div className={sectionCardClass}>
          <button
            type="button"
            className={sectionHeaderClass}
            onClick={() => toggleSection('network')}
            aria-expanded={sectionOpen.network}
          >
            <h2 className="text-text-primary text-[22px] font-bold leading-tight tracking-[-0.015em]">
              Network Configuration
            </h2>
            <span
              className={`material-symbols-outlined text-text-secondary transition-transform ${sectionOpen.network ? 'rotate-180' : ''}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
          {sectionOpen.network ? (
            <div className={`${sectionBodyClass} flex flex-col gap-6`}>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-4 rounded-xl border border-primary/40 p-[15px] cursor-pointer bg-primary/10">
              <input
                checked={isConnectedToMainnet}
                readOnly
                className="h-5 w-5 appearance-none rounded-full border-2 border-border-color bg-transparent checked:border-primary checked:bg-primary focus:outline-none focus:ring-0 focus:ring-offset-0 ring-offset-background"
                name="network-selection"
                type="radio"
              />
              <div className="flex grow flex-col">
                <p className="text-text-primary text-sm font-medium leading-normal">
                  Rootstock Mainnet
                </p>
                <p className="text-text-secondary text-sm font-normal leading-normal">
                  Connect to the main Rootstock network.
                </p>
              </div>
              {isConnectedToMainnet ? (
                <span className="text-sm font-medium text-green-400">
                  Connected
                </span>
              ) : null}
            </label>
            <label className="flex items-center gap-4 rounded-xl border border-border-color p-[15px] cursor-pointer hover:border-primary/50 transition-colors">
              <input
                checked={isConnectedToTestnet}
                readOnly
                className="h-5 w-5 appearance-none rounded-full border-2 border-border-color bg-transparent checked:border-primary checked:bg-primary focus:outline-none focus:ring-0 focus:ring-offset-0 ring-offset-background"
                name="network-selection"
                type="radio"
              />
              <div className="flex grow flex-col">
                <p className="text-text-primary text-sm font-medium leading-normal">
                  Rootstock Testnet
                </p>
                <p className="text-text-secondary text-sm font-normal leading-normal">
                  Connect to the test network for development.
                </p>
              </div>
              {isConnectedToTestnet ? (
                <span className="text-sm font-medium text-green-400">
                  Connected
                </span>
              ) : null}
            </label>
          </div>
          <div className="@container">
            <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-xl border border-border-color bg-surface-elevated/40 p-5 @[480px]:flex-row @[480px]:items-center">
              <div className="flex flex-col gap-1">
                <p className="text-text-primary text-base font-bold leading-tight">
                  Use Custom RPC Endpoint
                </p>
                <p className="text-text-secondary text-base font-normal leading-normal">
                  Enable to connect to a custom RPC instead of the default.
                </p>
              </div>
              <label className="relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none bg-border-color p-0.5 has-[:checked]:justify-end has-[:checked]:bg-primary">
                <div
                  className="h-full w-[27px] rounded-full bg-white transition-transform"
                  style={{
                    boxShadow:
                      'rgba(0, 0, 0, 0.15) 0px 3px 8px, rgba(0, 0, 0, 0.06) 0px 3px 1px',
                  }}
                ></div>
                <input
                  className="invisible absolute"
                  type="checkbox"
                  checked={isCustomRpcEnabled}
                  onChange={() => {
                    setRpcTest({ status: 'idle' })
                    setEnabled(!isCustomRpcEnabled)
                  }}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="rpc-url">
              Custom RPC URL
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border border-border-color bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                disabled={!isCustomRpcEnabled}
                id="rpc-url"
                placeholder="https://mainnet.rsk.co"
                type="text"
                value={rpcUrlDraft}
                onChange={(e) => {
                  setRpcUrlDraft(e.target.value)
                  setRpcTest({ status: 'idle' })
                }}
              />
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-semibold text-primary disabled:text-primary/50 disabled:cursor-not-allowed"
                disabled={!canTestRpc || rpcTest.status === 'testing'}
                onClick={testRpcConnection}
              >
                {rpcTest.status === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
            {rpcTest.status !== 'idle' ? (
              <p
                className={`text-sm ${
                  rpcTest.status === 'success' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {rpcTest.message}
                {knownChainLabel ? ` — ${knownChainLabel}` : ''}
              </p>
            ) : null}
            <p className="text-xs text-text-secondary">
              Network is controlled by your wallet in the header. These options show which Rootstock network you are currently connected to.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="rounded-full border border-border-color bg-surface px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
              onClick={() => {
                setRpcTest({ status: 'idle' })
                setRpcUrlDraft('')
                reset()
              }}
            >
              Reset to Default
            </button>
            <button
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/80 transition-colors disabled:bg-primary/40 disabled:cursor-not-allowed"
              disabled={isCustomRpcEnabled && rpcTest.status !== 'success'}
              onClick={saveNetworkSettings}
            >
              Save Network Settings
            </button>
          </div>
            </div>
          ) : null}
        </div>

        {/* ABI Management */}
        <div className={sectionCardClass}>
          <button
            type="button"
            className={sectionHeaderClass}
            onClick={() => toggleSection('abi')}
            aria-expanded={sectionOpen.abi}
          >
            <div>
              <h2 className="text-text-primary text-[22px] font-bold leading-tight tracking-[-0.015em]">
                ABI Management
              </h2>
              <p className="text-text-secondary text-base font-normal leading-normal mt-2">
                Manage ABIs used to interact with Timelock and AccessManager
                contracts.
              </p>
            </div>
            <span
              className={`material-symbols-outlined text-text-secondary transition-transform flex-shrink-0 ${sectionOpen.abi ? 'rotate-180' : ''}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>

          {sectionOpen.abi ? (
          <div className={`${sectionBodyClass} flex flex-col gap-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <button
                className="flex items-center gap-2 rounded-full border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
                onClick={() => setShowImport((v) => !v)}
              >
                <span className="material-symbols-outlined text-base">
                  upload
                </span>
                Import ABI
              </button>
              <button
                className="flex items-center gap-2 rounded-full border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
                onClick={exportAll}
                disabled={abiManager.entries.length === 0}
              >
                <span className="material-symbols-outlined text-base">
                  download
                </span>
                Export All
              </button>
            </div>
          </div>

          {showImport ? (
            <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-primary">
                    Contract Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-border-color bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                    placeholder="MyContract"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-primary">
                    Contract Address
                  </label>
                  <input
                    className="w-full rounded-xl border border-border-color bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                    placeholder="0x..."
                    value={importAddress}
                    onChange={(e) => setImportAddress(e.target.value)}
                  />
                  {importAddress.trim() && !isAddress(importAddress.trim().replace(/^0X/, '0x'), { strict: false }) ? (
                    <p className="text-xs text-red-400">Invalid address</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <label className="text-sm font-medium text-text-primary">ABI JSON</label>
                <textarea
                  className="w-full min-h-40 rounded-xl border border-border-color bg-surface px-4 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-primary/50"
                  placeholder='[{"type":"function","name":"...","inputs":[],"outputs":[],"stateMutability":"view"}]'
                  value={importAbiJson}
                  onChange={(e) => setImportAbiJson(e.target.value)}
                />
              </div>

              {importError ? (
                <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {importError}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-3">
                <button
                  className="rounded-full border border-border-color bg-surface px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
                  onClick={() => {
                    setShowImport(false)
                    setImportError(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/80 transition-colors disabled:bg-primary/40 disabled:cursor-not-allowed"
                  onClick={handleImport}
                  disabled={!importAbiJson.trim() || !importAddress.trim()}
                >
                  Save ABI
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {abiManager.entries.length === 0 ? (
              <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 text-text-secondary">
                No custom ABIs saved yet. Import ABIs for unverified or custom contracts so Operations Explorer and the Decoder can show human-readable function calls.
              </div>
            ) : (
              abiManager.entries.map((e) => (
                <div
                  key={e.address}
                  className="flex items-center justify-between rounded-xl border border-border-color bg-surface-elevated/40 p-4"
                >
                  <div className="flex flex-col">
                    <p className="text-text-primary font-medium">{e.name}</p>
                    <p className="text-sm text-text-secondary font-mono">
                      {shortenAddress(e.address)}
                    </p>
                  </div>
                  <button
                    className="rounded-full p-2 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                    onClick={() => abiManager.remove(e.address as Address)}
                    title="Delete ABI"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
          </div>
          ) : null}
        </div>

        {/* Deploy a new timelock contract */}
        <div className={sectionCardClass}>
          <button
            type="button"
            className={sectionHeaderClass}
            onClick={() => toggleSection('deploy')}
            aria-expanded={sectionOpen.deploy}
          >
            <h2 className="text-text-primary text-[22px] font-bold leading-tight tracking-[-0.015em]">
              Deploy a new timelock contract
            </h2>
            <span
              className={`material-symbols-outlined text-text-secondary transition-transform ${sectionOpen.deploy ? 'rotate-180' : ''}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
          {sectionOpen.deploy ? (
            <div className={sectionBodyClass}>
              <p className="text-text-secondary text-sm mb-4">
                Deploy a new OpenZeppelin TimelockController on Rootstock from this app.
              </p>
              <Link
                href="/deploy_timelock"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/80"
              >
                <span className="material-symbols-outlined text-lg !text-white">add_circle</span>
                <span className="!text-white">Deploy Timelock</span>
              </Link>
            </div>
          ) : null}
        </div>    

        {/* Subgraph deployment */}
        <div className={sectionCardClass}>
          <button
            type="button"
            className={sectionHeaderClass}
            onClick={() => toggleSection('subgraph')}
            aria-expanded={sectionOpen.subgraph}
          >
            <h2 className="text-text-primary text-[22px] font-bold leading-tight tracking-[-0.015em]">
              Subgraph deployment
            </h2>
            <span
              className={`material-symbols-outlined text-text-secondary transition-transform ${sectionOpen.subgraph ? 'rotate-180' : ''}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
          {sectionOpen.subgraph ? (
            <div className={`${sectionBodyClass} space-y-4`}>
              <p className="text-text-secondary text-sm">
                Use this when you already have a timelock contract deployed and want to prepare and deploy a subgraph that indexes its events. The Graph Studio deploy key is
                always used locally on your machine and is never sent to this app.
              </p>
              <Link
                href="/subgraph/deploy"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80"
              >
                <span className="!text-white">Open subgraph deploy</span>
              </Link>
            </div>
          ) : null}
        </div>            
      </div>
    </main>
  )
}

export default SettingsView
