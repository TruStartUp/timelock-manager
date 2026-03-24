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
  operation: ExplainableOperation
) => ['operation-explanation', chainId ?? 'unknown', operation.fullId] as const

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
      decoded?.functionName ?? functionNameFromSignature(call.signature)
    const signature = decoded?.signature ?? call.signature ?? 'unknown'

    if (!functionName || signature === 'unknown') {
      return null
    }

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

  if (payloadCalls.some((call) => call === null)) {
    return null
  }

  return {
    chainId,
    operationId: operation.fullId,
    calls: payloadCalls,
  }
}

export const fetchOperationExplanation = async (
  payload: ExplainOperationPayload
): Promise<OperationExplanation> => {
  const res = await fetch('/api/explain_operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }

  const data = (await res.json()) as OperationExplanation
  return {
    summary: data.summary || 'Explanation generated.',
    perCall: data.perCall,
  }
}
