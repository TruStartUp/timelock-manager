/**
 * useABIManager
 *
 * Manages user-imported contract ABIs in sessionStorage.
 * Per spec/tasks:
 * - T096: sessionStorage persistence with CRUD
 * - T099/T100/T101: Settings UI integration (import/list/delete/export)
 * - T103: consumed by useContractABI (prefer custom ABI before Blockscout)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, isAddress } from 'viem'

export type ABIEntry = {
  address: Address
  name: string
  abi: unknown[]
  addedAtMs: number
}

type ABIStore = Record<string, ABIEntry>

const STORAGE_KEY = 'abi_manager_v1'
const UPDATED_AT_KEY = 'abi_manager_updated_at_ms'
const UPDATE_EVENT = 'abiManagerUpdated'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeAddress(input: string): Address | null {
  const trimmed = input.trim().replace(/^0X/, '0x')
  if (
    isAddress(trimmed, {
      strict: false,
    })
  ) {
    return trimmed.toLowerCase() as Address
  }
  return null
}

export function getABIManagerUpdatedAtMs(): number {
  if (typeof window === 'undefined') return 0
  const raw = sessionStorage.getItem(UPDATED_AT_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

export function getCustomABIFromSessionStorage(address: Address): ABIEntry | null {
  if (typeof window === 'undefined') return null
  const store = safeParse<ABIStore>(sessionStorage.getItem(STORAGE_KEY)) || {}
  return store[address.toLowerCase()] ?? null
}

function readStore(): ABIStore {
  if (typeof window === 'undefined') return {}
  return safeParse<ABIStore>(sessionStorage.getItem(STORAGE_KEY)) || {}
}

function writeStore(next: ABIStore) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  sessionStorage.setItem(UPDATED_AT_KEY, String(Date.now()))
  window.dispatchEvent(new Event(UPDATE_EVENT))
}

export function useABIManager() {
  const [store, setStore] = useState<ABIStore>(() => readStore())

  useEffect(() => {
    const onUpdate = () => setStore(readStore())
    window.addEventListener(UPDATE_EVENT, onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener(UPDATE_EVENT, onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])

  const entries = useMemo(() => {
    return Object.values(store).sort((a, b) => b.addedAtMs - a.addedAtMs)
  }, [store])

  const upsert = useCallback((params: { address: string; name: string; abi: unknown[] }) => {
    const address = normalizeAddress(params.address)
    if (!address) {
      throw new Error('Invalid contract address.')
    }
    const name = params.name.trim() || 'Custom ABI'
    if (!Array.isArray(params.abi)) {
      throw new Error('ABI must be a JSON array.')
    }
    const hasFunctions = params.abi.some((item: any) => item?.type === 'function')
    if (!hasFunctions) {
      throw new Error('ABI must contain at least one function definition.')
    }

    const next: ABIStore = {
      ...readStore(),
      [address]: {
        address,
        name,
        abi: params.abi,
        addedAtMs: Date.now(),
      },
    }
    writeStore(next)
    setStore(next)
  }, [])

  const remove = useCallback((address: Address) => {
    const next = { ...readStore() }
    delete next[address.toLowerCase()]
    writeStore(next)
    setStore(next)
  }, [])

  const clearAll = useCallback(() => {
    writeStore({})
    setStore({})
  }, [])

  const exportAll = useCallback(() => {
    return entries.map((e) => ({
      address: e.address,
      name: e.name,
      abi: e.abi,
      addedAtMs: e.addedAtMs,
    }))
  }, [entries])

  return {
    entries,
    upsert,
    remove,
    clearAll,
    exportAll,
  }
}


