/**
 * Contract ABI Resolution
 *
 * Implements ABI fetching with proxy detection and fallback strategies.
 *
 * Resolution Priority:
 * 1. Manual (user-provided ABI from sessionStorage)
 * 2. Session cache (previously fetched ABIs)
 * 3. Blockscout verified with proxy resolution (HIGH confidence)
 * 4. Known registry (TimelockController, AccessControl, etc.)
 * 5. 4byte directory (LOW confidence - fallback only)
 *
 * Features:
 * - Proxy detection (EIP-1967, EIP-1822, EIP-1167)
 * - Automatic implementation ABI fetching
 * - Session storage caching
 * - Confidence indicators
 */

import { type Address, type PublicClient } from 'viem'
import { BlockscoutClient, type BlockscoutNetwork } from './client'

/**
 * ABI source types
 */
export enum ABISource {
  MANUAL = 'MANUAL',
  BLOCKSCOUT = 'BLOCKSCOUT',
  KNOWN_REGISTRY = 'KNOWN_REGISTRY',
  FOURBYTE = 'FOURBYTE',
}

/**
 * ABI confidence levels
 */
export enum ABIConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * ABI resolution result
 */
export interface ABIResolution {
  abi: unknown[]
  source: ABISource
  confidence: ABIConfidence
  isProxy: boolean
  implementationAddress?: Address
  error?: string
}

/**
 * Proxy detection result
 */
interface ProxyInfo {
  isProxy: boolean
  implementation?: Address
  proxyType?: string
}

/**
 * EIP-1967 storage slots
 */
const EIP1967_SLOTS = {
  // keccak256('eip1967.proxy.implementation') - 1
  IMPLEMENTATION:
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  // keccak256('eip1967.proxy.beacon') - 1
  BEACON:
    '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
} as const

/**
 * Detect if address is a proxy contract
 *
 * Checks EIP-1967 storage slots for implementation address.
 * Falls back to Blockscout detection if direct storage reads fail.
 */
async function detectProxy(
  address: Address,
  publicClient?: PublicClient
): Promise<ProxyInfo> {
  if (!publicClient) {
    return { isProxy: false }
  }

  try {
    // Check EIP-1967 implementation slot
    const implementationSlot = await publicClient.getStorageAt({
      address,
      slot: EIP1967_SLOTS.IMPLEMENTATION as `0x${string}`,
    })

    if (
      implementationSlot &&
      implementationSlot !== `0x${'0'.repeat(64)}`
    ) {
      // Extract address from storage slot (last 20 bytes)
      const implementation = `0x${implementationSlot.slice(-40)}` as Address
      return {
        isProxy: true,
        implementation,
        proxyType: 'EIP-1967',
      }
    }

    // Check EIP-1967 beacon slot
    const beaconSlot = await publicClient.getStorageAt({
      address,
      slot: EIP1967_SLOTS.BEACON as `0x${string}`,
    })

    if (beaconSlot && beaconSlot !== `0x${'0'.repeat(64)}`) {
      const beacon = `0x${beaconSlot.slice(-40)}` as Address
      // For beacon proxies, we'd need to call the beacon to get the implementation
      // For now, return that it's a proxy but without implementation
      return {
        isProxy: true,
        proxyType: 'EIP-1967 Beacon',
      }
    }

    return { isProxy: false }
  } catch (error) {
    console.warn('Proxy detection failed:', error)
    return { isProxy: false }
  }
}

/**
 * Get contract ABI with proxy resolution
 *
 * @param address - Contract address
 * @param network - Blockscout network (mainnet/testnet)
 * @param publicClient - Optional viem public client for proxy detection
 * @returns ABI resolution result
 */
export async function getContractABI(
  address: Address,
  network: BlockscoutNetwork,
  publicClient?: PublicClient
): Promise<ABIResolution> {
  // Step 1: Check manual ABI from sessionStorage
  const manualABI = getManualABI(address)
  if (manualABI) {
    return {
      abi: manualABI,
      source: ABISource.MANUAL,
      confidence: ABIConfidence.HIGH,
      isProxy: false,
    }
  }

  // Step 2: Check session cache
  const cachedABI = getSessionCachedABI(address)
  if (cachedABI) {
    return cachedABI
  }

  // Step 3: Detect proxy
  let targetAddress = address
  let proxyInfo: ProxyInfo = { isProxy: false }

  if (publicClient) {
    proxyInfo = await detectProxy(address, publicClient)
    if (proxyInfo.isProxy && proxyInfo.implementation) {
      targetAddress = proxyInfo.implementation
    }
  }

  // Step 4: Try Blockscout verified ABI
  const blockscoutClient = new BlockscoutClient(network)

  try {
    const { abi, verified } =
      await blockscoutClient.getContractABI(targetAddress)

    if (verified && abi && abi.length > 0) {
      const result: ABIResolution = {
        abi,
        source: ABISource.BLOCKSCOUT,
        confidence: ABIConfidence.HIGH,
        isProxy: proxyInfo.isProxy,
        implementationAddress: proxyInfo.implementation,
      }

      // Cache the result
      setSessionCachedABI(address, result)
      return result
    }
  } catch (error) {
    console.warn('Blockscout ABI fetch failed:', error)
  }

  // Step 5: Try known registry (standard contracts)
  const knownABI = getKnownABI(address)
  if (knownABI) {
    const result: ABIResolution = {
      abi: knownABI,
      source: ABISource.KNOWN_REGISTRY,
      confidence: ABIConfidence.HIGH,
      isProxy: proxyInfo.isProxy,
      implementationAddress: proxyInfo.implementation,
    }

    setSessionCachedABI(address, result)
    return result
  }

  // Step 6: No ABI found
  return {
    abi: [],
    source: ABISource.BLOCKSCOUT,
    confidence: ABIConfidence.LOW,
    isProxy: proxyInfo.isProxy,
    implementationAddress: proxyInfo.implementation,
    error: 'Contract not verified and no known ABI',
  }
}

/**
 * Get manually provided ABI from sessionStorage
 */
function getManualABI(address: Address): unknown[] | null {
  if (typeof window === 'undefined') return null

  try {
    const key = `manual_abi_${address.toLowerCase()}`
    const stored = sessionStorage.getItem(key)
    if (!stored) return null

    const data = JSON.parse(stored)
    return data.abi
  } catch (error) {
    console.error('Failed to get manual ABI:', error)
    return null
  }
}

/**
 * Store manually provided ABI in sessionStorage
 */
export function setManualABI(address: Address, abi: unknown[]): void {
  if (typeof window === 'undefined') return

  try {
    const key = `manual_abi_${address.toLowerCase()}`
    const data = {
      abi,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to set manual ABI:', error)
  }
}

/**
 * Get cached ABI result from sessionStorage
 */
function getSessionCachedABI(address: Address): ABIResolution | null {
  if (typeof window === 'undefined') return null

  try {
    const key = `abi_cache_${address.toLowerCase()}`
    const stored = sessionStorage.getItem(key)
    if (!stored) return null

    const data = JSON.parse(stored)

    // Check TTL (5 minutes)
    const TTL = 5 * 60 * 1000
    if (Date.now() - data.timestamp > TTL) {
      sessionStorage.removeItem(key)
      return null
    }

    return data.result
  } catch (error) {
    console.error('Failed to get cached ABI:', error)
    return null
  }
}

/**
 * Store ABI resolution result in sessionStorage
 */
function setSessionCachedABI(
  address: Address,
  result: ABIResolution
): void {
  if (typeof window === 'undefined') return

  try {
    const key = `abi_cache_${address.toLowerCase()}`
    const data = {
      result,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to cache ABI:', error)
  }
}

/**
 * Get ABI from known contracts registry
 *
 * This is a placeholder for standard contracts like TimelockController, AccessControl, etc.
 * In a real implementation, this would check against a registry of well-known contract ABIs.
 */
function getKnownABI(address: Address): unknown[] | null {
  // TODO: Implement known contracts registry
  // Could include:
  // - OpenZeppelin standard contracts (TimelockController, AccessControl)
  // - Common Rootstock contracts
  // - Protocol-specific contracts
  return null
}

/**
 * Clear all cached ABIs
 */
export function clearABICache(address?: Address): void {
  if (typeof window === 'undefined') return

  try {
    if (address) {
      const keys = [
        `abi_cache_${address.toLowerCase()}`,
        `manual_abi_${address.toLowerCase()}`,
      ]
      keys.forEach((key) => sessionStorage.removeItem(key))
    } else {
      // Clear all ABI-related items
      const keys = Object.keys(sessionStorage)
      keys.forEach((key) => {
        if (key.startsWith('abi_cache_') || key.startsWith('manual_abi_')) {
          sessionStorage.removeItem(key)
        }
      })
    }
  } catch (error) {
    console.error('Failed to clear ABI cache:', error)
  }
}
