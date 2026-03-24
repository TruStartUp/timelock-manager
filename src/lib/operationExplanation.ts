import { type DecodedCall } from '@/lib/decoder'

type ExplainCallParam = {
  name: string
  type: string
  value: string
  display?: string
  notes?: string
}

type ExplainCallInput = {
  index: number
  target: string
  nativeValue: string
  signature: string
  functionName: string | null
  params: ExplainCallParam[]
}

export type OperationExplanation = {
  summary: string
  perCall?: string[]
  cacheHit?: boolean
  fingerprint?: string
  generatedAt?: string
}

export type ExplainOperationPayload = {
  chainId?: number
  operationId?: string | null
  calls: ExplainCallInput[]
}

export type ExplainableOperation = {
  fullId: `0x${string}`
  details?: {
    callsDetails: Array<{
      target: string
      value: string
      rawValue: bigint
      data?: `0x${string}` | null
      signature?: string | null
    }>
  }
}

export type HumanAmountByIndex = Record<
  number,
  | {
      paramIndex: number
      formatted: string
      raw: string
      symbol: string | null
      decimals: number
    }
  | undefined
>

type ExplanationContext = {
  decodedByIndex?: Record<number, { decoded?: DecodedCall; error?: string }>
  humanAmountByIndex?: HumanAmountByIndex
}

const EXPLAIN_PROMPT_VERSION = 'v2'
const EXPLANATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const explanationCache = new Map<
  string,
  { expiresAt: number; value: OperationExplanation }
>()
const inFlightExplanation = new Map<string, Promise<OperationExplanation>>()

const stringifyValue = (value: unknown): string => {
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(
      value,
      (_key, currentValue) =>
        typeof currentValue === 'bigint'
          ? currentValue.toString()
          : currentValue
    )
  } catch {
    return String(value)
  }
}

const functionNameFromSignature = (signature?: string | null): string | null => {
  if (!signature || signature === 'unknown') return null
  const [name] = signature.split('(')
  return name || null
}

const getCallDescription = (call: {
  target: string
  value: string
  rawValue: bigint
  data?: `0x${string}` | null
}) => {
  const hasFunds = call.rawValue > BigInt(0)
  const fundsText = hasFunds ? `with ${call.value}` : 'with no funds'
  const hasCalldata = !!call.data && call.data !== '0x'
  const paramsText = hasCalldata ? 'using attached calldata' : 'with no parameters'

  return { fundsText, paramsText }
}

export const getOperationExplanationQueryKey = (
  chainId: number | undefined,
  operation: ExplainableOperation,
  fingerprint: string | null
) =>
  [
    'operation-explanation',
    chainId ?? 'unknown',
    operation.fullId,
    fingerprint ?? 'no-fingerprint',
  ] as const

const hashDjb2 = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const buildExplanationFingerprint = (
  payload: ExplainOperationPayload
): string => {
  const normalizedCalls = payload.calls.map((call) => ({
    index: call.index,
    target: call.target.toLowerCase(),
    nativeValue: call.nativeValue,
    signature: call.signature || 'unknown',
    functionName: call.functionName ?? 'unknown',
    params: call.params.map((param) => ({
      name: param.name,
      type: param.type,
      value: param.value,
      display: param.display ?? null,
    })),
  }))

  const serialized = JSON.stringify({
    chainId: payload.chainId ?? null,
    operationId: payload.operationId ?? null,
    promptVersion: EXPLAIN_PROMPT_VERSION,
    calls: normalizedCalls,
  })

  return `opx-${hashDjb2(serialized)}`
}

export const buildUnknownOperationExplanation = (
  operation: ExplainableOperation,
  options?: { includeSourceOfTruthNote?: boolean }
): OperationExplanation => {
  const calls = operation.details?.callsDetails ?? []
  const includeSourceOfTruthNote = options?.includeSourceOfTruthNote ?? true

  if (calls.length === 0) {
    return {
      summary:
        'This operation could not be explained automatically because no call data was available for review.',
    }
  }

  if (calls.length === 1) {
    const [call] = calls
    const { fundsText, paramsText } = getCallDescription(call)
    const sourceOfTruth = includeSourceOfTruthNote
      ? ' Review Developer Details before executing.'
      : ''

    return {
      summary: `This timelock will try to call the contract at ${call.target} ${paramsText} and ${fundsText}. The exact effect could not be determined automatically because the function could not be decoded.${sourceOfTruth}`,
      perCall: [
        `It will call ${call.target} ${paramsText} and ${fundsText}, but the exact behavior is unknown because the function could not be decoded.`,
      ],
    }
  }

  return {
    summary: `This timelock will try to execute ${calls.length} contract calls, but at least one call could not be decoded automatically. Review Developer Details before executing.`,
    perCall: calls.map((call) => {
      const { fundsText, paramsText } = getCallDescription(call)
      return `It will call ${call.target} ${paramsText} and ${fundsText}, but the exact behavior could not be decoded automatically.`
    }),
  }
}

export const buildExplainOperationPayload = (
  operation: ExplainableOperation,
  chainId?: number,
  context: ExplanationContext = {}
): ExplainOperationPayload | null => {
  const { decodedByIndex = {}, humanAmountByIndex = {} } = context
  const calls = operation.details?.callsDetails ?? []

  const payloadCalls = calls.map((call, index) => {
    const decoded = decodedByIndex[index]?.decoded
    const humanAmount = humanAmountByIndex[index]
    const functionName =
      decoded?.functionName ?? functionNameFromSignature(call.signature) ?? null
    const signature = decoded?.signature ?? call.signature ?? 'unknown'

    const params = decoded?.params?.map((param, paramIndex) => ({
      name: param.name,
      type: param.type,
      value: stringifyValue(param.value),
      display:
        humanAmount && humanAmount.paramIndex === paramIndex
          ? humanAmount.formatted
          : undefined,
      notes:
        humanAmount && humanAmount.paramIndex === paramIndex
          ? 'display is the human-formatted token amount (decimals applied); value is the raw on-chain/base-unit amount.'
          : undefined,
    }))

    return {
      index,
      target: call.target,
      nativeValue: call.value,
      signature,
      functionName,
      params:
        params && params.length > 0
          ? params
          : call.rawValue > BigInt(0)
            ? [
                {
                  name: 'nativeValue',
                  type: 'rbtc',
                  value: stringifyValue(call.rawValue.toString()),
                  display: call.value,
                },
              ]
            : [],
    }
  })

  if (payloadCalls.length === 0) return null

  return {
    chainId,
    operationId: operation.fullId,
    calls: payloadCalls.filter(Boolean) as ExplainCallInput[],
  }
}

export const fetchOperationExplanation = async (
  payload: ExplainOperationPayload,
  fingerprint?: string,
  signal?: AbortSignal
): Promise<OperationExplanation> => {
  const requestFingerprint = fingerprint ?? buildExplanationFingerprint(payload)
  const now = Date.now()
  const cached = explanationCache.get(requestFingerprint)
  if (cached && cached.expiresAt > now) {
    return {
      ...cached.value,
      cacheHit: true,
      fingerprint: requestFingerprint,
    }
  }

  const inFlight = inFlightExplanation.get(requestFingerprint)
  if (inFlight) return inFlight

  const request = (async () => {
    const res = await fetch('/api/explain_operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ ...payload, fingerprint: requestFingerprint }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed (${res.status})`)
    }

    const data = (await res.json()) as OperationExplanation
    const normalized = {
      summary: data.summary || 'Explanation generated.',
      perCall: data.perCall,
      cacheHit: data.cacheHit ?? false,
      fingerprint: data.fingerprint ?? requestFingerprint,
      generatedAt: data.generatedAt,
    }
    explanationCache.set(requestFingerprint, {
      expiresAt: Date.now() + EXPLANATION_CACHE_TTL_MS,
      value: normalized,
    })
    return normalized
  })()

  inFlightExplanation.set(requestFingerprint, request)
  try {
    return await request
  } finally {
    inFlightExplanation.delete(requestFingerprint)
  }
}

export const prewarmOperationExplanation = async (args: {
  payload: ExplainOperationPayload
  fingerprint?: string
}): Promise<void> => {
  const fingerprint = args.fingerprint ?? buildExplanationFingerprint(args.payload)
  const now = Date.now()
  const cached = explanationCache.get(fingerprint)
  if (cached && cached.expiresAt > now) return
  await fetchOperationExplanation(args.payload, fingerprint)
}
