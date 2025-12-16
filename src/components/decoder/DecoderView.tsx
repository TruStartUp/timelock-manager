import React, { useEffect, useMemo, useState } from 'react'
import { type Address, isAddress, type Abi } from 'viem'
import { useChainId, usePublicClient } from 'wagmi'
import { useContractABI } from '@/hooks/useContractABI'
import { CHAIN_TO_NETWORK } from '@/services/blockscout/client'
import { ABISource, ABIConfidence, setManualABI } from '@/services/blockscout/abi'
import { decodeCalldata, type DecodedCall } from '@/lib/decoder'

const DecoderView: React.FC = () => {
  // State for form inputs
  const [calldata, setCalldata] = useState('')
  const [contractAddress, setContractAddress] = useState('')
  const [abi, setAbi] = useState('')
  const [decoded, setDecoded] = useState<DecodedCall | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)

  const chainId = useChainId()
  const publicClient = usePublicClient()
  const network = CHAIN_TO_NETWORK[chainId]

  // FR-026: preload calldata (+ optional contract) from query params.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const qCalldata = params.get('calldata') || params.get('data')
    const qContract =
      params.get('contractAddress') || params.get('target') || params.get('contract')

    // Only preload if the user hasn't started typing.
    if (qCalldata && !calldata) setCalldata(qCalldata)
    if (qContract && !contractAddress) setContractAddress(qContract)
    // Do not auto-decode; just preload inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const normalizedContractAddress = useMemo(() => {
    const trimmed = contractAddress.trim().replace(/^0X/, '0x')
    if (!trimmed) return undefined
    if (
      !isAddress(trimmed, {
        strict: false,
      })
    ) {
      return undefined
    }
    return trimmed.toLowerCase() as Address
  }, [contractAddress])

  const {
    abi: fetchedAbi,
    source: fetchedSource,
    confidence: fetchedConfidence,
    isLoading: isAbiLoading,
    isError: isAbiError,
    error: abiError,
  } = useContractABI(normalizedContractAddress, {
    enabled: Boolean(normalizedContractAddress),
  })

  function formatValue(value: unknown): string {
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (Array.isArray(value)) return JSON.stringify(value)
    if (value && typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  function confidenceBadge(result: DecodedCall): {
    label: string
    className: string
  } {
    if (result.source === 'BLOCKSCOUT' && result.confidence === 'HIGH') {
      return {
        label: '✅ Verified contract',
        className:
          'inline-flex items-center rounded-full bg-success/20 px-3 py-1 text-sm font-medium text-success',
      }
    }
    if (result.source === 'FOURBYTE') {
      return {
        label: '⚠️ Decoded using guessed signature',
        className:
          'inline-flex items-center rounded-full bg-yellow-500/20 px-3 py-1 text-sm font-medium text-yellow-400',
      }
    }
    if (result.source === 'MANUAL') {
      return {
        label: '✅ Decoded using manual ABI',
        className:
          'inline-flex items-center rounded-full bg-success/20 px-3 py-1 text-sm font-medium text-success',
      }
    }
    return {
      label: '✅ Decoded',
      className:
        'inline-flex items-center rounded-full bg-border-color px-3 py-1 text-sm font-medium text-text-secondary',
    }
  }

  function shortAddress(addr: string): string {
    if (!addr.startsWith('0x') || addr.length < 10) return addr
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  function renderCall(call: DecodedCall, depth: number): React.ReactNode {
    const summary = `${call.target ? shortAddress(call.target) : 'unknown'} — ${
      call.signature || call.functionName
    }`

    return (
      <details
        key={`${call.selector}-${call.target ?? 'no_target'}-${depth}`}
        className="rounded border border-border-color bg-background"
        open={depth === 0}
      >
        <summary className="cursor-pointer select-none px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm break-all">{summary}</span>
            <span className={confidenceBadge(call).className}>
              {confidenceBadge(call).label}
            </span>
          </div>
        </summary>
        <div className="px-4 pb-4 pt-2 flex flex-col gap-4">
          <div className="rounded border border-border-color bg-surface p-3">
            <p className="font-mono text-xs text-text-secondary">Selector</p>
            <p className="font-mono text-sm text-orange-400 mt-1">
              {call.selector}
            </p>
          </div>

          {call.params.length ? (
            <div>
              <p className="text-text-secondary text-sm">Parameters</p>
              <div className="mt-2 flex flex-col gap-2">
                {call.params.map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    className="grid grid-cols-[1fr_2fr] gap-3 rounded border border-border-color bg-surface p-3"
                  >
                    <div className="font-mono text-sm text-purple-400">
                      {p.name}
                    </div>
                    <div className="font-mono text-sm break-all">
                      <span className="text-cyan-400">({p.type})</span>{' '}
                      <span className="text-orange-400">
                        {formatValue(p.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {call.warnings.length ? (
            <div className="rounded border border-border-color bg-surface p-3">
              <p className="text-text-secondary text-sm">Warnings</p>
              <ul className="mt-2 list-disc pl-5 text-text-secondary text-sm">
                {call.warnings.map((w, i) => (
                  <li key={`${w.kind}-${i}`}>{w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {call.children.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-text-secondary text-sm">Nested operations</p>
              <div className="flex flex-col gap-3 pl-3 border-l border-border-color">
                {call.children.map((c) => renderCall(c, depth + 1))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    )
  }

  // Handler for Decode button
  const handleDecode = async () => {
    setDecodeError(null)
    setDecoded(null)

    const cd = calldata.trim().replace(/^0X/, '0x')
    if (!/^0x[0-9a-fA-F]*$/.test(cd)) {
      setDecodeError('Calldata must be a 0x-prefixed hex string.')
      return
    }
    if (cd.length < 10) {
      setDecodeError('Calldata is too short (needs at least 4 bytes selector).')
      return
    }

    let manualAbi: Abi | undefined
    const abiText = abi.trim()
    if (abiText) {
      try {
        const parsed = JSON.parse(abiText)
        if (!Array.isArray(parsed)) {
          setDecodeError('ABI must be a JSON array.')
          return
        }
        const hasFunctions = parsed.some((item: any) => item?.type === 'function')
        if (!hasFunctions) {
          setDecodeError('ABI must contain at least one function definition.')
          return
        }
        manualAbi = parsed as Abi
      } catch (err) {
        setDecodeError(
          err instanceof Error ? err.message : 'Invalid ABI JSON format.'
        )
        return
      }
    }

    const abiToUse =
      manualAbi && manualAbi.length > 0
        ? manualAbi
        : (fetchedAbi as Abi | undefined)

    try {
      // T078: Cache manual ABI for this address in sessionStorage (so useContractABI can reuse it).
      if (manualAbi && normalizedContractAddress) {
        setManualABI(normalizedContractAddress, manualAbi as unknown[])
      }

      const result = await decodeCalldata({
        calldata: cd as `0x${string}`,
        target: normalizedContractAddress,
        abi: abiToUse,
        abiSource: manualAbi ? ABISource.MANUAL : fetchedSource,
        abiConfidence: manualAbi ? ABIConfidence.HIGH : fetchedConfidence,
        network,
        publicClient: publicClient ?? undefined,
      })
      setDecoded(result)
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : String(err))
    }
  }

  // Handler for Clear button
  const handleClear = () => {
    setCalldata('')
    setContractAddress('')
    setAbi('')
    setDecoded(null)
    setDecodeError(null)
  }

  return (
    <>
      {/* PageHeading */}
      <div className="mb-8">
        <h1 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
          Calldata Decoder
        </h1>
        <p className="text-text-secondary text-base font-normal leading-normal mt-2">
          Decode arbitrary calldata or transaction hashes from the Rootstock
          network.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Input Section */}
        <div className="flex flex-col gap-6">
          <h3 className="text-text-primary tracking-light text-2xl font-bold leading-tight">
            Input
          </h3>

          {/* Calldata Input */}
          <div className="flex flex-col">
            <label
              className="text-text-primary text-base font-medium leading-normal pb-2"
              htmlFor="calldata"
            >
              Calldata (0x...)
            </label>
            <textarea
              className="form-input flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded font-mono text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface focus:border-primary/50 min-h-36 placeholder:text-text-secondary p-4 leading-relaxed"
              id="calldata"
              placeholder="Paste raw hexadecimal calldata here..."
              value={calldata}
              onChange={(e) => setCalldata(e.target.value)}
            />
          </div>

          {/* Contract Address Input */}
          <div className="flex flex-col">
            <label
              className="text-text-primary text-base font-medium leading-normal pb-2"
              htmlFor="contract-address"
            >
              Contract Address (Optional)
            </label>
            <input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded font-mono text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface focus:border-primary/50 h-14 placeholder:text-text-secondary p-4"
              id="contract-address"
              placeholder="0x..."
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
            />
          </div>

          {/* ABI Input */}
          <div className="flex flex-col">
            <label
              className="text-text-primary text-base font-medium leading-normal pb-2"
              htmlFor="abi"
            >
              Contract ABI (JSON, Optional)
            </label>
            <textarea
              className="form-input flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded font-mono text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface focus:border-primary/50 min-h-36 placeholder:text-text-secondary p-4 leading-relaxed"
              id="abi"
              placeholder="Paste contract ABI JSON here..."
              value={abi}
              onChange={(e) => setAbi(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-2">
            <button
              className="flex h-12 flex-1 items-center justify-center rounded bg-primary px-6 text-base font-semibold text-white transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
              onClick={handleDecode}
            >
              Decode
            </button>
            <button
              className="flex h-12 items-center justify-center rounded border border-border-color bg-surface px-6 text-base font-semibold text-text-secondary transition-all hover:bg-border-color hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-border-color focus:ring-offset-2 focus:ring-offset-background"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="flex flex-col gap-6">
          <h3 className="text-text-primary tracking-light text-2xl font-bold leading-tight">
            Output
          </h3>
          <div className="flex h-full min-h-[400px] flex-col rounded border border-border-color bg-surface p-6">
            {decoded ? (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Decoded Function</h4>
                  <span className={confidenceBadge(decoded).className}>
                    {confidenceBadge(decoded).label}
                  </span>
                </div>

                {/* Function */}
                <div className="rounded border border-border-color bg-background p-4">
                  <p className="font-mono text-sm text-text-secondary">Function</p>
                  <p className="font-mono text-base break-all mt-2">
                    {decoded.signature || decoded.functionName}
                  </p>
                </div>

                {/* Selector */}
                <div className="rounded border border-border-color bg-background p-4">
                  <p className="font-mono text-sm text-text-secondary">
                    Selector
                  </p>
                  <p className="font-mono text-base text-orange-400 mt-2">
                    {decoded.selector}
                  </p>
                </div>

                {/* Parameters */}
                <div className="mt-2">
                  <h4 className="text-lg font-semibold">Parameters</h4>
                  {decoded.params.length === 0 ? (
                    <p className="text-text-secondary mt-3">
                      No parameters detected.
                    </p>
                  ) : (
                    <div className="mt-4 flex flex-col gap-3">
                      {decoded.params.map((p, idx) => (
                        <div
                          key={`${p.name}-${idx}`}
                          className="grid grid-cols-[1fr_2fr] items-start gap-4 rounded border border-border-color bg-background p-4"
                        >
                          <div className="flex flex-col">
                            <p className="font-mono text-sm text-text-secondary">
                              Name
                            </p>
                            <p className="font-mono text-base text-purple-400 mt-1">
                              {p.name}
                            </p>
                          </div>
                          <div className="flex flex-col">
                            <p className="font-mono text-sm text-text-secondary">
                              Value{' '}
                              <span className="text-cyan-400">({p.type})</span>
                            </p>
                            <p className="font-mono text-base text-orange-400 break-all mt-1">
                              {formatValue(p.value)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {decoded.warnings.length > 0 ? (
                  <div className="rounded border border-border-color bg-background p-4">
                    <p className="text-text-secondary text-sm">
                      Warnings:
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-text-secondary text-sm">
                      {decoded.warnings.map((w, i) => (
                        <li key={`${w.kind}-${i}`}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* T077: Nested operations (collapsible) */}
                {decoded.children.length > 0 ? (
                  <div className="mt-2">
                    <h4 className="text-lg font-semibold">Nested operations</h4>
                    <div className="mt-4 flex flex-col gap-3">
                      {decoded.children.map((c) => renderCall(c, 0))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : decodeError ? (
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Cannot decode</h4>
                  <span className="inline-flex items-center rounded-full bg-red-500/20 px-3 py-1 text-sm font-medium text-red-400">
                    ❌ Cannot decode
                  </span>
                </div>
                <p className="text-text-secondary">{decodeError}</p>
                <div className="rounded border border-border-color bg-background p-4">
                  <p className="font-mono text-sm text-text-secondary">Raw</p>
                  <p className="font-mono text-sm break-all mt-2">{calldata.trim()}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center">
                <div className="flex flex-col gap-2">
                  <p className="text-text-secondary">Awaiting input to decode…</p>
                  {normalizedContractAddress ? (
                    <p className="text-text-secondary text-sm">
                      {isAbiLoading
                        ? 'Fetching verified ABI…'
                        : isAbiError
                          ? `ABI lookup failed: ${abiError || 'Unknown error'}`
                          : fetchedAbi?.length
                            ? `ABI ready (${fetchedSource}/${fetchedConfidence})`
                            : 'No ABI found yet.'}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default DecoderView
