/**
 * OperationRow Component
 *
 * Displays a single operation row in the operations table with real-time status updates.
 * Uses useOperationStatus hook for live countdown timer and contract state synchronization.
 */

import React from 'react'
import { type Address, type Abi, formatUnits } from 'viem'
import { useChainId, usePublicClient } from 'wagmi'
import Link from 'next/link'
import { useOperationStatus } from '@/hooks/useOperationStatus'
import { getDangerousCallFromCalldata } from '@/lib/dangerous'
import { formatSecondsToTime } from '@/lib/status'
import { useABIManager } from '@/hooks/useABIManager'
import { decodeCalldata, type DecodedCall } from '@/lib/decoder'
import { CHAIN_TO_NETWORK } from '@/services/blockscout/client'
import { ABISource, ABIConfidence } from '@/services/blockscout/abi'

const ERC20_METADATA_ABI = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

type TokenMeta = { decimals: number; symbol: string | null }
const tokenMetaCache = new Map<string, TokenMeta>()

interface Operation {
  id: string
  fullId: `0x${string}`
  status: 'Pending' | 'Ready' | 'Executed' | 'Canceled'
  calls: number
  targets: string[]
  proposer: string
  timelockAddress: Address
  cancelledAt: bigint | null
  executedAt: bigint | null
  delay: bigint
  scheduledAt: bigint
  // Execution parameters (from subgraph) - included for type compatibility with parent view
  target: `0x${string}` | null
  value: bigint | null
  data: `0x${string}` | null
  predecessor: `0x${string}`
  salt: `0x${string}`
  details?: {
    fullId: string
    fullProposer: string
    scheduled: string
    callsDetails: Array<{
      target: string
      value: string
      data?: `0x${string}` | null
      signature?: string | null
    }>
  }
}

interface OperationRowProps {
  operation: Operation
  isExpanded: boolean
  onRowClick: (id: string) => void
  onExecute: (id: string) => void
  onCancel: (operation: Operation) => void
  hasExecutorRole: boolean
  isCheckingExecutorRole: boolean
  isExecuting: boolean
  isExecuteSuccess: boolean
  isExecuteError: boolean
  hasCancellerRole: boolean
  isCheckingCancellerRole: boolean
  isCancelling: boolean
  isCancelSuccess: boolean
  isCancelError: boolean
  minDelay?: bigint
  getStatusColor: (status: string) => string
  getStatusTextColor: (status: string) => string
  formatTargets: (targets: string[]) => string
  formatAbsoluteTime: (timestamp: bigint) => string
}

export const OperationRow: React.FC<OperationRowProps> = ({
  operation,
  isExpanded,
  onRowClick,
  onExecute,
  onCancel,
  hasExecutorRole,
  isCheckingExecutorRole,
  isExecuting,
  isExecuteSuccess,
  isExecuteError,
  hasCancellerRole,
  isCheckingCancellerRole,
  isCancelling,
  isCancelSuccess,
  isCancelError,
  minDelay,
  getStatusColor,
  getStatusTextColor,
  formatTargets,
  formatAbsoluteTime,
}) => {
  const dangerous = React.useMemo(() => {
    return getDangerousCallFromCalldata(operation.data)
  }, [operation.data])

  const abiManager = useABIManager()
  const abiByAddress = React.useMemo(() => {
    const map: Record<string, Abi> = {}
    for (const e of abiManager.entries) {
      map[e.address.toLowerCase()] = e.abi as Abi
    }
    return map
  }, [abiManager.entries])

  const chainId = useChainId()
  const publicClient = usePublicClient()
  const network = CHAIN_TO_NETWORK[chainId]
  const allowRemoteDecode =
    typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'

  // Get live operation status with countdown timer
  const {
    status: liveStatus,
    timeUntilReady,
    timestamp,
  } = useOperationStatus(
    operation.timelockAddress,
    operation.fullId,
    {
      cancelledAt: operation.cancelledAt,
      executedAt: operation.executedAt,
    }
  )

  // Map live status to UI status
  const statusMap: Record<string, 'Pending' | 'Ready' | 'Executed' | 'Canceled'> = {
    'PENDING': 'Pending',
    'READY': 'Ready',
    'EXECUTED': 'Executed',
    'CANCELLED': 'Canceled',
  }
  const displayStatus = statusMap[liveStatus] || operation.status

  // Derive a meaningful timestamp for display:
  // - Pending/Ready: prefer contract getTimestamp() (but ignore 0=UNSET, 1=DONE), else compute scheduledAt + delay
  // - Executed/Canceled: prefer event timestamps
  const getDisplayTimestamp = (): bigint | null => {
    if (displayStatus === 'Executed') {
      return operation.executedAt ?? null
    }
    if (displayStatus === 'Canceled') {
      return operation.cancelledAt ?? null
    }

    // OpenZeppelin TimelockController: 0=UNSET, 1=DONE. Neither is a real ETA.
    if (typeof timestamp === 'bigint' && timestamp > BigInt(1)) {
      return timestamp
    }

    // Fallback: scheduledAt + delay (both are seconds)
    if (typeof operation.scheduledAt === 'bigint' && operation.scheduledAt > BigInt(0)) {
      const delay = typeof operation.delay === 'bigint' ? operation.delay : BigInt(0)
      return operation.scheduledAt + delay
    }

    return null
  }

  // Calculate ETA display
  const getETADisplay = () => {
    const ts = getDisplayTimestamp()
    const absolute = ts ? formatAbsoluteTime(ts) : '-'

    if (displayStatus === 'Executed' || displayStatus === 'Canceled') {
      return { relative: '-', absolute }
    }

    if (displayStatus === 'Pending' && timeUntilReady) {
      return {
        relative: `in ${timeUntilReady}`,
        absolute,
      }
    }

    if (displayStatus === 'Ready') {
      return {
        relative: 'Ready',
        absolute,
      }
    }

    // Fallback
    if (displayStatus === 'Pending' && ts) {
      const now = Math.floor(Date.now() / 1000)
      const secondsUntil = Math.max(0, Number(ts) - now)
      return {
        relative: secondsUntil > 0 ? `in ${formatSecondsToTime(secondsUntil)}` : 'Ready',
        absolute,
      }
    }

    return {
      relative: '-',
      absolute,
    }
  }

  const eta = getETADisplay()

  const stringifyValue = React.useCallback((value: unknown) => {
    try {
      return JSON.stringify(
        value,
        (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
        2
      )
    } catch {
      return String(value)
    }
  }, [])

  const [decodedByIndex, setDecodedByIndex] = React.useState<
    Record<number, { decoded?: DecodedCall; error?: string }>
  >({})
  const [isDecoding, setIsDecoding] = React.useState(false)

  const [humanAmountByIndex, setHumanAmountByIndex] = React.useState<
    Record<
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
  >({})

  const [explainState, setExplainState] = React.useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; summary: string; perCall?: string[] }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

  const isSameHumanAmountMap = React.useCallback(
    (
      a: typeof humanAmountByIndex,
      b: typeof humanAmountByIndex
    ): boolean => {
      const aKeys = Object.keys(a)
      const bKeys = Object.keys(b)
      if (aKeys.length !== bKeys.length) return false
      for (const k of aKeys) {
        const ai = a[Number(k)]
        const bi = b[Number(k)]
        if (ai === bi) continue
        if (!ai || !bi) return false
        if (
          ai.paramIndex !== bi.paramIndex ||
          ai.formatted !== bi.formatted ||
          ai.raw !== bi.raw ||
          ai.symbol !== bi.symbol ||
          ai.decimals !== bi.decimals
        ) {
          return false
        }
      }
      return true
    },
    []
  )

  const getAbiBadge = React.useCallback(
    (decoded: DecodedCall | undefined) => {
      if (!decoded) {
        return {
          label: '⚠️ Unverified - showing raw hex',
          className:
            'inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-200',
        }
      }

      // FR-025: Blockscout-verified contracts show green indicator.
      const isVerifiedBlockscout =
        decoded.source === ABISource.BLOCKSCOUT &&
        decoded.confidence === ABIConfidence.HIGH

      if (isVerifiedBlockscout) {
        return {
          label: '✅ Verified contract',
          className:
            'inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-200',
        }
      }

      // Non-verified sources (manual/custom/4byte) are treated as unverified for spec purposes.
      return {
        label: '⚠️ Unverified - showing raw hex',
        className:
          'inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-200',
      }
    },
    []
  )

  const isBlockscoutVerified = React.useCallback((decoded: DecodedCall | undefined) => {
    return (
      !!decoded &&
      decoded.source === ABISource.BLOCKSCOUT &&
      decoded.confidence === ABIConfidence.HIGH
    )
  }, [])

  const getTokenMeta = React.useCallback(
    async (tokenAddress: Address): Promise<TokenMeta | null> => {
      if (!publicClient) return null
      const key = `${chainId}:${tokenAddress.toLowerCase()}`
      const cached = tokenMetaCache.get(key)
      if (cached) return cached

      try {
        const decimals = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_METADATA_ABI as any,
          functionName: 'decimals',
          args: [],
        })

        let symbol: string | null = null
        try {
          const s = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_METADATA_ABI as any,
            functionName: 'symbol',
            args: [],
          })
          if (typeof s === 'string') symbol = s
        } catch {
          symbol = null
        }

        const meta = { decimals: Number(decimals), symbol }
        tokenMetaCache.set(key, meta)
        return meta
      } catch {
        return null
      }
    },
    [chainId, publicClient]
  )

  // Compute human-formatted amounts for common ERC20 calls once decoded params are available.
  React.useEffect(() => {
    let cancelled = false
    if (!isExpanded) return

    const run = async () => {
      const next: Record<number, (typeof humanAmountByIndex)[number]> = {}
      const calls = operation.details?.callsDetails ?? []

      for (let index = 0; index < calls.length; index++) {
        const call = calls[index]
        const decoded = decodedByIndex[index]?.decoded
        if (!decoded) continue

        const fn = (decoded.functionName || '').toLowerCase()
        const isErc20Common = fn === 'approve' || fn === 'transfer' || fn === 'transferfrom'
        if (!isErc20Common) continue

        // For approve/transfer/transferFrom the amount is typically the last uint256 param.
        const params = decoded.params ?? []
        const amountParamIndex = [...params]
          .map((p, i) => ({ p, i }))
          .reverse()
          .find(({ p }) => String(p.type).toLowerCase().startsWith('uint'))
          ?.i
        if (amountParamIndex === undefined) continue

        const rawValue = params[amountParamIndex]?.value as unknown
        let amount: bigint | null = null
        if (typeof rawValue === 'bigint') amount = rawValue
        else if (typeof rawValue === 'string' && /^-?\d+$/.test(rawValue)) {
          try {
            amount = BigInt(rawValue)
          } catch {
            amount = null
          }
        }
        if (amount === null) continue

        const meta = await getTokenMeta(call.target as Address)
        if (!meta || !Number.isFinite(meta.decimals)) continue

        const formattedUnits = formatUnits(amount, meta.decimals)
        const formatted = meta.symbol ? `${formattedUnits} ${meta.symbol}` : formattedUnits

        next[index] = {
          paramIndex: amountParamIndex,
          formatted,
          raw: amount.toString(),
          symbol: meta.symbol,
          decimals: meta.decimals,
        }
      }

      if (!cancelled) {
        setHumanAmountByIndex((prev) => (isSameHumanAmountMap(prev, next) ? prev : next))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [decodedByIndex, getTokenMeta, isExpanded, isSameHumanAmountMap, operation.details?.callsDetails])

  const requestExplanation = React.useCallback(async () => {
    try {
      setExplainState({ status: 'loading' })
      const calls = operation.details?.callsDetails ?? []

      const payload = {
        chainId,
        operationId: operation.fullId,
        calls: calls.map((call, index) => {
          const decoded = decodedByIndex[index]?.decoded
          const humanAmount = humanAmountByIndex[index]
          return {
            index,
            target: call.target,
            nativeValue: call.value,
            signature: decoded?.signature ?? call.signature ?? decoded?.functionName ?? 'unknown',
            functionName: decoded?.functionName ?? null,
            params: decoded?.params
              ? decoded.params.map((p, i) => ({
                  name: p.name,
                  type: p.type,
                  value: stringifyValue(p.value),
                  display:
                    humanAmount && i === humanAmount.paramIndex
                      ? humanAmount.formatted
                      : undefined,
                  notes:
                    humanAmount && i === humanAmount.paramIndex
                      ? 'display is the human-formatted token amount (decimals applied); value is the raw on-chain/base-unit amount.'
                      : undefined,
                }))
              : [],
          }
        }),
      }

      const res = await fetch('/api/explain_operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
      }

      const data = (await res.json()) as {
        summary?: string
        perCall?: string[]
      }
      setExplainState({
        status: 'success',
        summary: data.summary || 'Explanation generated.',
        perCall: data.perCall,
      })
    } catch (err) {
      setExplainState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [chainId, decodedByIndex, humanAmountByIndex, operation.details?.callsDetails, operation.fullId, stringifyValue])

  React.useEffect(() => {
    let cancelled = false
    if (!isExpanded || !operation.details) return

    const run = async () => {
      setIsDecoding(true)
      const next: Record<number, { decoded?: DecodedCall; error?: string }> = {}

      const calls = operation.details?.callsDetails ?? []
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i]
        const calldata = call.data
        const target = call.target as Address
        if (!calldata || typeof calldata !== 'string' || calldata.length < 10) continue

        const abi = abiByAddress[target.toLowerCase()]
        // If we have a custom ABI, decode immediately.
        // Otherwise, attempt to resolve via Blockscout (browser only; disabled in tests).
        if ((!abi || abi.length === 0) && !allowRemoteDecode) continue

        try {
          const decoded = await decodeCalldata({
            calldata: calldata as any,
            target,
            abi: abi && abi.length > 0 ? abi : undefined,
            network: allowRemoteDecode ? network : undefined,
            publicClient: allowRemoteDecode ? (publicClient ?? undefined) : undefined,
            abiByAddress,
          })
          next[i] = { decoded }
        } catch (err) {
          next[i] = { error: err instanceof Error ? err.message : String(err) }
        }
      }

      if (!cancelled) {
        setDecodedByIndex(next)
        setIsDecoding(false)
      }
    }

    setDecodedByIndex({})
    run()
    return () => {
      cancelled = true
    }
  }, [abiByAddress, allowRemoteDecode, isExpanded, network, operation.details, publicClient])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(operation.id)
    }
  }

  return (
    <React.Fragment>
      {/* Main Row (div-based for virtualization) */}
      <div
        role="row"
        tabIndex={0}
        aria-expanded={isExpanded}
        className={`grid min-w-[1024px] grid-cols-7 items-center border-b border-border-dark px-6 py-4 transition-colors cursor-pointer outline-none ${
          isExpanded ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-white/5'
        }`}
        onClick={() => onRowClick(operation.id)}
        onKeyDown={handleKeyDown}
      >
        <div role="cell" className="font-mono text-text-dark-primary">
          {operation.id}
        </div>
        <div role="cell">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${getStatusColor(displayStatus)}`}
            ></div>
            <span className={`font-medium ${getStatusTextColor(displayStatus)}`}>
              {displayStatus}
            </span>
            {dangerous ? (
              <span
                className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300"
                title={`Dangerous function detected: ${dangerous.functionName}`}
              >
                <span className="material-symbols-outlined mr-1 text-[14px] leading-none">
                  warning
                </span>
                {dangerous.functionName}
              </span>
            ) : null}
          </div>
        </div>
        <div
          role="cell"
          className="text-center font-medium text-text-dark-primary"
        >
          {operation.calls}
        </div>
        <div role="cell" className="font-mono text-text-dark-secondary">
          {formatTargets(operation.targets)}
        </div>
        <div role="cell">
          <div className="flex flex-col">
            <span className="font-medium text-text-dark-primary">
              {eta.relative}
            </span>
            <span className="text-xs text-text-dark-secondary">{eta.absolute}</span>
          </div>
        </div>
        <div role="cell" className="font-mono text-text-dark-secondary">
          {operation.proposer}
        </div>
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-2">
            {displayStatus === 'Ready' && (
              <>
                <button
                  className={`flex items-center justify-center gap-2 rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                    isExecuting
                      ? 'bg-primary/20 text-primary cursor-wait'
                      : isExecuteSuccess
                      ? 'bg-green-500/20 text-green-500'
                      : isExecuteError
                      ? 'bg-red-500/20 text-red-500'
                      : hasExecutorRole
                      ? 'bg-status-ready/20 text-status-ready hover:bg-status-ready/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                  }`}
                  onClick={() => hasExecutorRole && !isExecuting && onExecute(operation.id)}
                  disabled={!hasExecutorRole || isCheckingExecutorRole || isExecuting}
                  title={
                    isExecuting
                      ? 'Transaction pending...'
                      : isExecuteSuccess
                      ? 'Execution successful!'
                      : isExecuteError
                      ? 'Execution failed'
                      : isCheckingExecutorRole
                      ? 'Checking permissions...'
                      : !hasExecutorRole
                      ? 'Your wallet does not have the EXECUTOR_ROLE'
                      : 'Execute this operation'
                  }
                >
                  {isExecuting && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  )}
                  {isExecuteSuccess && (
                    <span className="material-symbols-outlined text-base!">check_circle</span>
                  )}
                  {isExecuteError && (
                    <span className="material-symbols-outlined text-base!">error</span>
                  )}
                  {isExecuting
                    ? 'EXECUTING...'
                    : isExecuteSuccess
                    ? 'SUCCESS'
                    : isExecuteError
                    ? 'FAILED'
                    : isCheckingExecutorRole
                    ? 'CHECKING...'
                    : 'EXECUTE'}
                </button>
                <button
                  className={`flex items-center justify-center gap-2 rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                    isCancelling
                      ? 'bg-primary/20 text-primary cursor-wait'
                      : isCancelSuccess
                      ? 'bg-green-500/20 text-green-500'
                      : isCancelError
                      ? 'bg-red-500/20 text-red-500'
                      : hasCancellerRole
                      ? 'bg-status-canceled/20 text-status-canceled hover:bg-status-canceled/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                  }`}
                  onClick={() =>
                    hasCancellerRole && !isCancelling && onCancel(operation)
                  }
                  disabled={!hasCancellerRole || isCheckingCancellerRole || isCancelling}
                  title={
                    isCancelling
                      ? 'Transaction pending...'
                      : isCancelSuccess
                      ? 'Cancellation successful!'
                      : isCancelError
                      ? 'Cancellation failed'
                      : isCheckingCancellerRole
                      ? 'Checking permissions...'
                      : !hasCancellerRole
                      ? 'Your wallet does not have the CANCELLER_ROLE'
                      : 'Cancel this operation'
                  }
                >
                  {isCancelling && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  )}
                  {isCancelSuccess && (
                    <span className="material-symbols-outlined text-base!">check_circle</span>
                  )}
                  {isCancelError && (
                    <span className="material-symbols-outlined text-base!">error</span>
                  )}
                  {isCancelling
                    ? 'CANCELLING...'
                    : isCancelSuccess
                    ? 'SUCCESS'
                    : isCancelError
                    ? 'FAILED'
                    : isCheckingCancellerRole
                    ? 'CHECKING...'
                    : 'CANCEL'}
                </button>
              </>
            )}
            {displayStatus === 'Pending' && (
              <button
                className={`flex items-center justify-center gap-2 rounded-md h-9 px-3 text-xs font-bold transition-colors ${
                  isCancelling
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : isCancelSuccess
                    ? 'bg-green-500/20 text-green-500'
                    : isCancelError
                    ? 'bg-red-500/20 text-red-500'
                    : hasCancellerRole
                    ? 'bg-status-canceled/20 text-status-canceled hover:bg-status-canceled/30'
                    : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                }`}
                onClick={() =>
                  hasCancellerRole && !isCancelling && onCancel(operation)
                }
                disabled={!hasCancellerRole || isCheckingCancellerRole || isCancelling}
                title={
                  isCancelling
                    ? 'Transaction pending...'
                    : isCancelSuccess
                    ? 'Cancellation successful!'
                    : isCancelError
                    ? 'Cancellation failed'
                    : isCheckingCancellerRole
                    ? 'Checking permissions...'
                    : !hasCancellerRole
                    ? 'Your wallet does not have the CANCELLER_ROLE'
                    : 'Cancel this operation'
                }
              >
                {isCancelling && (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                )}
                {isCancelSuccess && (
                  <span className="material-symbols-outlined text-base!">check_circle</span>
                )}
                {isCancelError && (
                  <span className="material-symbols-outlined text-base!">error</span>
                )}
                {isCancelling
                  ? 'CANCELLING...'
                  : isCancelSuccess
                  ? 'SUCCESS'
                  : isCancelError
                  ? 'FAILED'
                  : isCheckingCancellerRole
                  ? 'CHECKING...'
                  : 'CANCEL'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details Row */}
      {isExpanded && operation.details && (
        <div className="min-w-[1024px] bg-primary/5">
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3 border-b border-border-dark">
            <div>
              <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                Operation Details
              </h4>
              <div className="flex flex-col gap-1 text-sm font-mono">
                <p>
                  <span className="text-text-dark-secondary">Status:</span>{' '}
                  <span className="text-text-dark-primary">{displayStatus}</span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Time until ready:</span>{' '}
                  <span className="text-text-dark-primary">{eta.relative}</span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Ready at:</span>{' '}
                  <span className="text-text-dark-primary">{eta.absolute}</span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Delay:</span>{' '}
                  <span className="text-text-dark-primary">
                    {typeof operation.delay === 'bigint'
                      ? `${operation.delay.toString()}s (${formatSecondsToTime(
                          Number(operation.delay)
                        )})`
                      : '—'}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Current minDelay:</span>{' '}
                  <span className="text-text-dark-primary">
                    {typeof minDelay === 'bigint'
                      ? `${minDelay.toString()}s (${formatSecondsToTime(Number(minDelay))})`
                      : '—'}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">ID:</span>{' '}
                  <span className="text-text-dark-primary">
                    {operation.details.fullId}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Predecessor:</span>{' '}
                  <span className="text-text-dark-primary break-all">
                    {operation.predecessor}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Salt:</span>{' '}
                  <span className="text-text-dark-primary break-all">
                    {operation.salt}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Proposer:</span>{' '}
                  <span className="text-text-dark-primary">
                    {operation.details.fullProposer}
                  </span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Scheduled:</span>{' '}
                  <span className="text-text-dark-primary">
                    {operation.details.scheduled}
                  </span>
                </p>
              </div>
              {dangerous ? (
                <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  <div className="font-semibold">Dangerous function detected</div>
                  <div className="mt-1 text-red-200/80">
                    This operation appears to call{' '}
                    <span className="font-mono">{dangerous.functionName}</span>.
                    Double-check the target and calldata before executing.
                  </div>
                </div>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                Calls ({operation.details.callsDetails.length})
              </h4>
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    requestExplanation()
                  }}
                  disabled={explainState.status === 'loading'}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                    explainState.status === 'loading'
                      ? 'bg-primary/20 text-primary cursor-wait'
                      : 'bg-border-dark text-text-dark-primary hover:bg-white/10'
                  }`}
                >
                  {explainState.status === 'loading' ? 'Explaining…' : 'Explain this operation'}
                </button>
              </div>
              {explainState.status === 'success' ? (
                <div className="mb-3 rounded border border-border-dark/60 bg-black/10 p-3 text-sm">
                  <div className="text-xs font-bold uppercase text-text-dark-secondary mb-1">
                    Human translation
                  </div>
                  <div className="text-text-dark-primary whitespace-pre-wrap">
                    {explainState.summary}
                  </div>
                  {explainState.perCall && explainState.perCall.length > 0 ? (
                    <div className="mt-2 space-y-2 text-text-dark-secondary text-xs">
                      {explainState.perCall.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {explainState.status === 'error' ? (
                <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  Failed to generate explanation: {explainState.message}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 text-sm font-mono bg-background-dark p-3 rounded-md">
                {operation.details.callsDetails.map((call, index) => (
                  <div key={index} className="rounded border border-border-dark/60 bg-black/10 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-primary">{index + 1}.</span>
                        {decodedByIndex[index]?.decoded ? (
                          <span className="text-text-dark-primary">
                            {decodedByIndex[index]!.decoded!.functionName}{' '}
                            <span className="text-text-dark-secondary">
                              {decodedByIndex[index]!.decoded!.signature
                                ? `(${decodedByIndex[index]!.decoded!.signature})`
                                : ''}
                              {decodedByIndex[index]!.decoded!.source === ABISource.FOURBYTE
                                ? ' — 4byte guess'
                                : ''}
                            </span>
                          </span>
                        ) : call.signature ? (
                          <span className="text-text-dark-primary">{call.signature}</span>
                        ) : isDecoding ? (
                          <span className="text-text-dark-secondary">Decoding…</span>
                        ) : (
                          <span className="text-text-dark-secondary">
                            ABI not available — import ABI to decode
                          </span>
                        )}
                      </div>

                      {/* FR-025: ABI confidence indicator */}
                      <span
                        className={
                          getAbiBadge(decodedByIndex[index]?.decoded).className
                        }
                        title="ABI verification status"
                      >
                        {getAbiBadge(decodedByIndex[index]?.decoded).label}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div>
                        <span className="text-text-dark-secondary">Target:</span>{' '}
                        <span className="text-text-dark-primary break-all">
                          {call.target}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-dark-secondary">Native value:</span>{' '}
                        <span className="text-text-dark-primary">{call.value}</span>
                      </div>
                      {call.data ? (
                        <div>
                          <span className="text-text-dark-secondary">Calldata:</span>{' '}
                          <span className="text-text-dark-primary break-all">
                            {call.data}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* FR-026: Link to decoder with preloaded calldata */}
                    {call.data ? (
                      <div className="mt-2">
                        <Link
                          href={`/decoder?calldata=${encodeURIComponent(
                            call.data
                          )}&contractAddress=${encodeURIComponent(call.target)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
                        >
                          Open in Decoder
                          <span className="material-symbols-outlined text-base!">
                            open_in_new
                          </span>
                        </Link>
                      </div>
                    ) : null}

                    {decodedByIndex[index]?.error ? (
                      <div className="mt-2 text-xs text-red-300">
                        Decode failed: {decodedByIndex[index]!.error}
                      </div>
                    ) : null}

                    {/* Only show typed args when we have Blockscout-verified ABI. */}
                    {isBlockscoutVerified(decodedByIndex[index]?.decoded) &&
                    decodedByIndex[index]?.decoded &&
                    decodedByIndex[index]!.decoded!.params.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-xs font-bold uppercase text-text-dark-secondary mb-1">
                          Arguments
                        </div>
                        <div className="space-y-1 text-xs">
                          {decodedByIndex[index]!.decoded!.params.map((p, i) => (
                            <div key={i} className="flex flex-col gap-0.5">
                              <div>
                                <span className="text-text-dark-secondary">
                                  {p.name}
                                </span>{' '}
                                <span className="text-text-dark-secondary">
                                  ({p.type})
                                </span>
                              </div>
                              <pre className="whitespace-pre-wrap wrap-break-word text-text-dark-primary">
                                {stringifyValue(p.value)}
                              </pre>
                              {humanAmountByIndex[index] &&
                              humanAmountByIndex[index]!.paramIndex === i ? (
                                <div className="text-text-dark-primary">
                                  <span className="text-text-dark-secondary">
                                    Human:
                                  </span>{' '}
                                  {humanAmountByIndex[index]!.formatted}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  )
}
