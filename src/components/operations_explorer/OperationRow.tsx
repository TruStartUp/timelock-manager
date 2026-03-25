/**
 * OperationRow Component
 *
 * Displays a single operation row in the operations table with real-time status updates.
 * Uses useOperationStatus hook for live countdown timer and contract state synchronization.
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { type Abi, type Address, formatUnits } from 'viem'
import { useChainId, usePublicClient } from 'wagmi'
import { decodeCalldata, type DecodedCall } from '@/lib/decoder'
import { getDangerousCallFromCalldata } from '@/lib/dangerous'
import {
  buildExplanationFingerprint,
  buildExplainOperationPayload,
  fetchOperationExplanation,
  getOperationExplanationQueryKey,
} from '@/lib/operationExplanation'
import { formatSecondsToTime } from '@/lib/status'
import { useABIManager } from '@/hooks/useABIManager'
import { useOperationStatus } from '@/hooks/useOperationStatus'
import { ABISource, ABIConfidence } from '@/services/blockscout/abi'
import {
  CHAIN_TO_NETWORK,
  getBlockscoutExplorerUrl,
} from '@/services/blockscout/client'

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
  summary: string
  status: 'Pending' | 'Ready' | 'Executed' | 'Canceled'
  calls: number
  targets: string[]
  proposer: string
  timelockAddress: Address
  cancelledAt: bigint | null
  executedAt: bigint | null
  delay: bigint
  scheduledAt: bigint
  scheduledTx: `0x${string}`
  executedTx: `0x${string}` | null
  cancelledTx: `0x${string}` | null
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
      rawValue: bigint
      data?: `0x${string}` | null
      signature?: string | null
    }>
  }
}

interface OperationRowProps {
  operation: Operation
  isExpanded: boolean
  onDetailsClick: (id: string) => void
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
  prewarmExplanation?: boolean
  showExpandedContent?: boolean
  detailMode?: 'inline' | 'drawer'
}

export const OperationRow: React.FC<OperationRowProps> = ({
  operation,
  isExpanded,
  onDetailsClick,
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
  prewarmExplanation = false,
  showExpandedContent = true,
  detailMode = 'inline',
}) => {
  const dangerous = React.useMemo(
    () => getDangerousCallFromCalldata(operation.data),
    [operation.data]
  )

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
  const [isDeveloperDetailsOpen, setIsDeveloperDetailsOpen] = React.useState(false)

  const { status: liveStatus, timeUntilReady, timestamp } = useOperationStatus(
    operation.timelockAddress,
    operation.fullId,
    {
      cancelledAt: operation.cancelledAt,
      executedAt: operation.executedAt,
    }
  )

  const statusMap: Record<
    string,
    'Pending' | 'Ready' | 'Executed' | 'Canceled'
  > = {
    PENDING: 'Pending',
    READY: 'Ready',
    EXECUTED: 'Executed',
    CANCELLED: 'Canceled',
  }
  const displayStatus = statusMap[liveStatus] || operation.status

  const getDisplayTimestamp = (): bigint | null => {
    if (displayStatus === 'Executed') {
      if (operation.executedAt) return operation.executedAt
      if (typeof timestamp === 'bigint' && timestamp > BigInt(1)) return timestamp
      if (operation.scheduledAt > BigInt(0)) {
        const delay =
          typeof operation.delay === 'bigint' ? operation.delay : BigInt(0)
        return operation.scheduledAt + delay
      }
      return null
    }

    if (displayStatus === 'Canceled') {
      if (operation.cancelledAt) return operation.cancelledAt
      if (typeof timestamp === 'bigint' && timestamp > BigInt(1)) return timestamp
      if (operation.scheduledAt > BigInt(0)) return operation.scheduledAt
      return null
    }

    if (typeof timestamp === 'bigint' && timestamp > BigInt(1)) return timestamp

    if (
      typeof operation.scheduledAt === 'bigint' &&
      operation.scheduledAt > BigInt(0)
    ) {
      const delay =
        typeof operation.delay === 'bigint' ? operation.delay : BigInt(0)
      return operation.scheduledAt + delay
    }

    return null
  }

  const formatRelativeFromNow = React.useCallback((timestamp: bigint): string => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const diff = Number(timestamp) - nowSeconds
    const abs = Math.abs(diff)

    if (abs < 60) return diff >= 0 ? 'in less than a minute' : 'just now'

    const units = [
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ] as const

    for (const unit of units) {
      const value = Math.floor(abs / unit.seconds)
      if (value >= 1) {
        const suffix = value === 1 ? '' : 's'
        return diff >= 0
          ? `in ${value} ${unit.label}${suffix}`
          : `${value} ${unit.label}${suffix} ago`
      }
    }

    return diff >= 0 ? 'soon' : 'recently'
  }, [])

  const getETADisplay = () => {
    const ts = getDisplayTimestamp()
    const absolute = ts ? formatAbsoluteTime(ts) : '-'

    if (displayStatus === 'Executed' && ts) {
      return { relative: formatRelativeFromNow(ts), absolute }
    }

    if (displayStatus === 'Canceled' && ts) {
      return { relative: formatRelativeFromNow(ts), absolute }
    }

    if (displayStatus === 'Pending' && timeUntilReady) {
      return { relative: `Ready in ${timeUntilReady}`, absolute }
    }

    if (displayStatus === 'Ready') {
      return { relative: 'Ready now', absolute }
    }

    if (displayStatus === 'Pending' && ts) {
      const now = Math.floor(Date.now() / 1000)
      const secondsUntil = Math.max(0, Number(ts) - now)
      return {
        relative:
          secondsUntil > 0
            ? `Ready in ${formatSecondsToTime(secondsUntil)}`
            : 'Ready now',
        absolute,
      }
    }

    return { relative: '-', absolute }
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
  const callsDetails = React.useMemo(
    () => operation.details?.callsDetails ?? [],
    [operation.details?.callsDetails]
  )
  const requiresDecodeForExplanation = React.useMemo(
    () =>
      callsDetails.some(
        (call) => !!call.data && call.data !== '0x' && call.data.length >= 10
      ),
    [callsDetails]
  )
  const DECODE_CONCURRENCY = 3
  const PREWARM_CALL_CAP = 8

  const mapWithConcurrency = React.useCallback(
    async <T, R>(
      items: T[],
      limit: number,
      worker: (item: T, index: number) => Promise<R>
    ): Promise<R[]> => {
      if (items.length === 0) return []
      const out = new Array<R>(items.length)
      let cursor = 0

      const runWorker = async () => {
        while (true) {
          const index = cursor
          cursor += 1
          if (index >= items.length) return
          out[index] = await worker(items[index], index)
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
      )
      return out
    },
    []
  )

  const explanationPayload = React.useMemo(() => {
    if (
      (!isExpanded && !prewarmExplanation) ||
      !operation.details?.callsDetails?.length ||
      isDecoding
    ) {
      return null
    }

    return buildExplainOperationPayload(operation, chainId, {
      decodedByIndex,
      humanAmountByIndex,
    })
  }, [
    chainId,
    decodedByIndex,
    humanAmountByIndex,
    isDecoding,
    isExpanded,
    operation,
    prewarmExplanation,
    requiresDecodeForExplanation,
  ])

  const explanationFingerprint = React.useMemo(() => {
    if (!explanationPayload) return null
    return buildExplanationFingerprint(explanationPayload)
  }, [explanationPayload])

  const explanationQuery = useQuery({
    queryKey: getOperationExplanationQueryKey(
      chainId,
      operation,
      explanationFingerprint
    ),
    queryFn: ({ signal }) =>
      fetchOperationExplanation(explanationPayload!, explanationFingerprint ?? undefined, signal),
    staleTime: 1000 * 60 * 30,
    enabled:
      Boolean(explanationPayload && explanationFingerprint) &&
      (isExpanded || prewarmExplanation),
  })

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

  const getAbiBadge = React.useCallback((decoded: DecodedCall | undefined) => {
    if (!decoded) {
      return {
        label: '⚠️ Unverified - showing raw hex',
        className:
          'inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200',
      }
    }

    const isVerifiedBlockscout =
      decoded.source === ABISource.BLOCKSCOUT &&
      decoded.confidence === ABIConfidence.HIGH

    if (isVerifiedBlockscout) {
      return {
        label: '✅ Verified contract',
        className:
          'inline-flex items-center rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-950 shadow-sm dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200',
      }
    }

    return {
      label: '⚠️ Unverified - showing raw hex',
      className:
        'inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200',
    }
  }, [])

  const isBlockscoutVerified = React.useCallback(
    (decoded: DecodedCall | undefined) => {
      return (
        !!decoded &&
        decoded.source === ABISource.BLOCKSCOUT &&
        decoded.confidence === ABIConfidence.HIGH
      )
    },
    []
  )

  const blockscoutUrl = React.useMemo(
    () => getBlockscoutExplorerUrl(chainId),
    [chainId]
  )

  const getTxHashDisplay = React.useCallback(
    (txHash: `0x${string}` | null, label: string) => {
      if (!txHash) return null

      return (
        <p>
          <span className="text-text-dark-secondary">{label}:</span>{' '}
          <a
            href={`${blockscoutUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline underline-offset-4 font-mono break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {txHash}
            <span className="material-symbols-outlined text-base! ml-1 align-text-bottom inline-block">
              open_in_new
            </span>
          </a>
        </p>
      )
    },
    [blockscoutUrl]
  )

  const getTokenMeta = React.useCallback(
    async (tokenAddress: Address): Promise<TokenMeta | null> => {
      if (!publicClient) return null
      const key = `${chainId}:${tokenAddress.toLowerCase()}`
      const cached = tokenMetaCache.get(key)
      if (cached) return cached

      try {
        const decimals = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_METADATA_ABI as never,
          functionName: 'decimals',
          args: [],
        })

        let symbol: string | null = null
        try {
          const s = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_METADATA_ABI as never,
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

  React.useEffect(() => {
    let cancelled = false
    if (!isExpanded || !isDeveloperDetailsOpen) return

    const run = async () => {
      const next: Record<number, (typeof humanAmountByIndex)[number]> = {}
      const calls = operation.details?.callsDetails ?? []

      for (let index = 0; index < calls.length; index++) {
        const call = calls[index]
        const decoded = decodedByIndex[index]?.decoded
        if (!decoded) continue

        const fn = (decoded.functionName || '').toLowerCase()
        const isErc20Common =
          fn === 'approve' || fn === 'transfer' || fn === 'transferfrom'
        if (!isErc20Common) continue

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
        const formatted = meta.symbol
          ? `${formattedUnits} ${meta.symbol}`
          : formattedUnits

        next[index] = {
          paramIndex: amountParamIndex,
          formatted,
          raw: amount.toString(),
          symbol: meta.symbol,
          decimals: meta.decimals,
        }
      }

      if (!cancelled) {
        setHumanAmountByIndex((prev) =>
          isSameHumanAmountMap(prev, next) ? prev : next
        )
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    decodedByIndex,
    getTokenMeta,
    isDeveloperDetailsOpen,
    isExpanded,
    isSameHumanAmountMap,
    operation.details?.callsDetails,
  ])

  React.useEffect(() => {
    let cancelled = false
    const shouldRunDecode = isExpanded || prewarmExplanation
    const operationDetails = operation.details
    if (!shouldRunDecode || !operationDetails) return

    const run = async () => {
      if (isExpanded) setIsDecoding(true)
      const next: Record<number, { decoded?: DecodedCall; error?: string }> = {}

      const calls = operationDetails.callsDetails ?? []
      const cappedCalls =
        !isExpanded && calls.length > PREWARM_CALL_CAP
          ? calls.slice(0, PREWARM_CALL_CAP)
          : calls

      const results = await mapWithConcurrency(
        cappedCalls,
        DECODE_CONCURRENCY,
        async (call, i) => {
          const calldata = call.data
          const target = call.target as Address
          if (!calldata || typeof calldata !== 'string' || calldata.length < 10) {
            return { index: i, value: undefined }
          }

          const abi = abiByAddress[target.toLowerCase()]
          if ((!abi || abi.length === 0) && !allowRemoteDecode) {
            return { index: i, value: { error: 'ABI unavailable for automatic decoding' } }
          }

          try {
            const decoded = await decodeCalldata({
              calldata: calldata as never,
              target,
              abi: abi && abi.length > 0 ? abi : undefined,
              network: allowRemoteDecode ? network : undefined,
              publicClient: allowRemoteDecode ? publicClient ?? undefined : undefined,
              abiByAddress,
            })
            return { index: i, value: { decoded } }
          } catch (err) {
            return {
              index: i,
              value: { error: err instanceof Error ? err.message : String(err) },
            }
          }
        }
      )

      for (const item of results) {
        if (item?.value) next[item.index] = item.value
      }

      if (!cancelled) {
        setDecodedByIndex((prev) => ({ ...prev, ...next }))
        if (isExpanded) setIsDecoding(false)
      }
    }

    if (isExpanded) setDecodedByIndex({})
    run()
    return () => {
      cancelled = true
    }
  }, [
    abiByAddress,
    allowRemoteDecode,
    mapWithConcurrency,
    isExpanded,
    network,
    operation.details,
    prewarmExplanation,
    publicClient,
  ])

  React.useEffect(() => {
    if (!isExpanded) setIsDeveloperDetailsOpen(false)
  }, [isExpanded])

  const handleDeveloperToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    setIsDeveloperDetailsOpen(e.currentTarget.open)
  }

  const canShowExplanation = Boolean(operation.details?.callsDetails?.length)
  const explanation = explanationQuery.data
  const isAwaitingInitialDecode =
    canShowExplanation &&
    isExpanded &&
    requiresDecodeForExplanation &&
    !isDecoding &&
    Object.keys(decodedByIndex).length === 0
  const isExplanationLoading =
    canShowExplanation &&
    (isDecoding ||
      isAwaitingInitialDecode ||
      (!!explanationPayload && explanationQuery.isLoading))
  const hasExplanationError =
    (Boolean(explanationPayload) && explanationQuery.isError) ||
    (!isExplanationLoading && !explanation)
  const summaryText = explanationQuery.data?.summary || operation.summary
  const hasEnhancedSummary = Boolean(explanationQuery.data?.summary)
  const summaryIconMeta = React.useMemo(() => {
    if (!hasEnhancedSummary) {
      return {
        icon:
          explanationQuery.isLoading ||
          isDecoding ||
          (requiresDecodeForExplanation && Object.keys(decodedByIndex).length === 0)
            ? 'hourglass_top'
            : 'description',
        iconClass: 'bg-surface-elevated text-text-dark-secondary',
      }
    }

    const text = summaryText.toLowerCase()
    if (
      text.includes('borrow') ||
      text.includes('cap') ||
      text.includes('interest') ||
      text.includes('rate')
    ) {
      return {
        icon: 'trending_up',
        iconClass: 'bg-blue-500/10 text-blue-400',
      }
    }
    if (
      text.includes('admin') ||
      text.includes('role') ||
      text.includes('ownership') ||
      text.includes('permission')
    ) {
      return {
        icon: 'admin_panel_settings',
        iconClass: 'bg-purple-500/10 text-purple-400',
      }
    }
    if (
      text.includes('collateral') ||
      text.includes('security') ||
      text.includes('protect')
    ) {
      return {
        icon: 'security',
        iconClass: 'bg-emerald-500/10 text-emerald-400',
      }
    }
    if (displayStatus === 'Canceled') {
      return {
        icon: 'cancel',
        iconClass: 'bg-slate-500/10 text-slate-400',
      }
    }
    return {
      icon: 'tune',
      iconClass: 'bg-primary/10 text-primary',
    }
  }, [
    decodedByIndex,
    displayStatus,
    explanationQuery.isLoading,
    hasEnhancedSummary,
    isDecoding,
    requiresDecodeForExplanation,
    summaryText,
  ])

  const details = operation.details
  const shouldRenderExpanded = isExpanded && Boolean(details) && showExpandedContent

  const expandedContent = shouldRenderExpanded ? (
    <div
      className={
        detailMode === 'drawer'
          ? 'overflow-hidden rounded-xl border border-border-dark bg-surface-elevated/30'
          : 'min-w-[980px] overflow-hidden bg-surface-elevated/30'
      }
    >
      <div
        className={
          detailMode === 'drawer'
            ? 'space-y-6 p-6'
            : 'space-y-6 border-b border-border-dark p-6'
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_auto]">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${getStatusTextColor(
                    displayStatus
                  )} bg-current/10`}
                >
                  {displayStatus}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-dark-secondary">
                  Human Summary
                </span>
                {Object.values(decodedByIndex).length > 0 &&
                details!.callsDetails.length > 0 &&
                details!.callsDetails.every((_, i) =>
                  isBlockscoutVerified(decodedByIndex[i]?.decoded)
                ) ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="material-symbols-outlined text-sm!">verified</span>
                    Verified target
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-semibold text-text-dark-primary">
                What this operation does
              </p>
              {isExplanationLoading ? (
                <div className="space-y-2">
                  <p className="text-sm leading-7 text-text-dark-secondary">
                    {operation.summary}
                  </p>
                  <div className="h-1.5 w-28 animate-pulse rounded bg-surface-elevated/80" />
                </div>
              ) : hasExplanationError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  We couldn’t generate a plain-language explanation right now.
                  Use Developer Details below to verify the raw transaction data.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-7 text-text-dark-primary">
                    {explanation?.summary}
                  </p>
                  {explanation?.perCall?.length ? (
                    <div className="space-y-2 rounded-xl border border-border-dark/60 bg-surface p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-dark-secondary">
                        Step By Step
                      </p>
                      <div className="space-y-2 text-sm text-text-dark-secondary">
                        {explanation.perCall.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border-dark/60 bg-surface p-4 text-xs text-text-dark-secondary">
              This explanation is generated to help non-technical reviewers.
              Decoded parameters, raw calldata, and developer details remain the
              source of truth.
            </div>

            <div className="rounded-xl border border-border-dark/60 bg-surface p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-text-dark-secondary">
                Proposal Timeline
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-dark-primary">Scheduled</p>
                    <p className="text-xs text-text-dark-secondary">Transaction queued in timelock</p>
                  </div>
                  <div className="text-right text-xs text-text-dark-secondary">
                    <p>{details!.scheduled}</p>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-dark-primary">Ready</p>
                    <p className="text-xs text-text-dark-secondary">Minimum delay has passed</p>
                  </div>
                  <div className="text-right text-xs text-text-dark-secondary">
                    <p>{eta.absolute}</p>
                    <p>{eta.relative}</p>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-dark-primary">
                      {displayStatus === 'Canceled' ? 'Canceled' : 'Executed'}
                    </p>
                    <p className="text-xs text-text-dark-secondary">
                      {displayStatus === 'Executed'
                        ? 'Operation executed on-chain'
                        : displayStatus === 'Canceled'
                          ? 'Operation canceled'
                          : 'Pending execution'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-text-dark-secondary">
                    <p>
                      {displayStatus === 'Executed'
                        ? operation.executedAt
                          ? formatAbsoluteTime(operation.executedAt)
                          : 'Waiting...'
                        : displayStatus === 'Canceled'
                          ? operation.cancelledAt
                            ? formatAbsoluteTime(operation.cancelledAt)
                            : 'Waiting...'
                          : 'Waiting...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {dangerous ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <div className="font-semibold">Dangerous function detected</div>
                <div className="mt-1 text-red-200/80">
                  This operation appears to call{' '}
                  <span className="font-mono">{dangerous.functionName}</span>.
                  Double-check the target and calldata before executing.
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            {displayStatus === 'Ready' ? (
              <>
                <button
                  className={`flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                    isExecuting
                      ? 'bg-primary/20 text-primary cursor-wait'
                      : isExecuteSuccess
                        ? 'bg-green-500/20 text-green-500'
                        : isExecuteError
                          ? 'bg-red-500/20 text-red-500'
                          : hasExecutorRole
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    hasExecutorRole && !isExecuting && onExecute(operation.id)
                  }}
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
                  Execute Now
                </button>
                <button
                  className={`flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
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
                  onClick={(e) => {
                    e.stopPropagation()
                    hasCancellerRole && !isCancelling && onCancel(operation)
                  }}
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
                  Cancel
                </button>
              </>
            ) : null}
            {displayStatus === 'Pending' ? (
              <button
                className={`flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
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
                onClick={(e) => {
                  e.stopPropagation()
                  hasCancellerRole && !isCancelling && onCancel(operation)
                }}
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
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <details
          className="overflow-hidden rounded-xl border border-border-dark bg-surface"
          open={isDeveloperDetailsOpen}
          onToggle={handleDeveloperToggle}
        >
          <summary className="flex cursor-pointer items-center justify-between px-6 py-4 hover:bg-surface-elevated">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-xl">
                code
              </span>
              <span className="font-bold text-sm text-text-dark-primary">
                Developer Details
              </span>
              <span className="text-[10px] font-normal uppercase tracking-wide text-text-dark-secondary">
                Technical Verification
              </span>
            </div>
            <span className="material-symbols-outlined text-text-dark-secondary">
              {isDeveloperDetailsOpen ? 'expand_less' : 'expand_more'}
            </span>
          </summary>

          <div className="grid grid-cols-1 gap-6 border-t border-border-dark p-6 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,2.65fr)]">
            <div className="min-w-0 overflow-hidden">
              <h4 className="mb-2 text-xs font-bold uppercase text-text-dark-secondary">
                Operation Details
              </h4>
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden text-sm font-mono">
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
                <div className="min-w-0 overflow-hidden">
                  <span className="text-text-dark-secondary">ID:</span>
                  <span className="text-text-dark-primary break-all block w-full mt-0.5">
                    {details!.fullId}
                  </span>
                </div>
                <p>
                  <span className="text-text-dark-secondary">Predecessor:</span>{' '}
                  <span className="text-text-dark-primary break-all">{operation.predecessor}</span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Salt:</span>{' '}
                  <span className="text-text-dark-primary break-all">{operation.salt}</span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Proposer:</span>{' '}
                  <span className="text-text-dark-primary">{details!.fullProposer}</span>
                </p>
                <p>
                  <span className="text-text-dark-secondary">Scheduled:</span>{' '}
                  <span className="text-text-dark-primary">{details!.scheduled}</span>
                </p>
                {getTxHashDisplay(operation.scheduledTx, 'Scheduled Tx')}
                {displayStatus === 'Executed'
                  ? getTxHashDisplay(operation.executedTx, 'Executed Tx')
                  : null}
                {displayStatus === 'Canceled'
                  ? getTxHashDisplay(operation.cancelledTx, 'Cancelled Tx')
                  : null}
              </div>
            </div>

            <div className="min-w-0 overflow-hidden">
              <h4 className="mb-2 text-xs font-bold uppercase text-text-dark-secondary">
                Calls ({details!.callsDetails.length})
              </h4>
              <div className="flex flex-col gap-3 rounded-xl border border-border-color bg-surface-elevated/55 p-4 text-sm font-mono">
                {details!.callsDetails.map((call, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-border-color bg-surface p-4 shadow-sm"
                  >
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

                      <span
                        className={getAbiBadge(decodedByIndex[index]?.decoded).className}
                        title="ABI verification status"
                      >
                        {getAbiBadge(decodedByIndex[index]?.decoded).label}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div>
                        <span className="text-text-dark-secondary">Target:</span>{' '}
                        <span className="text-text-dark-primary break-all">{call.target}</span>
                      </div>
                      <div>
                        <span className="text-text-dark-secondary">Native value:</span>{' '}
                        <span className="text-text-dark-primary">{call.value}</span>
                      </div>
                      {call.data ? (
                        <div>
                          <span className="text-text-dark-secondary">Calldata:</span>{' '}
                          <span className="text-text-dark-primary break-all">{call.data}</span>
                        </div>
                      ) : null}
                    </div>

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
                                <span className="text-text-dark-secondary">{p.name}</span>{' '}
                                <span className="text-text-dark-secondary">({p.type})</span>
                              </div>
                              <pre className="whitespace-pre-wrap wrap-break-word text-text-dark-primary">
                                {stringifyValue(p.value)}
                              </pre>
                              {humanAmountByIndex[index] &&
                              humanAmountByIndex[index]!.paramIndex === i ? (
                                <div className="text-text-dark-primary">
                                  <span className="text-text-dark-secondary">Human:</span>{' '}
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
        </details>
      </div>
    </div>
  ) : null

  if (detailMode === 'drawer') {
    return expandedContent
  }

  return (
    <>
      <div
        role="row"
        tabIndex={0}
        aria-expanded={isExpanded}
        className={`grid min-w-[980px] grid-cols-[minmax(360px,3.4fr)_minmax(130px,1fr)_minmax(190px,1.2fr)_minmax(180px,1.2fr)] items-center border-b border-border-dark px-6 py-4 transition-colors cursor-pointer outline-none ${
          isExpanded
            ? 'bg-primary/8 hover:bg-primary/12'
            : 'hover:bg-surface-elevated/40'
        }`}
      >
        <div role="cell" className="min-w-0 pr-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${summaryIconMeta.iconClass}`}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[18px]">
                {summaryIconMeta.icon}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-text-dark-primary">{operation.id}</p>
              {explanationQuery.data?.summary ? (
                <p className="mt-1 max-h-10 overflow-hidden text-sm leading-5 text-text-dark-primary">
                  {explanationQuery.data.summary}
                </p>
              ) : explanationQuery.isLoading ||
                isDecoding ? (
                <>
                  <p className="mt-1 max-h-10 overflow-hidden text-sm leading-5 text-text-dark-secondary">
                    {operation.summary}
                  </p>
                  <div className="mt-2 h-1.5 w-28 animate-pulse rounded bg-surface-elevated/80" />
                </>
              ) : (
                <p className="mt-1 max-h-10 overflow-hidden text-sm leading-5 text-text-dark-secondary">
                  {operation.summary}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-surface-elevated px-2 py-1 text-text-dark-secondary">
              {operation.calls} call{operation.calls === 1 ? '' : 's'}
            </span>
            <span className="rounded-full bg-surface-elevated px-2 py-1 font-mono text-text-dark-secondary">
              {formatTargets(operation.targets)}
            </span>
            <span className="rounded-full bg-surface-elevated px-2 py-1 font-mono text-text-dark-secondary">
              {operation.proposer}
            </span>
            {dangerous ? (
              <span
                className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 font-semibold text-red-300"
                title={`Dangerous function detected: ${dangerous.functionName}`}
              >
                <span className="material-symbols-outlined mr-1 text-[14px] leading-none">
                  warning
                </span>
                Sensitive
              </span>
            ) : null}
          </div>
        </div>
        <div role="cell">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(displayStatus)}`} />
            <span className={`font-semibold ${getStatusTextColor(displayStatus)}`}>
              {displayStatus}
            </span>
            {displayStatus === 'Ready' ? (
              <span className="rounded-full bg-status-ready/15 px-2 py-0.5 text-[11px] font-semibold text-status-ready">
                Action
              </span>
            ) : null}
          </div>
        </div>
        <div role="cell">
          <div className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 text-base text-text-dark-secondary">
                {displayStatus === 'Ready'
                  ? 'bolt'
                  : displayStatus === 'Pending'
                    ? 'schedule'
                    : displayStatus === 'Canceled'
                      ? 'history'
                    : 'event_available'}
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-text-dark-primary">{eta.relative}</span>
                <span className="text-xs text-text-dark-secondary">{eta.absolute}</span>
              </div>
            </div>
          </div>
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
              onClick={() => onDetailsClick(operation.id)}
            >
              {isExpanded ? 'Hide details' : 'Details'}
            </button>
            {displayStatus === 'Ready' ? (
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
                  onClick={() =>
                    hasExecutorRole && !isExecuting && onExecute(operation.id)
                  }
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
                  {isExecuting ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  {isExecuteSuccess ? (
                    <span className="material-symbols-outlined text-base!">
                      check_circle
                    </span>
                  ) : null}
                  {isExecuteError ? (
                    <span className="material-symbols-outlined text-base!">
                      error
                    </span>
                  ) : null}
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
                  {isCancelling ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  {isCancelSuccess ? (
                    <span className="material-symbols-outlined text-base!">
                      check_circle
                    </span>
                  ) : null}
                  {isCancelError ? (
                    <span className="material-symbols-outlined text-base!">
                      error
                    </span>
                  ) : null}
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
            ) : null}
            {displayStatus === 'Pending' ? (
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
                {isCancelling ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                {isCancelSuccess ? (
                  <span className="material-symbols-outlined text-base!">
                    check_circle
                  </span>
                ) : null}
                {isCancelError ? (
                  <span className="material-symbols-outlined text-base!">error</span>
                ) : null}
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
            ) : null}
          </div>
        </div>
      </div>
      {expandedContent}
    </>
  )
}
