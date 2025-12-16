/**
 * Zod Validation Schemas for Solidity Types
 *
 * Provides runtime validation for all Solidity types to ensure type safety
 * when building dynamic forms and encoding contract calls.
 *
 * @see research.md Section 4 - ABI-Driven Dynamic Form Generation
 */

import { z } from 'zod'
import { isAddress } from 'viem'

/**
 * Rootstock-friendly address normalization.
 * - Trims whitespace
 * - Strips wrapping quotes (common when copy/pasting)
 * - Normalizes 0X -> 0x
 * - Lowercases (Rootstock addresses are often not checksummed)
 */
export function normalizeAddressLoose(value: string): `0x${string}` {
  const trimmed = value.trim().replace(/^["']|["']$/g, '')
  const normalized = trimmed.replace(/^0X/, '0x').toLowerCase()
  return normalized as `0x${string}`
}

/**
 * Zod validators for Solidity primitive and complex types
 */
export const solidityValidators = {
  /**
   * Address validator (Rootstock-friendly; non-checksum-strict)
   * Ensures valid 0x-prefixed 20-byte hex address and normalizes to lowercase.
   */
  address: z
    .string()
    .transform((val) => normalizeAddressLoose(val))
    .refine((val) => isAddress(val, { strict: false }), {
      message: 'Invalid Ethereum address format',
    })
    .transform((val) => normalizeAddressLoose(val)),

  /**
   * Unsigned integer validator with configurable bit size
   * @param bits - Size in bits (8, 16, 32, 64, 128, 256)
   * @returns Zod schema for uint{bits}
   */
  uint: (bits: number = 256) => {
    const max = BigInt(2 ** bits) - BigInt(1)
    return z.string().refine(
      (val) => {
        try {
          const n = BigInt(val)
          return n >= BigInt(0) && n <= max
        } catch {
          return false
        }
      },
      {
        message: `Must be a valid uint${bits} (0 to ${max.toString()})`,
      }
    )
  },

  /**
   * Signed integer validator with configurable bit size
   * @param bits - Size in bits (8, 16, 32, 64, 128, 256)
   * @returns Zod schema for int{bits}
   */
  int: (bits: number = 256) => {
    const max = BigInt(2 ** (bits - 1)) - BigInt(1)
    const min = -BigInt(2 ** (bits - 1))
    return z.string().refine(
      (val) => {
        try {
          const n = BigInt(val)
          return n >= min && n <= max
        } catch {
          return false
        }
      },
      {
        message: `Must be a valid int${bits} (${min.toString()} to ${max.toString()})`,
      }
    )
  },

  /**
   * Dynamic bytes validator (variable-length hex string)
   * Accepts hex strings starting with 0x with even length
   */
  bytes: z
    .string()
    .refine(
      (val) => /^0x[0-9a-fA-F]*$/.test(val) && val.length % 2 === 0,
      {
        message: 'Must be a valid hex string (0x...) with even length',
      }
    ),

  /**
   * Fixed-size bytes validator
   * @param size - Number of bytes (1-32)
   * @returns Zod schema for bytes{size}
   */
  bytesFixed: (size: number) =>
    z.string().refine(
      (val) =>
        /^0x[0-9a-fA-F]*$/.test(val) && val.length === 2 + size * 2,
      {
        message: `Must be a ${size}-byte hex string (${2 + size * 2} characters including 0x prefix)`,
      }
    ),

  /**
   * UTF-8 string validator
   */
  string: z.string().min(0),

  /**
   * Boolean validator
   */
  bool: z.boolean(),

  /**
   * Array validator (generic)
   * @param elementSchema - Zod schema for array elements
   * @returns Zod schema for dynamic array
   */
  array: (elementSchema: z.ZodTypeAny) => z.array(elementSchema),

  /**
   * Tuple validator (struct)
   * @param components - Array of Zod schemas for tuple components
   * @returns Zod schema for tuple
   */
  tuple: (components: z.ZodTypeAny[]) => z.tuple(components as any),
}

/**
 * ABI input component interface
 */
interface ABIComponent {
  name: string
  type: string
  components?: ABIComponent[]
  internalType?: string
}

/**
 * Parse ABI type string into Zod schema
 *
 * Handles all Solidity types including:
 * - Primitive types (address, uint*, int*, bytes*, string, bool)
 * - Fixed and dynamic arrays (T[], T[N])
 * - Tuples/structs (tuple)
 *
 * @param type - Solidity type string from ABI (e.g., "uint256", "address[]", "bytes32")
 * @param components - For tuple types, the array of component definitions
 * @returns Zod schema that validates the type
 * @throws Error if type is unsupported
 *
 * @example
 * ```ts
 * const uint256Schema = parseABITypeToZod("uint256")
 * const addressArraySchema = parseABITypeToZod("address[]")
 * const tupleSchema = parseABITypeToZod("tuple", [
 *   { name: "amount", type: "uint256" },
 *   { name: "recipient", type: "address" }
 * ])
 * ```
 */
export function parseABITypeToZod(
  type: string,
  components?: ABIComponent[]
): z.ZodTypeAny {
  // Handle arrays: uint256[], address[3], etc.
  const arrayMatch = type.match(/^(.+?)\[(\d*)\]$/)
  if (arrayMatch) {
    const [, baseType, size] = arrayMatch
    const elementSchema = parseABITypeToZod(baseType, components)

    if (size) {
      // Fixed-size array: address[3]
      return z.array(elementSchema).length(parseInt(size, 10), {
        message: `Array must have exactly ${size} elements`,
      })
    } else {
      // Dynamic array: uint256[]
      return z.array(elementSchema).min(0)
    }
  }

  // Handle tuple (struct)
  if (type === 'tuple' && components) {
    const schemas = components.map((comp) =>
      parseABITypeToZod(comp.type, comp.components)
    )
    return solidityValidators.tuple(schemas)
  }

  // Handle uint variants (uint8, uint16, ..., uint256)
  if (type.startsWith('uint')) {
    const bits = parseInt(type.slice(4), 10) || 256
    return solidityValidators.uint(bits)
  }

  // Handle int variants (int8, int16, ..., int256)
  if (type.startsWith('int')) {
    const bits = parseInt(type.slice(3), 10) || 256
    return solidityValidators.int(bits)
  }

  // Handle bytes variants (bytes1, bytes2, ..., bytes32, bytes)
  if (type.startsWith('bytes')) {
    const sizeStr = type.slice(5)
    if (sizeStr) {
      const size = parseInt(sizeStr, 10)
      return solidityValidators.bytesFixed(size)
    }
    return solidityValidators.bytes
  }

  // Handle primitive types
  switch (type) {
    case 'address':
      return solidityValidators.address
    case 'string':
      return solidityValidators.string
    case 'bool':
      return solidityValidators.bool
    default:
      throw new Error(`Unsupported ABI type: ${type}`)
  }
}

/**
 * Helper to get human-readable range description for numeric types
 * Used for form field placeholders and validation messages
 *
 * @param type - Solidity type string
 * @returns Object with min and max values as strings
 */
export function getNumericRange(type: string): {
  min: string
  max: string
} | null {
  // uint variants
  if (type.startsWith('uint')) {
    const bits = parseInt(type.slice(4), 10) || 256
    const max = BigInt(2 ** bits) - BigInt(1)
    return {
      min: '0',
      max: max.toString(),
    }
  }

  // int variants
  if (type.startsWith('int')) {
    const bits = parseInt(type.slice(3), 10) || 256
    const max = BigInt(2 ** (bits - 1)) - BigInt(1)
    const min = -BigInt(2 ** (bits - 1))
    return {
      min: min.toString(),
      max: max.toString(),
    }
  }

  return null
}

/**
 * Helper to get expected byte length for bytesN types
 * Used for form field validation and placeholders
 *
 * @param type - Solidity type string
 * @returns Expected string length (including 0x prefix) or null if not a fixed bytes type
 */
export function getExpectedBytesLength(type: string): number | null {
  if (type.startsWith('bytes') && type !== 'bytes') {
    const size = parseInt(type.slice(5), 10)
    if (!isNaN(size)) {
      return 2 + size * 2 // "0x" + 2 hex chars per byte
    }
  }
  return null
}

/**
 * Type guard to check if a value is a valid Ethereum address
 *
 * @param value - Value to check
 * @returns True if value is a valid address string
 */
export function isValidAddress(value: unknown): value is `0x${string}` {
  return (
    typeof value === 'string' &&
    isAddress(normalizeAddressLoose(value), { strict: false })
  )
}

/**
 * Type guard to check if a value is a valid hex string
 *
 * @param value - Value to check
 * @returns True if value is a valid hex string
 */
export function isValidHex(value: unknown): value is `0x${string}` {
  return (
    typeof value === 'string' &&
    /^0x[0-9a-fA-F]*$/.test(value) &&
    value.length % 2 === 0
  )
}

/**
 * Validate and normalize an address input
 * Throws if invalid, returns checksummed address if valid
 *
 * @param address - Address string to validate
 * @returns Checksummed address
 * @throws Error if address is invalid
 */
export function validateAddress(address: string): `0x${string}` {
  const normalized = normalizeAddressLoose(address)
  if (!isAddress(normalized, { strict: false })) {
    throw new Error(`Invalid address: ${address}`)
  }
  return normalized
}

/**
 * Validate a BigInt string is within uint256 range
 *
 * @param value - String representation of number
 * @returns True if valid uint256
 */
export function isValidUint256(value: string): boolean {
  try {
    const n = BigInt(value)
    const max = BigInt(2 ** 256) - BigInt(1)
    return n >= BigInt(0) && n <= max
  } catch {
    return false
  }
}

/**
 * Validate a BigInt string is within int256 range
 *
 * @param value - String representation of number
 * @returns True if valid int256
 */
export function isValidInt256(value: string): boolean {
  try {
    const n = BigInt(value)
    const max = BigInt(2 ** 255) - BigInt(1)
    const min = -BigInt(2 ** 255)
    return n >= min && n <= max
  } catch {
    return false
  }
}

/**
 * Zod schema for a single TimelockConfiguration object.
 *
 * @see data-model.md
 */
export const timelockConfigurationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Timelock name cannot be empty'),
  address: solidityValidators.address, // Reusing the existing address validator
  network: z.union([z.literal('rsk_mainnet'), z.literal('rsk_testnet')]),
  subgraphUrl: z.string().url('Invalid URL format for subgraph'),
});

/**
 * Zod schema for an array of TimelockConfiguration objects.
 * Used for validating data loaded from localStorage.
 */
export const timelockConfigurationsArraySchema = z.array(timelockConfigurationSchema);
