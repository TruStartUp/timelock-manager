/**
 * 4byte Directory Client
 *
 * Provides function signature lookup using the 4byte.directory API.
 * This is a fallback ABI source when contracts are not verified on Blockscout.
 *
 * Features:
 * - Function selector to signature mapping
 * - Text signature to full ABI fragment generation
 * - Session storage caching
 * - Support for multiple signature matches
 *
 * Note: 4byte directory provides LOW confidence ABIs since multiple functions
 * can have the same 4-byte selector (hash collision). Always prefer verified ABIs.
 */

import { type Hex } from 'viem'

/**
 * 4byte Directory API base URL
 */
const FOURBYTE_API_BASE =
  process.env.NEXT_PUBLIC_4BYTE_DIRECTORY_URL ||
  'https://www.4byte.directory/api/v1/'

/**
 * 4byte API response for signature lookup
 */
interface FourByteSignature {
  id: number
  text_signature: string
  hex_signature: string
  bytes_signature: string
}

interface FourByteResponse {
  count: number
  next: string | null
  previous: string | null
  results: FourByteSignature[]
}

/**
 * 4byte directory client error
 */
export class FourByteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FourByteError'
  }
}

/**
 * Parse text signature to ABI fragment
 *
 * Converts a text signature like "transfer(address,uint256)"
 * to a minimal ABI fragment that can be used for decoding.
 */
function parseTextSignatureToABI(textSignature: string): {
  name: string
  type: 'function'
  inputs: Array<{ name: string; type: string; internalType: string }>
  outputs: Array<unknown>
  stateMutability: 'nonpayable'
} {
  // Extract function name and parameters
  const match = textSignature.match(/^(\w+)\((.*)\)$/)
  if (!match) {
    throw new FourByteError(
      `Invalid text signature format: ${textSignature}`
    )
  }

  const [, name, paramsStr] = match
  const params = paramsStr ? paramsStr.split(',') : []

  const inputs = params.map((param, index) => ({
    name: `param${index}`,
    type: param.trim(),
    internalType: param.trim(),
  }))

  return {
    name,
    type: 'function',
    inputs,
    outputs: [],
    stateMutability: 'nonpayable',
  }
}

/**
 * Lookup function signature by 4-byte selector
 *
 * @param selector - 4-byte function selector (0x12345678)
 * @returns Array of matching signatures (can be multiple due to collisions)
 */
export async function lookupSignature(
  selector: Hex
): Promise<FourByteSignature[]> {
  // Validate selector format
  if (!selector.match(/^0x[0-9a-fA-F]{8}$/)) {
    throw new FourByteError(
      `Invalid selector format: ${selector}. Expected 0x followed by 8 hex characters.`
    )
  }

  // Check cache first
  const cached = getCachedSignature(selector)
  if (cached) {
    return cached
  }

  try {
    const url = `${FOURBYTE_API_BASE}signatures/?hex_signature=${selector}`
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new FourByteError(
        `HTTP ${response.status}: ${response.statusText}`
      )
    }

    const data: FourByteResponse = await response.json()

    if (data.results.length === 0) {
      return []
    }

    // Cache the results
    setCachedSignature(selector, data.results)

    return data.results
  } catch (error) {
    if (error instanceof FourByteError) {
      throw error
    }
    throw new FourByteError(
      `Failed to lookup signature: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Get function signature from calldata
 *
 * Extracts the first 4 bytes of calldata as the function selector.
 */
export function extractSelector(calldata: Hex): Hex {
  if (calldata.length < 10) {
    throw new FourByteError(
      `Calldata too short: ${calldata}. Expected at least 10 characters (0x + 8 hex chars).`
    )
  }
  return calldata.slice(0, 10) as Hex
}

/**
 * Decode calldata using 4byte directory
 *
 * @param calldata - Transaction calldata
 * @returns Array of possible function signatures with ABIs
 */
export async function decodeCalldata(calldata: Hex): Promise<
  Array<{
    signature: string
    abi: ReturnType<typeof parseTextSignatureToABI>
    confidence: 'low'
  }>
> {
  const selector = extractSelector(calldata)
  const signatures = await lookupSignature(selector)

  if (signatures.length === 0) {
    return []
  }

  // Convert each signature to an ABI fragment
  return signatures.map((sig) => ({
    signature: sig.text_signature,
    abi: parseTextSignatureToABI(sig.text_signature),
    confidence: 'low' as const,
  }))
}

/**
 * Get the most likely function signature (first result)
 *
 * Note: This returns the first match, which may not be correct if there are collisions.
 * Always display a warning when using 4byte results.
 */
export async function getBestGuessSignature(
  calldata: Hex
): Promise<{
  signature: string
  abi: ReturnType<typeof parseTextSignatureToABI>
  hasCollision: boolean
} | null> {
  const results = await decodeCalldata(calldata)

  if (results.length === 0) {
    return null
  }

  return {
    signature: results[0].signature,
    abi: results[0].abi,
    hasCollision: results.length > 1,
  }
}

/**
 * Cache management
 */

interface CachedSignatureEntry {
  results: FourByteSignature[]
  timestamp: number
}

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Get cached signature from sessionStorage
 */
function getCachedSignature(selector: Hex): FourByteSignature[] | null {
  if (typeof window === 'undefined') return null

  try {
    const key = `4byte_${selector.toLowerCase()}`
    const stored = sessionStorage.getItem(key)
    if (!stored) return null

    const entry: CachedSignatureEntry = JSON.parse(stored)

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(key)
      return null
    }

    return entry.results
  } catch (error) {
    console.error('Failed to get cached signature:', error)
    return null
  }
}

/**
 * Cache signature in sessionStorage
 */
function setCachedSignature(
  selector: Hex,
  results: FourByteSignature[]
): void {
  if (typeof window === 'undefined') return

  try {
    const key = `4byte_${selector.toLowerCase()}`
    const entry: CachedSignatureEntry = {
      results,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch (error) {
    console.error('Failed to cache signature:', error)
  }
}

/**
 * Clear all 4byte cache
 */
export function clearFourByteCache(): void {
  if (typeof window === 'undefined') return

  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach((key) => {
      if (key.startsWith('4byte_')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('Failed to clear 4byte cache:', error)
  }
}
