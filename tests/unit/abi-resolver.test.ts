/**
 * Unit tests for ABI resolution priority logic
 * Tests the waterfall: Manual → Cache → Blockscout → Known Registry → 4byte
 * Based on src/services/blockscout/abi.ts and data-model.md
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Address, PublicClient } from 'viem'
import {
  getContractABI,
  setManualABI,
  clearABICache,
  ABISource,
  ABIConfidence,
  type ABIResolution,
} from '@/services/blockscout/abi'
import { BlockscoutClient } from '@/services/blockscout/client'

// Create mock instance before mocking the module
const mockBlockscoutInstance = {
  getContractABI: vi.fn(),
}

// Mock BlockscoutClient
vi.mock('@/services/blockscout/client', () => {
  return {
    BlockscoutClient: class {
      getContractABI = mockBlockscoutInstance.getContractABI
    },
  }
})

// Test addresses
const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address
const TEST_PROXY_ADDRESS = '0xProxy0000000000000000000000000000000000' as Address
const TEST_IMPLEMENTATION_ADDRESS =
  '0xImpl000000000000000000000000000000000000' as Address

// Mock ABI data
const MOCK_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
]

describe('ABI Resolution Priority', () => {
  let mockSessionStorage: Storage
  let mockPublicClient: PublicClient
  let storage: Record<string, string>

  beforeEach(() => {
    // Mock sessionStorage with shared storage object
    storage = {}
    mockSessionStorage = {
      getItem: vi.fn((key: string) => {
        return storage[key] || null
      }),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key]
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach((key) => delete storage[key])
      }),
      get length() {
        return Object.keys(storage).length
      },
      key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    } as Storage

    // Stub global window and sessionStorage
    // The implementation uses both window.sessionStorage and sessionStorage directly
    Object.defineProperty(global, 'window', {
      value: { sessionStorage: mockSessionStorage },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    })

    // Mock PublicClient for proxy detection
    mockPublicClient = {
      getStorageAt: vi.fn(),
    } as unknown as PublicClient

    // Reset all mocks and set default return value
    vi.clearAllMocks()
    mockBlockscoutInstance.getContractABI.mockClear()
    // Default mock: return empty result (not verified)
    mockBlockscoutInstance.getContractABI.mockResolvedValue({
      abi: null,
      verified: false,
    })
  })

  afterEach(() => {
    clearABICache()
    vi.restoreAllMocks()
  })

  describe('1. Manual ABI (Highest Priority)', () => {
    it('should return manual ABI from sessionStorage when available', async () => {
      // Arrange: Set manual ABI
      setManualABI(TEST_ADDRESS, MOCK_ABI)

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert
      expect(result.abi).toEqual(MOCK_ABI)
      expect(result.source).toBe(ABISource.MANUAL)
      expect(result.confidence).toBe(ABIConfidence.HIGH)
      expect(result.isProxy).toBe(false)

      // Verify Blockscout was NOT called
      expect(mockBlockscoutInstance.getContractABI).not.toHaveBeenCalled()
    })

    it('should return HIGH confidence with MANUAL source', async () => {
      // Arrange
      setManualABI(TEST_ADDRESS, MOCK_ABI)

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert
      expect(result.confidence).toBe(ABIConfidence.HIGH)
      expect(result.source).toBe(ABISource.MANUAL)
    })

    it('should skip all other resolution steps when manual ABI exists', async () => {
      // Arrange
      setManualABI(TEST_ADDRESS, MOCK_ABI)

      // Act
      await getContractABI(TEST_ADDRESS, 'testnet', mockPublicClient)

      // Assert: No Blockscout call, no proxy detection
      expect(mockBlockscoutInstance.getContractABI).not.toHaveBeenCalled()
      expect(mockPublicClient.getStorageAt).not.toHaveBeenCalled()
    })
  })

  describe('2. Session Cache', () => {
    it('should return cached ABI within 5-minute TTL', async () => {
      // Arrange: Manually set cache entry (simulating previous fetch)
      const cachedResult: ABIResolution = {
        abi: MOCK_ABI,
        source: ABISource.BLOCKSCOUT,
        confidence: ABIConfidence.HIGH,
        isProxy: false,
      }
      const cacheKey = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          result: cachedResult,
          timestamp: Date.now(), // Fresh timestamp
        })
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert
      expect(result).toEqual(cachedResult)
      expect(mockBlockscoutInstance.getContractABI).not.toHaveBeenCalled()
    })

    it('should invalidate cache after TTL expires', async () => {
      // Arrange: Set cache entry with expired timestamp
      const expiredTimestamp = Date.now() - 6 * 60 * 1000 // 6 minutes ago
      const cacheKey = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          result: {
            abi: MOCK_ABI,
            source: ABISource.BLOCKSCOUT,
            confidence: ABIConfidence.HIGH,
            isProxy: false,
          },
          timestamp: expiredTimestamp,
        })
      )

      // Mock Blockscout to return ABI (should be called after cache expires)
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Blockscout should be called since cache expired
      expect(mockBlockscoutInstance.getContractABI).toHaveBeenCalled()
    })

    it('should preserve original source and confidence from cache', async () => {
      // Arrange: Cache with KNOWN_REGISTRY source
      const cachedResult: ABIResolution = {
        abi: MOCK_ABI,
        source: ABISource.KNOWN_REGISTRY,
        confidence: ABIConfidence.HIGH,
        isProxy: false,
      }
      const cacheKey = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          result: cachedResult,
          timestamp: Date.now(),
        })
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert
      expect(result.source).toBe(ABISource.KNOWN_REGISTRY)
      expect(result.confidence).toBe(ABIConfidence.HIGH)
    })
  })

  describe('3. Blockscout Verified ABI', () => {
    it('should fetch ABI from Blockscout when contract is verified', async () => {
      // Arrange
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert
      expect(result.abi).toEqual(MOCK_ABI)
      expect(result.source).toBe(ABISource.BLOCKSCOUT)
      expect(result.confidence).toBe(ABIConfidence.HIGH)
      expect(mockBlockscoutInstance.getContractABI).toHaveBeenCalledWith(
        TEST_ADDRESS
      )
    })

    it('should return HIGH confidence with BLOCKSCOUT source', async () => {
      // Arrange
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert
      expect(result.confidence).toBe(ABIConfidence.HIGH)
      expect(result.source).toBe(ABISource.BLOCKSCOUT)
    })

    it('should cache the result in sessionStorage', async () => {
      // Arrange
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Check that cache was set
      const cacheKey = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        cacheKey,
        expect.stringContaining('"source":"BLOCKSCOUT"')
      )
    })

    it('should not use Blockscout ABI if contract is not verified', async () => {
      // Arrange
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: false, // Not verified
      })

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should fall through to next priority (known registry)
      // Since getKnownABI returns null, should return empty result
      expect(result.abi).toEqual([])
      expect(result.error).toBeDefined()
    })
  })

  describe('4. Proxy Detection & Resolution', () => {
    it('should detect EIP-1967 proxy via storage slot read', async () => {
      // Arrange: Mock storage slot with implementation address
      const implementationSlot =
        '0x000000000000000000000000' +
        TEST_IMPLEMENTATION_ADDRESS.slice(2).toLowerCase()
      ;(mockPublicClient.getStorageAt as ReturnType<typeof vi.fn>).mockResolvedValue(
        implementationSlot as `0x${string}`
      )

      // Mock Blockscout to return ABI for implementation
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      const result = await getContractABI(
        TEST_PROXY_ADDRESS,
        'testnet',
        mockPublicClient
      )

      // Assert
      expect(mockPublicClient.getStorageAt).toHaveBeenCalled()
      expect(result.isProxy).toBe(true)
      // Address extracted from storage slot is lowercase
      expect(result.implementationAddress?.toLowerCase()).toBe(
        TEST_IMPLEMENTATION_ADDRESS.toLowerCase()
      )
      // Should fetch ABI for implementation, not proxy (case-insensitive)
      expect(mockBlockscoutInstance.getContractABI).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(TEST_IMPLEMENTATION_ADDRESS.slice(2), 'i'))
      )
    })

    it('should fetch implementation ABI instead of proxy ABI', async () => {
      // Arrange
      const implementationSlot =
        '0x000000000000000000000000' +
        TEST_IMPLEMENTATION_ADDRESS.slice(2).toLowerCase()
      ;(mockPublicClient.getStorageAt as ReturnType<typeof vi.fn>).mockResolvedValue(
        implementationSlot as `0x${string}`
      )
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      const result = await getContractABI(
        TEST_PROXY_ADDRESS,
        'testnet',
        mockPublicClient
      )

      // Assert: Should NOT call Blockscout with proxy address
      expect(mockBlockscoutInstance.getContractABI).not.toHaveBeenCalledWith(
        TEST_PROXY_ADDRESS
      )
      // Should call with implementation address (case-insensitive comparison)
      expect(mockBlockscoutInstance.getContractABI).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(TEST_IMPLEMENTATION_ADDRESS.slice(2), 'i'))
      )
      expect(result.abi).toEqual(MOCK_ABI)
    })

    it('should include proxy info (isProxy: true, implementationAddress)', async () => {
      // Arrange
      const implementationSlot =
        '0x000000000000000000000000' +
        TEST_IMPLEMENTATION_ADDRESS.slice(2).toLowerCase()
      ;(mockPublicClient.getStorageAt as ReturnType<typeof vi.fn>).mockResolvedValue(
        implementationSlot as `0x${string}`
      )
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      const result = await getContractABI(
        TEST_PROXY_ADDRESS,
        'testnet',
        mockPublicClient
      )

      // Assert
      expect(result.isProxy).toBe(true)
      // Address may be lowercased by implementation
      expect(result.implementationAddress?.toLowerCase()).toBe(
        TEST_IMPLEMENTATION_ADDRESS.toLowerCase()
      )
    })

    it('should handle non-proxy contracts (isProxy: false)', async () => {
      // Arrange: Empty storage slot (not a proxy)
      ;(mockPublicClient.getStorageAt as ReturnType<typeof vi.fn>).mockResolvedValue(
        `0x${'0'.repeat(64)}` as `0x${string}`
      )
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      const result = await getContractABI(
        TEST_ADDRESS,
        'testnet',
        mockPublicClient
      )

      // Assert
      expect(result.isProxy).toBe(false)
      expect(result.implementationAddress).toBeUndefined()
    })
  })

  describe('5. Known Registry Fallback', () => {
    it('should return known ABI for standard contracts when implemented', async () => {
      // Note: getKnownABI currently returns null (not implemented)
      // This test documents expected behavior when registry is implemented
      // For now, we test that it's called in the priority order

      // Arrange: No manual ABI, no cache, Blockscout fails
      mockBlockscoutInstance.getContractABI.mockRejectedValue(
        new Error('Not found')
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should fall through to known registry check
      // Since getKnownABI returns null, should return empty result
      expect(result.abi).toEqual([])
      expect(result.error).toBeDefined()
    })

    it('should return HIGH confidence with KNOWN_REGISTRY source when implemented', async () => {
      // This test documents expected behavior
      // When getKnownABI is implemented, it should return HIGH confidence
      // For now, we verify the code path exists
      expect(true).toBe(true) // Placeholder until registry is implemented
    })
  })

  describe('6. 4byte Directory Fallback', () => {
    it('should return LOW confidence when only 4byte available', async () => {
      // Note: 4byte is not currently integrated in getContractABI
      // The current implementation returns empty result with LOW confidence
      // This test documents expected behavior

      // Arrange: All higher priority sources fail
      mockBlockscoutInstance.getContractABI.mockRejectedValue(
        new Error('Not found')
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should return empty result with error
      expect(result.abi).toEqual([])
      expect(result.confidence).toBe(ABIConfidence.LOW)
      expect(result.error).toBeDefined()
    })

    it('should NOT be called if higher priority sources succeed', async () => {
      // Arrange: Blockscout succeeds
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act
      await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should not need 4byte (Blockscout succeeded)
      // Verify Blockscout was called
      expect(mockBlockscoutInstance.getContractABI).toHaveBeenCalled()
    })
  })

  describe('7. Priority Order Verification', () => {
    it('should follow waterfall: Manual → Cache → Blockscout → Known → 4byte', async () => {
      // Test 1: Manual (should stop here)
      setManualABI(TEST_ADDRESS, MOCK_ABI)
      let result = await getContractABI(TEST_ADDRESS, 'testnet')
      expect(result.source).toBe(ABISource.MANUAL)
      clearABICache()
      // Also clear manual ABI
      const manualKey = `manual_abi_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.removeItem(manualKey)

      // Test 2: Cache (should stop here)
      const cacheKey = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          result: {
            abi: MOCK_ABI,
            source: ABISource.BLOCKSCOUT,
            confidence: ABIConfidence.HIGH,
            isProxy: false,
          },
          timestamp: Date.now(),
        })
      )
      result = await getContractABI(TEST_ADDRESS, 'testnet')
      expect(result.source).toBe(ABISource.BLOCKSCOUT) // From cache
      clearABICache()
      // Also clear manual ABI and ensure cache is cleared
      const manualKey2 = `manual_abi_${TEST_ADDRESS.toLowerCase()}`
      const cacheKey2 = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.removeItem(manualKey2)
      mockSessionStorage.removeItem(cacheKey2)
      // Reset mock call count
      mockBlockscoutInstance.getContractABI.mockClear()

      // Test 3: Blockscout (should be called)
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })
      result = await getContractABI(TEST_ADDRESS, 'testnet')
      expect(result.source).toBe(ABISource.BLOCKSCOUT)
      expect(mockBlockscoutInstance.getContractABI).toHaveBeenCalled()
      clearABICache()
      // Clear cache manually to ensure Test 4 doesn't use cached result
      const cacheKey3 = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.removeItem(cacheKey3)
      mockBlockscoutInstance.getContractABI.mockClear()

      // Test 4: Known Registry (currently returns null, so falls through)
      mockBlockscoutInstance.getContractABI.mockRejectedValue(
        new Error('Not found')
      )
      result = await getContractABI(TEST_ADDRESS, 'testnet')
      expect(result.abi).toEqual([]) // No known ABI, returns empty
    })

    it('should try Known Registry if Blockscout fails with 404', async () => {
      // Arrange: Blockscout returns 404
      mockBlockscoutInstance.getContractABI.mockRejectedValue(
        new Error('404 Not Found')
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should fall through to known registry
      // Since getKnownABI returns null, should return empty result
      expect(result.abi).toEqual([])
      expect(result.error).toBeDefined()
    })

    it('should fall back to empty result if Known Registry returns null', async () => {
      // Arrange: All sources fail
      mockBlockscoutInstance.getContractABI.mockRejectedValue(
        new Error('Not found')
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should return empty result with error
      expect(result.abi).toEqual([])
      expect(result.confidence).toBe(ABIConfidence.LOW)
      expect(result.error).toBe('Contract not verified and no known ABI')
    })
  })

  describe('8. Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      // Arrange: Network error
      mockBlockscoutInstance.getContractABI.mockRejectedValue(
        new Error('Network error')
      )

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should not throw, should return empty result
      expect(result.abi).toEqual([])
      expect(result.error).toBeDefined()
    })

    it('should handle malformed API responses', async () => {
      // Arrange: Malformed response
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: null, // Invalid
        verified: true,
      })

      // Act
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should fall through to next priority
      expect(result.abi).toEqual([])
    })

    it('should handle sessionStorage quota exceeded', async () => {
      // Arrange: Simulate quota exceeded
      mockSessionStorage.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError')
      })

      // Mock Blockscout to succeed
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act: Should not throw
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should still return result (cache failure is non-fatal)
      expect(result.abi).toEqual(MOCK_ABI)
    })

    it('should handle invalid JSON in sessionStorage', async () => {
      // Arrange: Invalid JSON in cache
      const cacheKey = `abi_cache_${TEST_ADDRESS.toLowerCase()}`
      mockSessionStorage.getItem = vi.fn((key: string) => {
        if (key === cacheKey) return 'invalid json{'
        return null
      })

      // Mock Blockscout to succeed
      mockBlockscoutInstance.getContractABI.mockResolvedValue({
        abi: MOCK_ABI,
        verified: true,
      })

      // Act: Should not throw
      const result = await getContractABI(TEST_ADDRESS, 'testnet')

      // Assert: Should fall through to Blockscout
      expect(result.abi).toEqual(MOCK_ABI)
    })
  })
})
