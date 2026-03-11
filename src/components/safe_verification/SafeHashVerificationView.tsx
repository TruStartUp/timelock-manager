import React, { useMemo, useState } from 'react'
import {
  type Abi,
  type Address,
  type Hex,
  isAddress,
  type PublicClient,
} from 'viem'
import { ABIConfidence, ABISource, getContractABI } from '@/services/blockscout/abi'
import { decodeCalldata } from '@/lib/decoder'
import { normalizeAddressLoose } from '@/lib/validation'
import { calculateSafeHashes } from '@/lib/safeHash'
import {
  fetchSafeVerificationPayload,
  SAFE_NETWORKS,
  ZERO_ADDRESS,
} from '@/services/safe/client'
import type {
  SafeTransactionParams,
  SafeVerificationNetwork,
  SafeVerificationResult,
} from '@/types/safeVerification'
import { usePublicClient } from 'wagmi'

type VerificationMethod = 'api' | 'manual'

type ManualFormState = {
  network: SafeVerificationNetwork
  safeAddress: string
  nonce: string
  version: string
  to: string
  value: string
  data: string
  operation: '0' | '1'
  safeTxGas: string
  baseGas: string
  gasPrice: string
  gasToken: string
  refundReceiver: string
  expectedSafeTxHash: string
}

function TooltipIcon(props: { text: string; ariaLabel: string }) {
  const { text, ariaLabel } = props
  return (
    <span className="relative inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        title={ariaLabel}
        className="group inline-flex size-4 items-center justify-center rounded-full border border-current/30 bg-black/10 text-[11px] font-bold leading-none text-current/80 outline-none hover:text-current focus-visible:ring-2 focus-visible:ring-primary/50"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        ?
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-4rem)] rounded-md border border-border-dark bg-background-dark px-3 py-2 text-xs font-medium text-text-dark-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {text}
          <span className="absolute left-4 top-0 -translate-y-full">
            <span className="block size-0 border-x-8 border-b-8 border-x-transparent border-b-border-dark" />
            <span className="relative -top-[7px] block size-0 border-x-7 border-b-7 border-x-transparent border-b-background-dark" />
          </span>
        </span>
      </span>
    </span>
  )
}

function LabelWithTooltip(props: {
  htmlFor?: string
  label: string
  tooltip: string
}) {
  const { htmlFor, label, tooltip } = props

  return (
    <div className="flex items-center gap-2">
      <label
        className="text-text-primary text-base font-medium leading-normal"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      <TooltipIcon text={tooltip} ariaLabel={`${label} help`} />
    </div>
  )
}

const DEFAULT_FORM: ManualFormState = {
  network: 'mainnet',
  safeAddress: '',
  nonce: '',
  version: '1.3.0',
  to: ZERO_ADDRESS,
  value: '0',
  data: '0x',
  operation: '0',
  safeTxGas: '0',
  baseGas: '0',
  gasPrice: '0',
  gasToken: ZERO_ADDRESS,
  refundReceiver: ZERO_ADDRESS,
  expectedSafeTxHash: '',
}

const FIELD_TOOLTIPS = {
  verificationMethod:
    'Choose where the expected SAFE transaction hash comes from. Safe API fetches the transaction and reference hash from the Safe Gateway. Manual lets you enter every transaction field yourself.',
  network:
    'Select the Rootstock network for this SAFE transaction. The selected network determines the chain ID used in the hash computation and which Safe Gateway endpoint is queried.',
  safeAddress:
    'The address of the SAFE multisig wallet that created the transaction. This address is part of the EIP-712 domain and changes the resulting Safe tx hash.',
  nonce:
    'The SAFE transaction nonce. SAFE increments this counter for each proposed transaction, and the hash changes if the nonce changes.',
  version:
    'The SAFE contract version, such as 1.3.0. The version determines which EIP-712 domain fields are used during hash computation.',
  to:
    'The target contract or recipient address that the SAFE transaction will call.',
  value:
    'The amount of native RBTC, in wei, that the SAFE transaction sends to the target address.',
  data:
    'The raw calldata sent to the target contract. Use 0x for a plain native token transfer with no function call data.',
  operation:
    'SAFE operation type. Call (0) performs a regular external call. DelegateCall (1) executes the target code in the SAFE context and should be used with extra care.',
  safeTxGas:
    'The gas limit reserved for executing the inner SAFE transaction itself. This value is part of the signed payload even if no gas reimbursement is used.',
  baseGas:
    'Additional gas overhead charged outside the inner call, such as signature checks and refund handling. This value is also included in the hash.',
  gasPrice:
    'The reimbursement gas price used by SAFE refund logic. Set this to 0 when no gas refund is configured.',
  gasToken:
    'The token address used for gas reimbursement. Use the zero address when refunds are paid in the native token or when no refund is configured.',
  refundReceiver:
    'The address that receives any gas refund. Use the zero address when the refund should go to the transaction submitter or when no refund is configured.',
  expectedSafeTxHash:
    'Optional reference SAFE transaction hash to compare against the locally computed result. Leave it blank if you only want to calculate the hash.',
} as const

function isValidBytes32(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
}

function isValidBytes(value: string): value is Hex {
  const trimmed = value.trim()
  return /^0x[a-fA-F0-9]*$/.test(trimmed) && trimmed.length % 2 === 0
}

function isIntegerString(value: string): boolean {
  try {
    return BigInt(value) >= BigInt(0)
  } catch {
    return false
  }
}

function formatDecodedValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatDecodedValue(item)).join(', ')}]`
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(
      value,
      (_, nested) => (typeof nested === 'bigint' ? nested.toString() : nested),
      2
    )
  }
  return String(value)
}

function formatAddress(value: string): Address {
  return normalizeAddressLoose(value) as Address
}

function buildManualTransaction(form: ManualFormState): SafeTransactionParams {
  if (!isAddress(formatAddress(form.safeAddress), { strict: false })) {
    throw new Error('Safe address must be a valid Rootstock address.')
  }
  if (!isAddress(formatAddress(form.to), { strict: false })) {
    throw new Error('Target address must be a valid Rootstock address.')
  }
  if (!isAddress(formatAddress(form.gasToken), { strict: false })) {
    throw new Error('Gas token must be a valid address.')
  }
  if (!isAddress(formatAddress(form.refundReceiver), { strict: false })) {
    throw new Error('Refund receiver must be a valid address.')
  }
  if (!isValidBytes(form.data)) {
    throw new Error('Transaction data must be a valid 0x-prefixed hex string.')
  }

  const integerFields: Array<[string, string]> = [
    ['Nonce', form.nonce],
    ['Value', form.value],
    ['SafeTxGas', form.safeTxGas],
    ['BaseGas', form.baseGas],
    ['GasPrice', form.gasPrice],
  ]

  for (const [label, field] of integerFields) {
    if (!isIntegerString(field)) {
      throw new Error(`${label} must be a non-negative integer.`)
    }
  }

  if (!form.version.trim()) {
    throw new Error('Safe version is required.')
  }

  return {
    safeAddress: formatAddress(form.safeAddress),
    chainId: SAFE_NETWORKS[form.network].chainId,
    version: form.version.trim(),
    to: formatAddress(form.to),
    value: form.value.trim(),
    data: form.data.trim() as Hex,
    operation: form.operation,
    safeTxGas: form.safeTxGas.trim(),
    baseGas: form.baseGas.trim(),
    gasPrice: form.gasPrice.trim(),
    gasToken: formatAddress(form.gasToken),
    refundReceiver: formatAddress(form.refundReceiver),
    nonce: form.nonce.trim(),
  }
}

async function decodeSafeTransaction(params: {
  transaction: SafeTransactionParams
  network: SafeVerificationNetwork
  publicClient?: PublicClient
}) {
  const { transaction, network, publicClient } = params

  if (transaction.data === '0x') {
    return { decodedCall: undefined, decodeError: undefined }
  }

  try {
    let abi: Abi | undefined
    let abiSource: ABISource | undefined
    let abiConfidence: ABIConfidence | undefined

    try {
      const resolution = await getContractABI(
        transaction.to,
        network,
        publicClient
      )
      if (resolution.abi.length > 0) {
        abi = resolution.abi as Abi
        abiSource = resolution.source
        abiConfidence = resolution.confidence
      }
    } catch {
      // Best-effort: fall back to 4byte decoding
    }

    const decodedCall = await decodeCalldata({
      calldata: transaction.data,
      target: transaction.to,
      abi,
      abiSource,
      abiConfidence,
    })

    return { decodedCall, decodeError: undefined }
  } catch (error) {
    return {
      decodedCall: undefined,
      decodeError:
        error instanceof Error ? error.message : 'Unable to decode calldata.',
    }
  }
}

const SafeHashVerificationView: React.FC = () => {
  const [method, setMethod] = useState<VerificationMethod>('api')
  const [form, setForm] = useState<ManualFormState>(DEFAULT_FORM)
  const [result, setResult] = useState<SafeVerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const publicClient = usePublicClient()

  const showTestnet = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
  const availableNetworks = useMemo(
    () =>
      (showTestnet
        ? (['mainnet', 'testnet'] as SafeVerificationNetwork[])
        : (['mainnet'] as SafeVerificationNetwork[])).map((network) => ({
        value: network,
        label: SAFE_NETWORKS[network].label,
        chainId: SAFE_NETWORKS[network].chainId,
      })),
    [showTestnet]
  )

  const setField = (key: keyof ManualFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const payload =
        method === 'api'
          ? await fetchSafeVerificationPayload(
              form.network,
              formatAddress(form.safeAddress),
              form.nonce.trim()
            )
          : {
              network: form.network,
              expectedSafeTxHash: (() => {
                const trimmed = form.expectedSafeTxHash.trim()
                if (!trimmed) return undefined
                if (!isValidBytes32(trimmed)) {
                  throw new Error('Expected Safe tx hash must be a valid bytes32 hash.')
                }
                return trimmed.toLowerCase() as Hex
              })(),
              transaction: buildManualTransaction(form),
            }

      const hashes = calculateSafeHashes({
        chainId: payload.transaction.chainId,
        safeAddress: payload.transaction.safeAddress,
        to: payload.transaction.to,
        value: payload.transaction.value,
        data: payload.transaction.data,
        operation: payload.transaction.operation,
        safeTxGas: payload.transaction.safeTxGas,
        baseGas: payload.transaction.baseGas,
        gasPrice: payload.transaction.gasPrice,
        gasToken: payload.transaction.gasToken,
        refundReceiver: payload.transaction.refundReceiver,
        nonce: payload.transaction.nonce,
        version: payload.transaction.version,
      })

      const decoded = await decodeSafeTransaction({
        transaction: payload.transaction,
        network: payload.network,
        publicClient,
      })

      setResult({
        ...payload,
        computedSafeTxHash: hashes.safeTxHash,
        domainHash: hashes.domainHash,
        messageHash: hashes.messageHash,
        isMatch: payload.expectedSafeTxHash
          ? payload.expectedSafeTxHash.toLowerCase() ===
            hashes.safeTxHash.toLowerCase()
          : null,
        decodedCall: decoded.decodedCall,
        decodeError: decoded.decodeError,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const tx = result?.transaction

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
          SAFE Hash Verification
        </h1>
        <p className="text-text-secondary text-base font-normal leading-normal">
          Recompute a SAFE multisig transaction hash on Rootstock and compare it
          against either the Safe Gateway reference hash or a manually provided
          expected hash.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
          <h2 className="text-text-primary text-2xl font-bold leading-tight">
            Input
          </h2>

          <div className="flex flex-col gap-2">
            <LabelWithTooltip
              label="Verification method"
              tooltip={FIELD_TOOLTIPS.verificationMethod}
            />
            <div className="grid grid-cols-2 gap-3">
              {([
                ['api', 'Safe API'],
                ['manual', 'Manual'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-color bg-background text-text-secondary hover:bg-background/80'
                  }`}
                  onClick={() => {
                    setMethod(value)
                    setError(null)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <LabelWithTooltip
                htmlFor="safe-network"
                label="Network"
                tooltip={FIELD_TOOLTIPS.network}
              />
              <select
                id="safe-network"
                className="form-input h-14 rounded border border-border-color bg-background px-4 text-text-primary"
                value={form.network}
                onChange={(e) =>
                  setField(
                    'network',
                    e.target.value as SafeVerificationNetwork
                  )
                }
              >
                {availableNetworks.map((network) => (
                  <option key={network.value} value={network.value}>
                    {network.label} (Chain ID {network.chainId})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <LabelWithTooltip
                htmlFor="safe-address"
                label="SAFE address"
                tooltip={FIELD_TOOLTIPS.safeAddress}
              />
              <input
                id="safe-address"
                className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                placeholder="0x..."
                value={form.safeAddress}
                onChange={(e) => setField('safeAddress', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <LabelWithTooltip
                htmlFor="safe-nonce"
                label="Nonce"
                tooltip={FIELD_TOOLTIPS.nonce}
              />
              <input
                id="safe-nonce"
                className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                placeholder="0"
                value={form.nonce}
                onChange={(e) => setField('nonce', e.target.value)}
              />
            </div>

            {method === 'manual' ? (
              <div className="flex flex-col gap-2">
                <LabelWithTooltip
                  htmlFor="safe-version"
                  label="SAFE version"
                  tooltip={FIELD_TOOLTIPS.version}
                />
                <input
                  id="safe-version"
                  className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                  placeholder="1.3.0"
                  value={form.version}
                  onChange={(e) => setField('version', e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {method === 'manual' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="tx-to"
                    label="To"
                    tooltip={FIELD_TOOLTIPS.to}
                  />
                  <input
                    id="tx-to"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    placeholder="0x..."
                    value={form.to}
                    onChange={(e) => setField('to', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="tx-value"
                    label="Value (wei)"
                    tooltip={FIELD_TOOLTIPS.value}
                  />
                  <input
                    id="tx-value"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    placeholder="0"
                    value={form.value}
                    onChange={(e) => setField('value', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <LabelWithTooltip
                  htmlFor="tx-data"
                  label="Data"
                  tooltip={FIELD_TOOLTIPS.data}
                />
                <textarea
                  id="tx-data"
                  className="form-input min-h-28 rounded border border-border-color bg-background p-4 font-mono text-sm text-text-primary"
                  placeholder="0x"
                  value={form.data}
                  onChange={(e) => setField('data', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="tx-operation"
                    label="Operation"
                    tooltip={FIELD_TOOLTIPS.operation}
                  />
                  <select
                    id="tx-operation"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 text-text-primary"
                    value={form.operation}
                    onChange={(e) =>
                      setField('operation', e.target.value as '0' | '1')
                    }
                  >
                    <option value="0">Call (0)</option>
                    <option value="1">DelegateCall (1)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="safe-tx-gas"
                    label="SafeTxGas"
                    tooltip={FIELD_TOOLTIPS.safeTxGas}
                  />
                  <input
                    id="safe-tx-gas"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.safeTxGas}
                    onChange={(e) => setField('safeTxGas', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="base-gas"
                    label="BaseGas"
                    tooltip={FIELD_TOOLTIPS.baseGas}
                  />
                  <input
                    id="base-gas"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.baseGas}
                    onChange={(e) => setField('baseGas', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="gas-price"
                    label="GasPrice"
                    tooltip={FIELD_TOOLTIPS.gasPrice}
                  />
                  <input
                    id="gas-price"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.gasPrice}
                    onChange={(e) => setField('gasPrice', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="gas-token"
                    label="GasToken"
                    tooltip={FIELD_TOOLTIPS.gasToken}
                  />
                  <input
                    id="gas-token"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.gasToken}
                    onChange={(e) => setField('gasToken', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <LabelWithTooltip
                    htmlFor="refund-receiver"
                    label="RefundReceiver"
                    tooltip={FIELD_TOOLTIPS.refundReceiver}
                  />
                  <input
                    id="refund-receiver"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.refundReceiver}
                    onChange={(e) => setField('refundReceiver', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <LabelWithTooltip
                  htmlFor="expected-safe-hash"
                  label="Expected SafeTxHash (optional)"
                  tooltip={FIELD_TOOLTIPS.expectedSafeTxHash}
                />
                <input
                  id="expected-safe-hash"
                  className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                  placeholder="0x..."
                  value={form.expectedSafeTxHash}
                  onChange={(e) =>
                    setField('expectedSafeTxHash', e.target.value)
                  }
                />
                <p className="text-sm text-text-secondary">
                  Leave blank to compute the Safe tx hash without comparing it
                  against an expected value.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded border border-border-color bg-background p-4 text-sm text-text-secondary">
              The app will fetch the SAFE transaction details, SAFE version, and
              reference hash from the Rootstock Safe Gateway using the Safe
              address and nonce above.
            </div>
          )}

          {error ? (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="flex h-12 min-w-[140px] items-center justify-center rounded bg-primary px-6 text-base font-semibold text-white transition-all hover:bg-primary/90"
              onClick={handleVerify}
              disabled={isLoading}
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="flex h-12 items-center justify-center rounded border border-border-color bg-background px-6 text-base font-semibold text-text-secondary transition-all hover:bg-border-color hover:text-text-primary"
              onClick={() => {
                setForm(DEFAULT_FORM)
                setError(null)
                setResult(null)
                setMethod('api')
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
          <h2 className="text-text-primary text-2xl font-bold leading-tight">
            Result
          </h2>

          {!result ? (
            <div className="flex min-h-[420px] items-center justify-center rounded border border-border-color bg-background p-6 text-center text-text-secondary">
              Run a SAFE verification to compare the reference hash with the
              locally recomputed Safe transaction hash.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div
                className={`rounded border p-4 ${
                  result.isMatch === true
                    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                    : result.isMatch === false
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-primary/30 bg-primary/10 text-primary'
                }`}
              >
                <p className="text-base font-semibold">
                  {result.isMatch === true
                    ? 'Hash verified successfully'
                    : result.isMatch === false
                      ? 'Hash mismatch detected'
                      : 'Safe hash computed'}
                </p>
                <p className="mt-1 text-sm">
                  {result.isMatch === true
                    ? 'The expected SAFE transaction hash matches the locally recomputed value.'
                    : result.isMatch === false
                      ? 'The expected SAFE transaction hash does not match the locally recomputed value.'
                      : 'No expected SAFE transaction hash was provided, so only the locally computed value is shown.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {(
                  [
                    result.expectedSafeTxHash
                      ? ([
                          'Expected SafeTxHash',
                          result.expectedSafeTxHash,
                        ] as const)
                      : null,
                    ['Computed SafeTxHash', result.computedSafeTxHash] as const,
                    ['Domain Hash', result.domainHash] as const,
                    ['Message Hash', result.messageHash] as const,
                  ].filter(
                    (
                      item
                    ): item is readonly [string, string] => item !== null
                  )
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-border-color bg-background p-4"
                  >
                    <p className="text-sm font-medium text-text-secondary">
                      {label}
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-text-primary">
                      {value}
                    </p>
                  </div>
                  ))}
              </div>

              <div className="rounded border border-border-color bg-background p-4">
                <p className="text-lg font-semibold text-text-primary">
                  SAFE transaction
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    ['Network', SAFE_NETWORKS[result.network].label],
                    ['Chain ID', String(tx?.chainId || '')],
                    ['SAFE address', tx?.safeAddress || ''],
                    ['SAFE version', tx?.version || ''],
                    ['Nonce', tx?.nonce || ''],
                    ['To', tx?.to || ''],
                    ['Value', tx?.value || ''],
                    ['Operation', tx?.operation === '1' ? 'DelegateCall' : 'Call'],
                    ['SafeTxGas', tx?.safeTxGas || ''],
                    ['BaseGas', tx?.baseGas || ''],
                    ['GasPrice', tx?.gasPrice || ''],
                    ['GasToken', tx?.gasToken || ''],
                    ['RefundReceiver', tx?.refundReceiver || ''],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-sm font-medium text-text-secondary">
                        {label}
                      </p>
                      <p className="mt-1 break-all font-mono text-sm text-text-primary">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-text-secondary">Data</p>
                  <p className="mt-1 break-all font-mono text-sm text-text-primary">
                    {tx?.data || '0x'}
                  </p>
                </div>
              </div>

              <div className="rounded border border-border-color bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-text-primary">
                    Decoded target call
                  </p>
                  {result.decodedCall ? (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {result.decodedCall.functionName}
                    </span>
                  ) : null}
                </div>

                {result.decodedCall ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-medium text-text-secondary">
                        Signature
                      </p>
                      <p className="mt-1 break-all font-mono text-sm text-text-primary">
                        {result.decodedCall.signature}
                      </p>
                    </div>
                    {result.decodedCall.params.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {result.decodedCall.params.map((param, index) => (
                          <div
                            key={`${param.name}-${index}`}
                            className="rounded border border-border-color bg-surface p-3"
                          >
                            <p className="text-sm font-medium text-text-secondary">
                              {param.name}{' '}
                              <span className="font-mono text-cyan-400">
                                ({param.type})
                              </span>
                            </p>
                            <p className="mt-1 break-all font-mono text-sm text-text-primary">
                              {formatDecodedValue(param.value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        No parameters decoded.
                      </p>
                    )}

                    {result.decodedCall.warnings.length > 0 ? (
                      <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                        <p className="font-semibold">Warnings</p>
                        <ul className="mt-2 list-disc pl-5">
                          {result.decodedCall.warnings.map((warning, index) => (
                            <li key={`${warning.kind}-${index}`}>
                              {warning.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-text-secondary">
                    {result.decodeError ||
                      'No decoded call available. Raw transaction data is shown above.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SafeHashVerificationView
