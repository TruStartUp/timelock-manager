/**
 * useNetworkConfig
 *
 * Stores and retrieves user-provided RPC overrides and dynamic timelock configuration.
 * Per spec/tasks:
 * - T095: localStorage persistence
 * - Used by SettingsView and Providers to reload wagmi config (T102)
 * - T010: Dynamic timelock configuration from TimelockContext
 */

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { TimelockContext } from '@/context/TimelockContext'

export type NetworkConfig = {
  /** Whether to use the custom RPC transport */
  enabled: boolean
  /** The custom RPC URL */
  rpcUrl: string
  /** Detected chainId for the RPC URL (helps apply to the right chain only) */
  rpcChainId: number | null
  /** Updated timestamp (ms) */
  updatedAtMs: number
}

const STORAGE_KEY = 'network_config_v1'
const UPDATED_AT_KEY = 'network_config_updated_at_ms'
const UPDATE_EVENT = 'networkConfigUpdated'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function readNetworkConfig(): NetworkConfig {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      rpcUrl: '',
      rpcChainId: null,
      updatedAtMs: 0,
    }
  }

  const stored = safeParse<Partial<NetworkConfig>>(localStorage.getItem(STORAGE_KEY))
  return {
    enabled: Boolean(stored?.enabled),
    rpcUrl: typeof stored?.rpcUrl === 'string' ? stored.rpcUrl : '',
    rpcChainId: typeof stored?.rpcChainId === 'number' ? stored.rpcChainId : null,
    updatedAtMs:
      typeof stored?.updatedAtMs === 'number' ? stored.updatedAtMs : 0,
  }
}

function writeNetworkConfig(next: NetworkConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  localStorage.setItem(UPDATED_AT_KEY, String(next.updatedAtMs))
  window.dispatchEvent(new Event(UPDATE_EVENT))
}

export function getNetworkConfigUpdatedAtMs(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(UPDATED_AT_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

export function useNetworkConfig() {
  const [config, setConfig] = useState<NetworkConfig>(() => readNetworkConfig())

  // T010: Safely access TimelockContext (may be undefined if called before provider is mounted)
  const timelockContext = useContext(TimelockContext)
  const selected = timelockContext?.selected ?? null

  // Keep multiple hook instances in sync (same-tab + cross-tab).
  useEffect(() => {
    const onUpdate = () => setConfig(readNetworkConfig())
    window.addEventListener(UPDATE_EVENT, onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener(UPDATE_EVENT, onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    const next: NetworkConfig = {
      ...readNetworkConfig(),
      enabled,
      updatedAtMs: Date.now(),
    }
    writeNetworkConfig(next)
    setConfig(next)
  }, [])

  const saveRpc = useCallback(
    (rpcUrl: string, rpcChainId: number | null) => {
      const next: NetworkConfig = {
        enabled: true,
        rpcUrl: rpcUrl.trim(),
        rpcChainId,
        updatedAtMs: Date.now(),
      }
      writeNetworkConfig(next)
      setConfig(next)
    },
    []
  )

  const reset = useCallback(() => {
    const next: NetworkConfig = {
      enabled: false,
      rpcUrl: '',
      rpcChainId: null,
      updatedAtMs: Date.now(),
    }
    writeNetworkConfig(next)
    setConfig(next)
  }, [])

  const hasCustomRpc = useMemo(
    () => config.enabled && Boolean(config.rpcUrl),
    [config.enabled, config.rpcUrl]
  )

  // T010: Dynamic timelock configuration from context
  const timelockAddress = useMemo<Address | null>(
    () => selected?.address ?? null,
    [selected]
  )

  const subgraphUrl = useMemo<string | null>(
    () => selected?.subgraphUrl ?? null,
    [selected]
  )

  const selectedNetwork = useMemo<'rsk_mainnet' | 'rsk_testnet' | null>(
    () => selected?.network ?? null,
    [selected]
  )

  const hasSelectedTimelock = useMemo(
    () => Boolean(selected),
    [selected]
  )

  return {
    config,
    hasCustomRpc,
    setEnabled,
    saveRpc,
    reset,
    // Dynamic timelock configuration
    timelockAddress,
    subgraphUrl,
    selectedNetwork,
    hasSelectedTimelock,
  }
}


