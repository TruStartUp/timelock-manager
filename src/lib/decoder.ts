/**
 * Calldata decoding utility
 *
 * Implements User Story 5 decoding requirements:
 * - Decode calldata using a resolved ABI (preferred)
 * - Fallback to 4byte directory best-guess when ABI isn't available
 * - Recursively decode TimelockController execute/executeBatch inner payloads
 *
 * Note: This module is UI-agnostic. It does not use wagmi hooks.
 */

import {
  decodeFunctionData,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import {
  getBestGuessSignature,
  FourByteError,
} from '@/services/fourbyte/client'
import {
  getContractABI,
  type ABIResolution,
  ABISource,
  ABIConfidence,
} from '@/services/blockscout/abi'
import { type BlockscoutNetwork } from '@/services/blockscout/client'

export type DecodedParam = {
  name: string
  type: string
  value: unknown
}

export type DecoderWarning =
  | { kind: 'TRUNCATED_RECURSION'; message: string }
  | { kind: 'ABI_MISSING'; message: string }
  | { kind: 'ABI_GUESS'; message: string }
  | { kind: 'DECODE_FAILED'; message: string }

export type DecodedCall = {
  target?: Address
  selector: Hex
  functionName: string
  signature: string
  params: DecodedParam[]
  source: ABISource
  confidence: ABIConfidence
  warnings: DecoderWarning[]
  children: DecodedCall[]
}

export type DecodeCalldataParams = {
  calldata: Hex

  /**
   * Optional address of the contract the calldata is intended for.
   * Used for ABI lookup and recursive inner call decoding.
   */
  target?: Address

  /**
   * ABI to use for decoding the calldata. If omitted, the decoder will try
   * to resolve it (when target+network+publicClient are provided) and then
   * fall back to 4byte directory.
   */
  abi?: Abi

  /**
   * If you provide `abi`, you can also provide the source/confidence metadata
   * so the UI can render the correct badge (e.g. ABI came from Blockscout).
   *
   * If omitted and `abi` is provided, defaults to MANUAL/HIGH.
   */
  abiSource?: ABISource
  abiConfidence?: ABIConfidence

  /**
   * Optional ABI resolution context (required for auto-fetching ABIs).
   * This is mainly used for recursive decoding where each inner target
   * may require a distinct ABI.
   */
  network?: BlockscoutNetwork
  publicClient?: PublicClient

  /**
   * Optional ABI overrides by address (useful for tests or preloaded ABIs).
   */
  abiByAddress?: Record<string, Abi>

  /**
   * Recursion controls for timelock decoding.
   */
  maxDepth?: number
  maxNodes?: number
}

export class CalldataDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalldataDecodeError'
  }
}

function isHexCalldata(value: string): value is Hex {
  return /^0x[0-9a-fA-F]*$/.test(value)
}

function normalizeAddrKey(addr: Address): string {
  return addr.toLowerCase()
}

function extractSelector(calldata: Hex): Hex {
  // 0x + 8 hex chars = 10 length
  if (calldata.length < 10) {
    throw new CalldataDecodeError(
      `Calldata too short: expected at least 4 bytes selector (got ${calldata.length} chars)`
    )
  }
  return calldata.slice(0, 10) as Hex
}

function isTimelockFunction(fn: string): fn is 'execute' | 'executeBatch' {
  return fn === 'execute' || fn === 'executeBatch'
}

function findFunctionAbiItem(
  abi: Abi,
  functionName: string
): { inputs?: Array<{ name?: string; type?: string }>; name: string } | null {
  const items = (abi as any[]).filter(
    (x) => x && x.type === 'function' && x.name === functionName
  )
  if (items.length === 0) return null
  return items[0] as any
}

function formatSignatureFromAbiItem(
  abiItem: { name: string; inputs?: Array<{ name?: string; type?: string }> } | null
): string {
  if (!abiItem) return ''
  const inputs = abiItem.inputs ?? []
  const sigInputs = inputs
    .map((i, idx) => {
      const type = i?.type || 'unknown'
      const name = i?.name ? ` ${i.name}` : ` param${idx}`
      return `${type}${name}`
    })
    .join(',')
  return `${abiItem.name}(${sigInputs})`
}

function paramsFromDecodedArgs(params: {
  abiItem: { inputs?: Array<{ name?: string; type?: string }> } | null
  args: readonly unknown[]
}): DecodedParam[] {
  const inputs = params.abiItem?.inputs ?? []
  return params.args.map((value, idx) => {
    const input = inputs[idx]
    return {
      name: input?.name || `param${idx}`,
      type: input?.type || 'unknown',
      value,
    }
  })
}

async function resolveAbiForAddress(params: {
  target: Address
  network?: BlockscoutNetwork
  publicClient?: PublicClient
  abiByAddress?: Record<string, Abi>
}): Promise<ABIResolution | null> {
  const { target, network, publicClient, abiByAddress } = params

  const override = abiByAddress?.[normalizeAddrKey(target)]
  if (override) {
    return {
      abi: override as unknown[],
      source: ABISource.KNOWN_REGISTRY,
      confidence: ABIConfidence.HIGH,
      isProxy: false,
    }
  }

  if (!network || !publicClient) return null

  try {
    return await getContractABI(target, network, publicClient)
  } catch (err) {
    return {
      abi: [],
      source: ABISource.BLOCKSCOUT,
      confidence: ABIConfidence.LOW,
      isProxy: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function decodeCalldata(
  params: DecodeCalldataParams
): Promise<DecodedCall> {
  const {
    calldata,
    target,
    abi,
    abiSource,
    abiConfidence,
    network,
    publicClient,
    abiByAddress,
    maxDepth = 5,
    maxNodes = 50,
  } = params

  if (typeof calldata !== 'string' || !isHexCalldata(calldata)) {
    throw new CalldataDecodeError('Calldata must be a 0x-prefixed hex string')
  }

  const selector = extractSelector(calldata)

  if (maxNodes <= 0) {
    return {
      target,
      selector,
      functionName: 'unknown',
      signature: '',
      params: [],
      source: ABISource.FOURBYTE,
      confidence: ABIConfidence.LOW,
      warnings: [
        {
          kind: 'TRUNCATED_RECURSION',
          message: 'Decoder stopped due to node limit.',
        },
      ],
      children: [],
    }
  }

  // Prefer explicitly provided ABI first, otherwise resolve by address.
  let resolvedAbi: Abi | null = (abi as Abi | undefined) ?? null
  let resolvedMeta: Pick<DecodedCall, 'source' | 'confidence'> | null =
    resolvedAbi && resolvedAbi.length > 0
      ? {
          source: abiSource ?? ABISource.MANUAL,
          confidence: abiConfidence ?? ABIConfidence.HIGH,
        }
      : null
  const warnings: DecoderWarning[] = []

  if (!resolvedAbi && target) {
    const resolution = await resolveAbiForAddress({
      target,
      network,
      publicClient,
      abiByAddress,
    })
    if (resolution && resolution.abi && resolution.abi.length > 0) {
      resolvedAbi = resolution.abi as Abi
      resolvedMeta = {
        source: resolution.source,
        confidence: resolution.confidence,
      }
    } else {
      warnings.push({
        kind: 'ABI_MISSING',
        message:
          resolution?.error ||
          'No ABI available for this contract address; falling back to 4byte directory when possible.',
      })
    }
  }

  // Attempt decode via ABI if present.
  if (resolvedAbi && resolvedAbi.length > 0) {
    try {
      const decoded = decodeFunctionData({
        abi: resolvedAbi,
        data: calldata,
      })

      const functionName = decoded.functionName as string
      const args = (decoded.args ?? []) as readonly unknown[]
      const abiItem = findFunctionAbiItem(resolvedAbi, functionName)
      const signature =
        formatSignatureFromAbiItem(abiItem) || `${functionName}(...)`

      const node: DecodedCall = {
        target,
        selector,
        functionName,
        signature,
        params: paramsFromDecodedArgs({ abiItem, args }),
        source: resolvedMeta?.source ?? ABISource.BLOCKSCOUT,
        confidence: resolvedMeta?.confidence ?? ABIConfidence.HIGH,
        warnings,
        children: [],
      }

      if (maxDepth <= 0 || !isTimelockFunction(functionName)) {
        return node
      }

      // TimelockController recursion (execute / executeBatch)
      if (functionName === 'execute') {
        const [innerTarget, _value, payload] = args as [
          Address,
          bigint,
          Hex,
          Hex,
          Hex,
        ]

        node.children = [
          await decodeCalldata({
            calldata: payload,
            target: innerTarget,
            network,
            publicClient,
            abiByAddress,
            maxDepth: maxDepth - 1,
            maxNodes: maxNodes - 1,
          }),
        ]
      } else if (functionName === 'executeBatch') {
        const [targets, _values, payloads] = args as [
          Address[],
          bigint[],
          Hex[],
          Hex,
          Hex,
        ]

        const limit = Math.min(targets.length, payloads.length, 50)
        if (targets.length !== payloads.length) {
          node.warnings = [
            ...node.warnings,
            {
              kind: 'DECODE_FAILED',
              message:
                'executeBatch decoded with mismatched targets/payloads lengths; some inner calls may be missing.',
            },
          ]
        }

        const remainingBudget = maxNodes - 1
        const perChildBudget =
          limit > 0 ? Math.max(1, Math.floor(remainingBudget / limit)) : 0

        node.children = await Promise.all(
          targets.slice(0, limit).map((t, i) =>
            decodeCalldata({
              calldata: payloads[i],
              target: t,
              network,
              publicClient,
              abiByAddress,
              maxDepth: maxDepth - 1,
              maxNodes: perChildBudget,
            })
          )
        )

        if (targets.length > limit) {
          node.warnings = [
            ...node.warnings,
            {
              kind: 'TRUNCATED_RECURSION',
              message: `executeBatch truncated to first ${limit} calls for safety.`,
            },
          ]
        }
      }

      return node
    } catch (err) {
      warnings.push({
        kind: 'DECODE_FAILED',
        message: err instanceof Error ? err.message : String(err),
      })
      // fall through to 4byte
    }
  }

  // Fallback: 4byte best-guess
  try {
    const best = await getBestGuessSignature(calldata)
    if (!best) {
      return {
        target,
        selector,
        functionName: 'unknown',
        signature: '',
        params: [],
        source: ABISource.FOURBYTE,
        confidence: ABIConfidence.LOW,
        warnings: [
          ...warnings,
          {
            kind: 'DECODE_FAILED',
            message: 'No ABI and no 4byte match available.',
          },
        ],
        children: [],
      }
    }

    const guessAbi: Abi = [best.abi as any]
    const decoded = decodeFunctionData({ abi: guessAbi, data: calldata })
    const functionName = decoded.functionName as string
    const args = (decoded.args ?? []) as readonly unknown[]
    const abiItem = findFunctionAbiItem(guessAbi, functionName)
    const signature =
      formatSignatureFromAbiItem(abiItem) ||
      best.signature ||
      `${functionName}(...)`

    const extraWarnings: DecoderWarning[] = [
      ...warnings,
      {
        kind: 'ABI_GUESS',
        message:
          best.hasCollision
            ? 'Decoded using 4byte best-guess; multiple signatures share this selector.'
            : 'Decoded using 4byte best-guess signature.',
      },
    ]

    return {
      target,
      selector,
      functionName,
      signature,
      params: paramsFromDecodedArgs({ abiItem, args }),
      source: ABISource.FOURBYTE,
      confidence: ABIConfidence.LOW,
      warnings: extraWarnings,
      children: [],
    }
  } catch (err) {
    const msg =
      err instanceof FourByteError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err)
    return {
      target,
      selector,
      functionName: 'unknown',
      signature: '',
      params: [],
      source: ABISource.FOURBYTE,
      confidence: ABIConfidence.LOW,
      warnings: [
        ...warnings,
        {
          kind: 'DECODE_FAILED',
          message: msg,
        },
      ],
      children: [],
    }
  }
}


