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
import detectProxyLib from 'evm-proxy-detection'
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
 * Detect if address is a proxy contract
 *
 * Uses evm-proxy-detection library to support multiple proxy patterns:
 * - EIP-1967 (Transparent Proxy)
 * - EIP-1822 (UUPS)
 * - EIP-1167 (Minimal Proxy/Clone)
 */
async function detectProxy(
  address: Address,
  publicClient?: PublicClient
): Promise<ProxyInfo> {
  if (!publicClient) {
    return { isProxy: false }
  }

  try {
    const normalizedProxyAddress = address.toLowerCase() as `0x${string}`

    // Create a wrapper function to adapt viem's request to EIP1193 format
    const jsonRpcRequest = async (args: {
      method: string
      params?: unknown[]
    }): Promise<unknown> => {
      return publicClient.request({
        method: args.method as any,
        params: args.params as any,
      } as any)
    }

    // Use evm-proxy-detection library
    const result = await detectProxyLib(normalizedProxyAddress, jsonRpcRequest)

    if (result) {
      // Handle both single result and diamond result types
      const target = Array.isArray(result.target)
        ? result.target[0]
        : result.target

      return {
        isProxy: true,
        implementation: target as Address,
        proxyType: result.type, // e.g., "Eip1967Direct", "Eip1822", "Eip1167"
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
  const normalizedAddress = address.toLowerCase() as Address

  // Step 1: Check manual ABI from sessionStorage
  const manualABI = getManualABI(normalizedAddress)
  if (manualABI) {
    return {
      abi: manualABI,
      source: ABISource.MANUAL,
      confidence: ABIConfidence.HIGH,
      isProxy: false,
    }
  }

  // Step 2: Check session cache
  const cachedABI = getSessionCachedABI(normalizedAddress)
  if (cachedABI) {
    return cachedABI
  }

  // Step 3: Detect proxy
  let targetAddress = normalizedAddress
  let proxyInfo: ProxyInfo = { isProxy: false }

  if (publicClient) {
    proxyInfo = await detectProxy(normalizedAddress, publicClient)
    if (proxyInfo.isProxy && proxyInfo.implementation) {
      targetAddress = proxyInfo.implementation.toLowerCase() as Address
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
      setSessionCachedABI(normalizedAddress, result)
      return result
    }
  } catch (error) {
    // Don't throw - fall through to next resolution step
  }

  // Step 5: Try known registry (standard contracts)
  const knownABI = getKnownABI(normalizedAddress)
  if (knownABI) {
    const result: ABIResolution = {
      abi: knownABI,
      source: ABISource.KNOWN_REGISTRY,
      confidence: ABIConfidence.HIGH,
      isProxy: proxyInfo.isProxy,
      implementationAddress: proxyInfo.implementation,
    }

    setSessionCachedABI(normalizedAddress, result)
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
