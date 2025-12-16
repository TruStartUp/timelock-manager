/**
 * Unit tests for Zod validators for Solidity types
 * Tests address checksum, uint ranges, bytes hex format, and all Solidity type validators
 * Based on src/lib/validation.ts and research.md Section 4
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  solidityValidators,
  parseABITypeToZod,
  getNumericRange,
  getExpectedBytesLength,
  isValidAddress,
  isValidHex,
  validateAddress,
  isValidUint256,
  isValidInt256,
} from '@/lib/validation'
import { isAddress } from 'viem'

describe('Zod Validators for Solidity Types', () => {
  describe('1. Address Validation', () => {
    it('should accept valid checksummed address', () => {
      // Rootstock-friendly behavior: accept valid address and normalize to lowercase.
      const validAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0'
      const result = solidityValidators.address.safeParse(validAddress)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(validAddress)
      }
    })

    it('should accept mixed-case address and normalize to lowercase', () => {
      const mixedCase =
        '0x742D35CC6634c0532925A3b844BC9E7595F0BEb0' as const
      const expected = mixedCase.toLowerCase()
      const result = solidityValidators.address.safeParse(mixedCase)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(expected)
        expect(result.data).not.toBe(mixedCase)
      }
    })

    it('should reject invalid address: missing characters', () => {
      const invalidAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0b' // Too short (39 chars)
      const result = solidityValidators.address.safeParse(invalidAddress)

      expect(result.success).toBe(false)
    })

    it('should reject invalid address: wrong length', () => {
      const invalidAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0123' // Too long (43 chars)
      const result = solidityValidators.address.safeParse(invalidAddress)

      expect(result.success).toBe(false)
    })

    it('should reject invalid address: invalid characters', () => {
      const invalidAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEg0' // Invalid 'g'
      const result = solidityValidators.address.safeParse(invalidAddress)

      expect(result.success).toBe(false)
    })

    it('should reject address without 0x prefix', () => {
      const invalidAddress = '742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
      const result = solidityValidators.address.safeParse(invalidAddress)

      expect(result.success).toBe(false)
    })

    it('should normalize to lowercase 0x format', () => {
      const mixedCase =
        '0x742D35CC6634c0532925A3b844BC9E7595F0BEb0' as const
      const result = solidityValidators.address.parse(mixedCase)

      expect(result).toBe(mixedCase.toLowerCase())
      expect(result).toMatch(/^0x[0-9a-f]{40}$/)
    })
  })

  describe('2. Uint Validation', () => {
    describe('uint8', () => {
      const uint8Validator = solidityValidators.uint(8)

      it('should accept min value (0)', () => {
        const result = uint8Validator.safeParse('0')
        expect(result.success).toBe(true)
      })

      it('should accept max value (255)', () => {
        const result = uint8Validator.safeParse('255')
        expect(result.success).toBe(true)
      })

      it('should reject value above max (256)', () => {
        const result = uint8Validator.safeParse('256')
        expect(result.success).toBe(false)
      })

      it('should reject negative numbers', () => {
        const result = uint8Validator.safeParse('-1')
        expect(result.success).toBe(false)
      })
    })

    describe('uint16', () => {
      const uint16Validator = solidityValidators.uint(16)

      it('should accept min value (0)', () => {
        const result = uint16Validator.safeParse('0')
        expect(result.success).toBe(true)
      })

      it('should accept max value (65535)', () => {
        const result = uint16Validator.safeParse('65535')
        expect(result.success).toBe(true)
      })

      it('should reject value above max', () => {
        const result = uint16Validator.safeParse('65536')
        expect(result.success).toBe(false)
      })
    })

    describe('uint256', () => {
      const uint256Validator = solidityValidators.uint(256)

      it('should accept min value (0)', () => {
        const result = uint256Validator.safeParse('0')
        expect(result.success).toBe(true)
      })

      it('should accept max value (2^256-1)', () => {
        const maxUint256 = (BigInt(2) ** BigInt(256) - BigInt(1)).toString()
        const result = uint256Validator.safeParse(maxUint256)
        expect(result.success).toBe(true)
      })

      it('should reject value above max', () => {
        const overflow = (BigInt(2) ** BigInt(256)).toString()
        const result = uint256Validator.safeParse(overflow)
        expect(result.success).toBe(false)
      })

      it('should accept valid BigInt string', () => {
        const bigNumber = '123456789012345678901234567890'
        const result = uint256Validator.safeParse(bigNumber)
        expect(result.success).toBe(true)
      })

      it('should reject negative numbers', () => {
        const result = uint256Validator.safeParse('-1')
        expect(result.success).toBe(false)
      })

      it('should reject non-numeric string', () => {
        const result = uint256Validator.safeParse('abc')
        expect(result.success).toBe(false)
      })

      it('should reject decimals', () => {
        const result = uint256Validator.safeParse('123.45')
        expect(result.success).toBe(false)
      })

      it('should reject scientific notation', () => {
        const result = uint256Validator.safeParse('1e10')
        expect(result.success).toBe(false)
      })
    })
  })

  describe('3. Int Validation', () => {
    describe('int8', () => {
      const int8Validator = solidityValidators.int(8)

      it('should accept min value (-128)', () => {
        const result = int8Validator.safeParse('-128')
        expect(result.success).toBe(true)
      })

      it('should accept max value (127)', () => {
        const result = int8Validator.safeParse('127')
        expect(result.success).toBe(true)
      })

      it('should accept zero', () => {
        const result = int8Validator.safeParse('0')
        expect(result.success).toBe(true)
      })

      it('should reject value below min (-129)', () => {
        const result = int8Validator.safeParse('-129')
        expect(result.success).toBe(false)
      })

      it('should reject value above max (128)', () => {
        const result = int8Validator.safeParse('128')
        expect(result.success).toBe(false)
      })
    })

    describe('int256', () => {
      const int256Validator = solidityValidators.int(256)

      it('should accept min value (-2^255)', () => {
        const twoTo255 = BigInt(2) ** BigInt(255)
        const minInt256 = (-twoTo255).toString()
        const result = int256Validator.safeParse(minInt256)
        expect(result.success).toBe(true)
      })

      it('should accept max value (2^255-1)', () => {
        const twoTo255 = BigInt(2) ** BigInt(255)
        const maxInt256 = (twoTo255 - BigInt(1)).toString()
        const result = int256Validator.safeParse(maxInt256)
        expect(result.success).toBe(true)
      })

      it('should accept valid negative BigInt', () => {
        const negativeBigInt = '-123456789012345678901234567890'
        const result = int256Validator.safeParse(negativeBigInt)
        expect(result.success).toBe(true)
      })

      it('should reject value below min', () => {
        const twoTo255 = BigInt(2) ** BigInt(255)
        const underflow = (-twoTo255 - BigInt(1)).toString()
        const result = int256Validator.safeParse(underflow)
        expect(result.success).toBe(false)
      })

      it('should reject value above max', () => {
        const twoTo255 = BigInt(2) ** BigInt(255)
        const overflow = twoTo255.toString()
        const result = int256Validator.safeParse(overflow)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('4. Bytes Validation (Dynamic)', () => {
    it('should accept valid hex with even length', () => {
      const validHex = '0x1234abcd'
      const result = solidityValidators.bytes.safeParse(validHex)
      expect(result.success).toBe(true)
    })

    it('should accept empty bytes (0x)', () => {
      const result = solidityValidators.bytes.safeParse('0x')
      expect(result.success).toBe(true)
    })

    it('should accept long bytes string (simulate calldata)', () => {
      const longHex = '0x' + 'a'.repeat(1000) // 500 bytes
      const result = solidityValidators.bytes.safeParse(longHex)
      expect(result.success).toBe(true)
    })

    it('should reject odd length hex', () => {
      const oddHex = '0x123'
      const result = solidityValidators.bytes.safeParse(oddHex)
      expect(result.success).toBe(false)
    })

    it('should reject missing 0x prefix', () => {
      const noPrefix = '1234abcd'
      const result = solidityValidators.bytes.safeParse(noPrefix)
      expect(result.success).toBe(false)
    })

    it('should reject non-hex characters', () => {
      const invalidHex = '0x123g'
      const result = solidityValidators.bytes.safeParse(invalidHex)
      expect(result.success).toBe(false)
    })

    it('should accept uppercase hex', () => {
      const upperHex = '0xABCDEF'
      const result = solidityValidators.bytes.safeParse(upperHex)
      expect(result.success).toBe(true)
    })
  })

  describe('5. BytesFixed Validation', () => {
    describe('bytes32', () => {
      const bytes32Validator = solidityValidators.bytesFixed(32)

      it('should accept exactly 32 bytes (66 characters including 0x)', () => {
        const validBytes32 = '0x' + 'a'.repeat(64) // 32 bytes = 64 hex chars
        const result = bytes32Validator.safeParse(validBytes32)
        expect(result.success).toBe(true)
      })

      it('should reject wrong length (too short)', () => {
        const tooShort = '0x' + 'a'.repeat(62) // 31 bytes
        const result = bytes32Validator.safeParse(tooShort)
        expect(result.success).toBe(false)
      })

      it('should reject wrong length (too long)', () => {
        const tooLong = '0x' + 'a'.repeat(66) // 33 bytes
        const result = bytes32Validator.safeParse(tooLong)
        expect(result.success).toBe(false)
      })

      it('should reject odd length', () => {
        const oddLength = '0x' + 'a'.repeat(63) // Odd
        const result = bytes32Validator.safeParse(oddLength)
        expect(result.success).toBe(false)
      })

      it('should reject non-hex characters', () => {
        const invalid = '0x' + 'a'.repeat(62) + 'g' // Invalid char
        const result = bytes32Validator.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe('bytes4 (function selectors)', () => {
      const bytes4Validator = solidityValidators.bytesFixed(4)

      it('should accept exactly 4 bytes (10 characters)', () => {
        const validBytes4 = '0x12345678'
        const result = bytes4Validator.safeParse(validBytes4)
        expect(result.success).toBe(true)
      })

      it('should reject wrong length', () => {
        const wrongLength = '0x123456' // 3 bytes
        const result = bytes4Validator.safeParse(wrongLength)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('6. String and Bool', () => {
    describe('string', () => {
      it('should accept any valid string', () => {
        const result = solidityValidators.string.safeParse('hello')
        expect(result.success).toBe(true)
      })

      it('should accept empty string', () => {
        const result = solidityValidators.string.safeParse('')
        expect(result.success).toBe(true)
      })

      it('should accept unicode string', () => {
        const result = solidityValidators.string.safeParse('你好世界')
        expect(result.success).toBe(true)
      })

      it('should accept special characters', () => {
        const result = solidityValidators.string.safeParse('!@#$%^&*()')
        expect(result.success).toBe(true)
      })
    })

    describe('bool', () => {
      it('should accept true', () => {
        const result = solidityValidators.bool.safeParse(true)
        expect(result.success).toBe(true)
      })

      it('should accept false', () => {
        const result = solidityValidators.bool.safeParse(false)
        expect(result.success).toBe(true)
      })

      it('should reject non-boolean values', () => {
        const result = solidityValidators.bool.safeParse('true')
        expect(result.success).toBe(false)
      })
    })
  })

  describe('7. Arrays', () => {
    describe('dynamic array: address[]', () => {
      const addressArrayValidator = solidityValidators.array(
        solidityValidators.address
      )

      it('should accept variable length array', () => {
        const addresses = [
          '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
          '0x1234567890123456789012345678901234567890',
        ]
        const result = addressArrayValidator.safeParse(addresses)
        expect(result.success).toBe(true)
      })

      it('should accept empty array', () => {
        const result = addressArrayValidator.safeParse([])
        expect(result.success).toBe(true)
      })

      it('should reject array with invalid addresses', () => {
        const invalid = ['0xinvalid']
        const result = addressArrayValidator.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe('fixed array: uint256[3]', () => {
      const uint256Validator = solidityValidators.uint(256)
      const fixedArrayValidator = z.array(uint256Validator).length(3)

      it('should accept exactly 3 elements', () => {
        const valid = ['1', '2', '3']
        const result = fixedArrayValidator.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it('should reject wrong element count (too few)', () => {
        const tooFew = ['1', '2']
        const result = fixedArrayValidator.safeParse(tooFew)
        expect(result.success).toBe(false)
      })

      it('should reject wrong element count (too many)', () => {
        const tooMany = ['1', '2', '3', '4']
        const result = fixedArrayValidator.safeParse(tooMany)
        expect(result.success).toBe(false)
      })
    })

    describe('nested arrays: uint256[][]', () => {
      const uint256Validator = solidityValidators.uint(256)
      const nestedArrayValidator = solidityValidators.array(
        solidityValidators.array(uint256Validator)
      )

      it('should accept nested arrays', () => {
        const nested = [['1', '2'], ['3', '4']]
        const result = nestedArrayValidator.safeParse(nested)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('8. Tuples (Structs)', () => {
    it('should parse tuple with components: (address,uint256)', () => {
      const tupleSchema = parseABITypeToZod('tuple', [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ])

      const validTuple = [
        '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
        '1000000',
      ]
      const result = tupleSchema.safeParse(validTuple)
      expect(result.success).toBe(true)
    })

    it('should parse nested tuples: (address,(uint256,bool))', () => {
      const tupleSchema = parseABITypeToZod('tuple', [
        { name: 'recipient', type: 'address' },
        {
          name: 'details',
          type: 'tuple',
          components: [
            { name: 'amount', type: 'uint256' },
            { name: 'active', type: 'bool' },
          ],
        },
      ])

      const validTuple = [
        '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
        ['1000000', true],
      ]
      const result = tupleSchema.safeParse(validTuple)
      expect(result.success).toBe(true)
    })

    it('should parse tuple arrays: (address,uint256)[]', () => {
      const tupleArraySchema = parseABITypeToZod('tuple[]', [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ])

      const validArray = [
        ['0x742d35cc6634c0532925a3b844bc9e7595f0beb0', '1000000'],
        ['0x1234567890123456789012345678901234567890', '2000000'],
      ]
      const result = tupleArraySchema.safeParse(validArray)
      expect(result.success).toBe(true)
    })
  })

  describe('9. parseABITypeToZod Function', () => {
    it('should parse "uint256" to uint validator', () => {
      const schema = parseABITypeToZod('uint256')
      const result = schema.safeParse('1234567890')
      expect(result.success).toBe(true)
    })

    it('should parse "address[]" to array of address validators', () => {
      const schema = parseABITypeToZod('address[]')
      const valid = [
        '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
        '0x1234567890123456789012345678901234567890',
      ]
      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should parse "bytes32" to fixed bytes validator', () => {
      const schema = parseABITypeToZod('bytes32')
      const valid = '0x' + 'a'.repeat(64)
      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should parse "tuple" with components to tuple validator', () => {
      const schema = parseABITypeToZod('tuple', [
        { name: 'value', type: 'uint256' },
      ])
      const result = schema.safeParse(['100'])
      expect(result.success).toBe(true)
    })

    it('should throw for unsupported types', () => {
      expect(() => {
        parseABITypeToZod('unsupportedType')
      }).toThrow('Unsupported ABI type: unsupportedType')
    })

    it('should parse fixed-size arrays: uint256[3]', () => {
      const schema = parseABITypeToZod('uint256[3]')
      const valid = ['1', '2', '3']
      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)

      const invalid = ['1', '2'] // Wrong length
      const invalidResult = schema.safeParse(invalid)
      expect(invalidResult.success).toBe(false)
    })

    it('should parse nested arrays: uint256[][]', () => {
      const schema = parseABITypeToZod('uint256[][]')
      const valid = [['1', '2'], ['3', '4']]
      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('10. Helper Functions', () => {
    describe('getNumericRange', () => {
      it('should return correct min/max for uint256', () => {
        const range = getNumericRange('uint256')
        expect(range).not.toBeNull()
        if (range) {
          expect(range.min).toBe('0')
          expect(range.max).toBe(
            (BigInt(2) ** BigInt(256) - BigInt(1)).toString()
          )
        }
      })

      it('should return correct min/max for int256', () => {
        const range = getNumericRange('int256')
        expect(range).not.toBeNull()
        if (range) {
          const twoTo255 = BigInt(2) ** BigInt(255)
          expect(range.min).toBe((-twoTo255).toString())
          expect(range.max).toBe((twoTo255 - BigInt(1)).toString())
        }
      })

      it('should return null for non-numeric types', () => {
        const range = getNumericRange('address')
        expect(range).toBeNull()
      })
    })

    describe('getExpectedBytesLength', () => {
      it('should return 66 for bytes32', () => {
        const length = getExpectedBytesLength('bytes32')
        expect(length).toBe(66) // 0x + 64 hex chars
      })

      it('should return 10 for bytes4', () => {
        const length = getExpectedBytesLength('bytes4')
        expect(length).toBe(10) // 0x + 8 hex chars
      })

      it('should return null for dynamic bytes', () => {
        const length = getExpectedBytesLength('bytes')
        expect(length).toBeNull()
      })

      it('should return null for non-bytes types', () => {
        const length = getExpectedBytesLength('uint256')
        expect(length).toBeNull()
      })
    })

    describe('isValidAddress type guard', () => {
      it('should return true for valid address', () => {
        const valid = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0'
        expect(isValidAddress(valid)).toBe(true)
      })

      it('should return false for invalid address', () => {
        const invalid = '0xinvalid'
        expect(isValidAddress(invalid)).toBe(false)
      })

      it('should return false for non-string', () => {
        expect(isValidAddress(123)).toBe(false)
        expect(isValidAddress(null)).toBe(false)
      })
    })

    describe('isValidHex type guard', () => {
      it('should return true for valid hex string', () => {
        const valid = '0x1234abcd'
        expect(isValidHex(valid)).toBe(true)
      })

      it('should return true for empty hex', () => {
        expect(isValidHex('0x')).toBe(true)
      })

      it('should return false for odd length', () => {
        expect(isValidHex('0x123')).toBe(false)
      })

      it('should return false for missing prefix', () => {
        expect(isValidHex('1234abcd')).toBe(false)
      })

      it('should return false for non-hex characters', () => {
        expect(isValidHex('0x123g')).toBe(false)
      })

      it('should return false for non-string', () => {
        expect(isValidHex(123)).toBe(false)
      })
    })

    describe('validateAddress', () => {
      it('should return normalized lowercase address for valid input', () => {
        const mixedCase =
          '0x742D35CC6634c0532925A3b844BC9E7595F0BEb0' as const
        const result = validateAddress(mixedCase)
        expect(result).toBe(mixedCase.toLowerCase())
        expect(isAddress(result, { strict: false })).toBe(true)
      })

      it('should throw on invalid address', () => {
        const invalid = '0xinvalid'
        expect(() => validateAddress(invalid)).toThrow('Invalid address')
      })
    })

    describe('isValidUint256', () => {
      it('should return true for valid uint256', () => {
        expect(isValidUint256('0')).toBe(true)
        expect(isValidUint256('1234567890')).toBe(true)
        const max = (BigInt(2) ** BigInt(256) - BigInt(1)).toString()
        expect(isValidUint256(max)).toBe(true)
      })

      it('should return false for negative', () => {
        expect(isValidUint256('-1')).toBe(false)
      })

      it('should return false for overflow', () => {
        const overflow = (BigInt(2) ** BigInt(256)).toString()
        expect(isValidUint256(overflow)).toBe(false)
      })

      it('should return false for invalid string', () => {
        expect(isValidUint256('abc')).toBe(false)
      })
    })

    describe('isValidInt256', () => {
      it('should return true for valid int256', () => {
        expect(isValidInt256('0')).toBe(true)
        expect(isValidInt256('-1234567890')).toBe(true)
        const twoTo255 = BigInt(2) ** BigInt(255)
        const max = (twoTo255 - BigInt(1)).toString()
        expect(isValidInt256(max)).toBe(true)
        const min = (-twoTo255).toString()
        expect(isValidInt256(min)).toBe(true)
      })

      it('should return false for overflow', () => {
        const twoTo255 = BigInt(2) ** BigInt(255)
        const overflow = twoTo255.toString()
        expect(isValidInt256(overflow)).toBe(false)
      })

      it('should return false for underflow', () => {
        const twoTo255 = BigInt(2) ** BigInt(255)
        const underflow = (-twoTo255 - BigInt(1)).toString()
        expect(isValidInt256(underflow)).toBe(false)
      })
    })
  })
})
