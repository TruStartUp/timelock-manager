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
                if (!isValidBytes32(form.expectedSafeTxHash)) {
                  throw new Error('Expected Safe tx hash must be a valid bytes32 hash.')
                }
                return form.expectedSafeTxHash.trim().toLowerCase() as Hex
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
        isMatch:
          payload.expectedSafeTxHash.toLowerCase() ===
          hashes.safeTxHash.toLowerCase(),
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
            <label className="text-text-primary text-base font-medium leading-normal">
              Verification method
            </label>
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
              <label
                className="text-text-primary text-base font-medium leading-normal"
                htmlFor="safe-network"
              >
                Network
              </label>
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
              <label
                className="text-text-primary text-base font-medium leading-normal"
                htmlFor="safe-address"
              >
                SAFE address
              </label>
              <input
                id="safe-address"
                className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                placeholder="0x..."
                value={form.safeAddress}
                onChange={(e) => setField('safeAddress', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-text-primary text-base font-medium leading-normal"
                htmlFor="safe-nonce"
              >
                Nonce
              </label>
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
                <label
                  className="text-text-primary text-base font-medium leading-normal"
                  htmlFor="safe-version"
                >
                  SAFE version
                </label>
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
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="tx-to"
                  >
                    To
                  </label>
                  <input
                    id="tx-to"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    placeholder="0x..."
                    value={form.to}
                    onChange={(e) => setField('to', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="tx-value"
                  >
                    Value (wei)
                  </label>
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
                <label
                  className="text-text-primary text-base font-medium leading-normal"
                  htmlFor="tx-data"
                >
                  Data
                </label>
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
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="tx-operation"
                  >
                    Operation
                  </label>
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
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="safe-tx-gas"
                  >
                    SafeTxGas
                  </label>
                  <input
                    id="safe-tx-gas"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.safeTxGas}
                    onChange={(e) => setField('safeTxGas', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="base-gas"
                  >
                    BaseGas
                  </label>
                  <input
                    id="base-gas"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.baseGas}
                    onChange={(e) => setField('baseGas', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="gas-price"
                  >
                    GasPrice
                  </label>
                  <input
                    id="gas-price"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.gasPrice}
                    onChange={(e) => setField('gasPrice', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="gas-token"
                  >
                    GasToken
                  </label>
                  <input
                    id="gas-token"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.gasToken}
                    onChange={(e) => setField('gasToken', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-text-primary text-base font-medium leading-normal"
                    htmlFor="refund-receiver"
                  >
                    RefundReceiver
                  </label>
                  <input
                    id="refund-receiver"
                    className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                    value={form.refundReceiver}
                    onChange={(e) => setField('refundReceiver', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className="text-text-primary text-base font-medium leading-normal"
                  htmlFor="expected-safe-hash"
                >
                  Expected SafeTxHash
                </label>
                <input
                  id="expected-safe-hash"
                  className="form-input h-14 rounded border border-border-color bg-background px-4 font-mono text-sm text-text-primary"
                  placeholder="0x..."
                  value={form.expectedSafeTxHash}
                  onChange={(e) =>
                    setField('expectedSafeTxHash', e.target.value)
                  }
                />
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
                  result.isMatch
                    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                <p className="text-base font-semibold">
                  {result.isMatch
                    ? 'Hash verified successfully'
                    : 'Hash mismatch detected'}
                </p>
                <p className="mt-1 text-sm">
                  {result.isMatch
                    ? 'The expected SAFE transaction hash matches the locally recomputed value.'
                    : 'The expected SAFE transaction hash does not match the locally recomputed value.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  ['Expected SafeTxHash', result.expectedSafeTxHash],
                  ['Computed SafeTxHash', result.computedSafeTxHash],
                  ['Domain Hash', result.domainHash],
                  ['Message Hash', result.messageHash],
                ].map(([label, value]) => (
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
