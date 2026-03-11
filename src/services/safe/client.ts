import { type Address, type Hex } from 'viem'
import { normalizeAddressLoose } from '@/lib/validation'
import type {
  SafeTransactionParams,
  SafeVerificationNetwork,
  SafeVerificationPayload,
} from '@/types/safeVerification'

const DEFAULT_SAFE_GATEWAY_BASE = 'https://gateway.safe.rootstock.io'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

const SAFE_NETWORKS: Record<
  SafeVerificationNetwork,
  { chainId: number; label: string }
> = {
  mainnet: { chainId: 30, label: 'Rootstock Mainnet' },
  testnet: { chainId: 31, label: 'Rootstock Testnet' },
}

type SafeMultisigListResponse = {
  count?: number
  results?: Array<{
    safeTxHash?: string
    transactionHash?: string | null
    transaction?: { id?: string; txHash?: string | null }
  }>
}

type SafeDetailResponse = {
  txHash?: string | null
  txData?: {
    to?: { value?: string }
    value?: string
    hexData?: string
    operation?: number | string
    dataDecoded?: unknown
  }
  detailedExecutionInfo?: {
    nonce?: number | string
    safeTxGas?: string
    baseGas?: string
    gasPrice?: string
    gasToken?: string
    refundReceiver?: { value?: string }
    safeTxHash?: string
  }
}

type SafeInfoResponse = {
  version?: string
}

function getSafeGatewayBaseUrl(network: SafeVerificationNetwork): string {
  if (typeof window !== 'undefined') return `/api/safe/${network}`

  const envValue =
    network === 'mainnet'
      ? process.env.SAFE_ROOTSTOCK_MAINNET_GATEWAY_URL
      : process.env.SAFE_ROOTSTOCK_TESTNET_GATEWAY_URL

  return envValue || DEFAULT_SAFE_GATEWAY_BASE
}

async function fetchSafeJson(
  network: SafeVerificationNetwork,
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<unknown> {
  const normalizedPath = path.replace(/^\//, '')
  const url =
    typeof window !== 'undefined'
      ? new URL(`${getSafeGatewayBaseUrl(network)}/${normalizedPath}`, window.location.origin)
      : new URL(`${getSafeGatewayBaseUrl(network)}/${normalizedPath}`)

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Safe Gateway request failed (${res.status}): ${text || res.statusText}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Safe Gateway returned non-JSON response.')
  }
}

function extractSafeTxHash(...candidates: Array<unknown>): Hex {
  const value = candidates.find(
    (candidate) =>
      typeof candidate === 'string' && /^0x[a-fA-F0-9]{64}$/.test(candidate)
  )

  if (!value || typeof value !== 'string') {
    throw new Error('Reference Safe tx hash not found in Safe Gateway response.')
  }

  return value.toLowerCase() as Hex
}

async function fetchSafeVersion(
  network: SafeVerificationNetwork,
  address: Address
): Promise<string> {
  const safeInfo = (await fetchSafeJson(
    network,
    `v1/chains/${SAFE_NETWORKS[network].chainId}/safes/${address}`
  )) as SafeInfoResponse

  return (safeInfo.version || '1.3.0').split('+')[0]
}

function normalizeTransactionParams(params: {
  safeAddress: Address
  chainId: number
  version: string
  to?: string
  value?: string
  data?: string
  operation?: string | number
  safeTxGas?: string
  baseGas?: string
  gasPrice?: string
  gasToken?: string
  refundReceiver?: string
  nonce?: string | number
}): SafeTransactionParams {
  return {
    safeAddress: normalizeAddressLoose(params.safeAddress) as Address,
    chainId: params.chainId,
    version: params.version,
    to: normalizeAddressLoose(params.to || ZERO_ADDRESS) as Address,
    value: params.value || '0',
    data: ((params.data || '0x').startsWith('0x')
      ? params.data || '0x'
      : `0x${params.data}`) as Hex,
    operation: String(params.operation || '0') === '1' ? '1' : '0',
    safeTxGas: params.safeTxGas || '0',
    baseGas: params.baseGas || '0',
    gasPrice: params.gasPrice || '0',
    gasToken: normalizeAddressLoose(params.gasToken || ZERO_ADDRESS) as Address,
    refundReceiver: normalizeAddressLoose(
      params.refundReceiver || ZERO_ADDRESS
    ) as Address,
    nonce: String(params.nonce || '0'),
  }
}

export async function fetchSafeVerificationPayload(
  network: SafeVerificationNetwork,
  safeAddress: Address,
  nonce: string
): Promise<SafeVerificationPayload> {
  const chainId = SAFE_NETWORKS[network].chainId
  const normalizedSafe = normalizeAddressLoose(safeAddress) as Address
  const txList = (await fetchSafeJson(
    network,
    `v1/chains/${chainId}/safes/${normalizedSafe}/multisig-transactions/`,
    { nonce }
  )) as SafeMultisigListResponse

  const results = Array.isArray(txList.results) ? txList.results : []
  if (results.length === 0) {
    throw new Error('No Safe transaction found for that nonce.')
  }
  if (results.length > 1) {
    throw new Error('Multiple Safe transactions were found for that nonce.')
  }

  const summary = results[0]
  const txId = summary.transaction?.id
  if (!txId) {
    throw new Error('Safe transaction id missing from gateway response.')
  }

  const [version, detail] = await Promise.all([
    fetchSafeVersion(network, normalizedSafe),
    fetchSafeJson(network, `v1/chains/${chainId}/transactions/${txId}`),
  ])

  const typedDetail = detail as SafeDetailResponse
  const txData = typedDetail.txData || {}
  const exec = typedDetail.detailedExecutionInfo || {}

  return {
    network,
    expectedSafeTxHash: extractSafeTxHash(
      exec.safeTxHash,
      summary.safeTxHash,
      typedDetail.txHash,
      summary.transactionHash,
      summary.transaction?.txHash
    ),
    transaction: normalizeTransactionParams({
      safeAddress: normalizedSafe,
      chainId,
      version,
      to: txData.to?.value,
      value: txData.value,
      data: txData.hexData,
      operation: txData.operation,
      safeTxGas: exec.safeTxGas,
      baseGas: exec.baseGas,
      gasPrice: exec.gasPrice,
      gasToken: exec.gasToken,
      refundReceiver: exec.refundReceiver?.value,
      nonce: exec.nonce ?? nonce,
    }),
  }
}

export { SAFE_NETWORKS, ZERO_ADDRESS }
