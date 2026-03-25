import React, { useState, useMemo, useEffect, useRef } from 'react'
import { type Address, type Abi, formatEther, isAddress } from 'viem'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useOperations } from '@/hooks/useOperations'
import { useHasRole } from '@/hooks/useHasRole'
import { useTimelockWrite } from '@/hooks/useTimelockWrite'
import { useABIManager } from '@/hooks/useABIManager'
import { TIMELOCK_ROLES } from '@/lib/constants'
import { formatTxError } from '@/lib/txErrors'
import { type Operation as SubgraphOperation, type OperationStatus as SubgraphOperationStatus } from '@/types/operation'
import { Skeleton } from '@/components/common/Skeleton'
import { OperationRow } from './OperationRow'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { decodeCalldata, type DecodedCall } from '@/lib/decoder'
import { CHAIN_TO_NETWORK, getBlockscoutExplorerUrl } from '@/services/blockscout/client'
import { ABISource, ABIConfidence } from '@/services/blockscout/abi'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTimelocks } from '@/hooks/useTimelocks'

type OperationStatus = 'All' | 'Pending' | 'Ready' | 'Executed' | 'Canceled'

const DEFAULT_DOCS_URL = 'https://david-personal.gitbook.io/timelock-manager/'

const STATUS_TOOLTIPS: Record<Exclude<OperationStatus, 'All'>, string> = {
  Pending:
    'This action is scheduled, but it’s still waiting for the required time to pass.',
  Ready: 'The waiting time has passed. This action can be executed now.',
  Executed: 'This action has already been executed.',
  Canceled: 'This action was canceled and won’t be executed.',
}

function TooltipIcon(props: { text: string; ariaLabel: string }) {
  const { text, ariaLabel } = props
  return (
    <span className="relative inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        className="group inline-flex size-4 items-center justify-center rounded-full border border-current/30 bg-surface-elevated/60 text-[11px] font-bold leading-none text-current/80 outline-none hover:text-current focus-visible:ring-2 focus-visible:ring-primary/30"
        onClick={(e) => {
          // Do not toggle the surrounding filter
          e.preventDefault()
          e.stopPropagation()
        }}
        onKeyDown={(e) => {
          // Avoid triggering parent button via keyboard
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        ?
        <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-border-dark bg-surface px-3 py-2 text-xs font-medium text-text-dark-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {text}
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full">
            <span className="block size-0 border-x-8 border-b-8 border-x-transparent border-b-border-dark" />
            <span className="relative -top-[7px] block size-0 border-x-7 border-b-7 border-x-transparent border-b-surface" />
          </span>
        </span>
      </span>
    </span>
  )
}

function TimelockExplorerEmptyState({
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
  docsUrl,
}: {
  icon: string
  title: string
  body: string
  ctaHref: string
  ctaLabel: string
  docsUrl: string
}) {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <section className="app-card overflow-hidden">
        <div className="border-b border-border-color px-6 py-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
              Timelock Management
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Timelock Operations
            </h1>
            <p className="text-sm text-text-secondary">
              Review scheduled, ready, executed, and canceled operations for the active controller.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center py-6">
        <div className="app-card w-full max-w-3xl p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary">
            <span className="material-symbols-outlined text-2xl">{icon}</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
          <p className="mt-2 text-text-secondary">{body}</p>
          <div className="mt-6">
            <Link href={ctaHref} className="app-button-primary px-6">
              {ctaLabel}
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/8 p-6 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <span className="material-symbols-outlined text-xl">lock_clock</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
                    What Is A Timelock?
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-text-primary">
                    A review window before governance changes go live
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  A timelock delays administrative actions before they execute on-chain. That delay gives contributors time to review proposals, verify calldata, and react before a change becomes active.
                </p>
                <p className="text-sm leading-relaxed text-text-secondary">
                  Once you configure and select a timelock, this explorer will show queued actions, ready executions, execution history, and technical inspection details for that controller.
                </p>
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Learn more in the docs
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

interface Operation {
  id: string
  fullId: `0x${string}`
  summary: string
  status: Exclude<OperationStatus, 'All'>
  calls: number
  targets: string[]
  proposer: string
  timelockAddress: Address
  cancelledAt: bigint | null
  executedAt: bigint | null
  delay: bigint
  scheduledAt: bigint
  // Transaction hashes
  scheduledTx: `0x${string}`
  executedTx: `0x${string}` | null
  cancelledTx: `0x${string}` | null
  // Execution parameters (from subgraph)
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

type SimulationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'error'; message: string }

const OperationsExplorerView: React.FC = () => {
  const router = useRouter()
  const [selectedFilter, setSelectedFilter] = useState<OperationStatus>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null)
  // T116: pagination state
  const [pageSize, setPageSize] = useState<number>(50)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const [confirmCancelOperation, setConfirmCancelOperation] =
    useState<Operation | null>(null)
  const [activeCancelOperationId, setActiveCancelOperationId] = useState<
    `0x${string}` | null
  >(null)

  // T111: Simulation previews
  const publicClient = usePublicClient()
  const [confirmExecuteOperation, setConfirmExecuteOperation] =
    useState<Operation | null>(null)
  const [executeSimulation, setExecuteSimulation] =
    useState<SimulationState>({ status: 'idle' })
  const [cancelSimulation, setCancelSimulation] =
    useState<SimulationState>({ status: 'idle' })

  // T113: focus management for dialogs
  const lastFocusedElRef = useRef<HTMLElement | null>(null)
  const executeDialogCloseRef = useRef<HTMLButtonElement | null>(null)
  const cancelDialogCloseRef = useRef<HTMLButtonElement | null>(null)
  const { selected, configurations } = useTimelocks()
  const timelockAddress = (selected?.address as Address | undefined) ?? undefined
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL

  // Initialize status filter from URL query param (e.g. /operations_explorer?status=pending)
  useEffect(() => {
    if (!router.isReady) return
    const raw = router.query.status
    const value =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw) && typeof raw[0] === 'string'
          ? raw[0]
          : ''

    const status = value.trim().toLowerCase()
    const next: OperationStatus | null =
      status === 'pending'
        ? 'Pending'
        : status === 'ready'
          ? 'Ready'
          : status === 'executed'
            ? 'Executed'
            : null

    if (next && next !== selectedFilter) setSelectedFilter(next)
  }, [router.isReady, router.query.status, selectedFilter])

  // Get connected wallet address
  const { address: connectedAccount } = useAccount()

  // Get current chain ID for query invalidation
  const chainId = useChainId()
  const network = CHAIN_TO_NETWORK[chainId]

  // Get query client for invalidating queries after execution
  const queryClient = useQueryClient()

  // ABI sources (custom ABIs + optional Blockscout resolution)
  const abiManager = useABIManager()
  const abiByAddress = useMemo(() => {
    const map: Record<string, Abi> = {}
    for (const e of abiManager.entries) {
      map[e.address.toLowerCase()] = e.abi as Abi
    }
    return map
  }, [abiManager.entries])
  const allowRemoteDecode =
    typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'

  // FR-031: decoded call summary for the execute confirmation modal
  const [decodedExecute, setDecodedExecute] = useState<DecodedCall | null>(null)
  const [decodedBatchCalls, setDecodedBatchCalls] = useState<(DecodedCall | null)[]>([])
  const [executeDecodeError, setExecuteDecodeError] = useState<string | null>(null)
  const [isDecodingExecute, setIsDecodingExecute] = useState(false)

  const stringifyValue = useMemo(() => {
    return (value: unknown) => {
      try {
        return JSON.stringify(
          value,
          (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
          2
        )
      } catch {
        return String(value)
      }
    }
  }, [])

  const isVerifiedBlockscout = (decoded: DecodedCall | null) => {
    return (
      !!decoded &&
      decoded.source === ABISource.BLOCKSCOUT &&
      decoded.confidence === ABIConfidence.HIGH
    )
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!confirmExecuteOperation) {
        setDecodedExecute(null)
        setDecodedBatchCalls([])
        setExecuteDecodeError(null)
        setIsDecodingExecute(false)
        return
      }

      const isBatch = confirmExecuteOperation.calls > 1

      if (isBatch) {
        // Batch operation - decode each call
        const callsDetails = confirmExecuteOperation.details?.callsDetails
        if (!callsDetails?.length) {
          setDecodedExecute(null)
          setDecodedBatchCalls([])
          setExecuteDecodeError(null)
          setIsDecodingExecute(false)
          return
        }

        setIsDecodingExecute(true)
        setExecuteDecodeError(null)
        setDecodedExecute(null)
        setDecodedBatchCalls([])

        try {
          const decodedResults = await Promise.all(
            callsDetails.map(async (call) => {
              const target = call.target as Address
              const calldata = (call.data || '0x') as `0x${string}`
              const abi = abiByAddress[target.toLowerCase()]

              // Skip if no ABI and no remote decode
              if ((!abi || abi.length === 0) && !allowRemoteDecode) {
                return null
              }

              try {
                return await decodeCalldata({
                  calldata,
                  target,
                  abi: abi && abi.length > 0 ? abi : undefined,
                  network: allowRemoteDecode ? network : undefined,
                  publicClient: allowRemoteDecode ? (publicClient ?? undefined) : undefined,
                  abiByAddress,
                })
              } catch {
                return null
              }
            })
          )
          if (!cancelled) setDecodedBatchCalls(decodedResults)
        } catch (err) {
          if (!cancelled) {
            setExecuteDecodeError(err instanceof Error ? err.message : String(err))
          }
        } finally {
          if (!cancelled) setIsDecodingExecute(false)
        }
      } else {
        // Single operation - existing behavior
        if (
          !confirmExecuteOperation.target ||
          confirmExecuteOperation.value === null ||
          !confirmExecuteOperation.data
        ) {
          setDecodedExecute(null)
          setDecodedBatchCalls([])
          setExecuteDecodeError(null)
          setIsDecodingExecute(false)
          return
        }

        const target = confirmExecuteOperation.target as Address
        const calldata = confirmExecuteOperation.data as `0x${string}`
        const abi = abiByAddress[target.toLowerCase()]

        // Only attempt if we have a custom ABI or remote decode is allowed.
        if ((!abi || abi.length === 0) && !allowRemoteDecode) {
          setDecodedExecute(null)
          setDecodedBatchCalls([])
          setExecuteDecodeError(null)
          setIsDecodingExecute(false)
          return
        }

        setIsDecodingExecute(true)
        setExecuteDecodeError(null)
        setDecodedExecute(null)
        setDecodedBatchCalls([])
        try {
          const decoded = await decodeCalldata({
            calldata,
            target,
            abi: abi && abi.length > 0 ? abi : undefined,
            network: allowRemoteDecode ? network : undefined,
            publicClient: allowRemoteDecode ? (publicClient ?? undefined) : undefined,
            abiByAddress,
          })
          if (!cancelled) setDecodedExecute(decoded)
        } catch (err) {
          if (!cancelled) {
            setExecuteDecodeError(err instanceof Error ? err.message : String(err))
          }
        } finally {
          if (!cancelled) setIsDecodingExecute(false)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [abiByAddress, allowRemoteDecode, confirmExecuteOperation, network, publicClient])

  // Check if connected wallet has EXECUTOR_ROLE (only if timelockAddress is set)
  const { hasRole: hasExecutorRole, isLoading: isCheckingExecutorRole } = useHasRole({
    timelockController: timelockAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
    role: TIMELOCK_ROLES.EXECUTOR_ROLE,
    account: connectedAccount,
  })

  // T081: Check if connected wallet has CANCELLER_ROLE
  const { hasRole: hasCancellerRole, isLoading: isCheckingCancellerRole } = useHasRole({
    timelockController:
      timelockAddress ??
      ('0x0000000000000000000000000000000000000000' as Address),
    role: TIMELOCK_ROLES.CANCELLER_ROLE,
    account: connectedAccount,
  })

  // Initialize useTimelockWrite for executing operations
  const {
    execute,
    cancel,
    isPending: isExecuting,
    isSuccess: isExecuteSuccess,
    isError: isExecuteError,
    error: executeError,
    txHash: executeTxHash,
    isCancelPending: isCancelling,
    isCancelSuccess,
    isCancelError,
    cancelError,
    cancelTxHash,
    resetCancel,
    minDelay,
  } = useTimelockWrite({
    timelockController: timelockAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
    account: connectedAccount,
  })

  // T111: simulate execute()/executeBatch() when the confirm modal opens
  useEffect(() => {
    const run = async () => {
      if (!publicClient || !timelockAddress || !confirmExecuteOperation) {
        setExecuteSimulation({ status: 'idle' })
        return
      }

      const isBatch = confirmExecuteOperation.calls > 1

      // For batch operations, we need callsDetails
      if (isBatch) {
        if (!confirmExecuteOperation.details?.callsDetails?.length) {
          setExecuteSimulation({ status: 'idle' })
          return
        }
      } else {
        // For single operations, we need target/value/data
        if (
          !confirmExecuteOperation.target ||
          confirmExecuteOperation.value === null ||
          !confirmExecuteOperation.data
        ) {
          setExecuteSimulation({ status: 'idle' })
          return
        }
      }

      setExecuteSimulation({ status: 'pending' })
      try {
        if (isBatch) {
          // Batch operation - simulate executeBatch()
          const callsDetails = confirmExecuteOperation.details!.callsDetails
          const totalValue = callsDetails.reduce(
            (sum, c) => sum + (c.rawValue ?? BigInt(0)),
            BigInt(0)
          )
          await publicClient.simulateContract({
            address: timelockAddress,
            abi: TimelockControllerABI as any,
            functionName: 'executeBatch',
            args: [
              callsDetails.map((c) => c.target as Address),
              callsDetails.map((c) => c.rawValue),
              callsDetails.map((c) => (c.data || '0x') as `0x${string}`),
              confirmExecuteOperation.predecessor,
              confirmExecuteOperation.salt,
            ],
            value: totalValue,
            account: connectedAccount,
          } as any)
        } else {
          // Single operation - simulate execute()
          await publicClient.simulateContract({
            address: timelockAddress,
            abi: TimelockControllerABI as any,
            functionName: 'execute',
            args: [
              confirmExecuteOperation.target,
              confirmExecuteOperation.value,
              confirmExecuteOperation.data,
              confirmExecuteOperation.predecessor,
              confirmExecuteOperation.salt,
            ],
            value: confirmExecuteOperation.value,
            account: connectedAccount,
          } as any)
        }

        setExecuteSimulation({ status: 'success' })
      } catch (err) {
        setExecuteSimulation({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
    run()
  }, [confirmExecuteOperation, connectedAccount, publicClient, timelockAddress])

  // T113: focus trap-lite for execute dialog
  useEffect(() => {
    if (confirmExecuteOperation) {
      lastFocusedElRef.current = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => executeDialogCloseRef.current?.focus())
      return
    }
    lastFocusedElRef.current?.focus?.()
  }, [confirmExecuteOperation])

  // T111: simulate cancel(id) when cancel confirmation dialog opens
  useEffect(() => {
    const run = async () => {
      if (!publicClient || !timelockAddress || !confirmCancelOperation) {
        setCancelSimulation({ status: 'idle' })
        return
      }

      setCancelSimulation({ status: 'pending' })
      try {
        await publicClient.simulateContract({
          address: timelockAddress,
          abi: TimelockControllerABI as any,
          functionName: 'cancel',
          args: [confirmCancelOperation.fullId],
          account: connectedAccount,
        } as any)
        setCancelSimulation({ status: 'success' })
      } catch (err) {
        setCancelSimulation({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
    run()
  }, [confirmCancelOperation, connectedAccount, publicClient, timelockAddress])

  // T113: focus trap-lite for cancel dialog
  useEffect(() => {
    if (confirmCancelOperation) {
      lastFocusedElRef.current = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => cancelDialogCloseRef.current?.focus())
      return
    }
    lastFocusedElRef.current?.focus?.()
  }, [confirmCancelOperation])

  // Map UI filter to subgraph status filter
  const statusFilter: SubgraphOperationStatus | undefined = useMemo(() => {
    if (selectedFilter === 'All') return undefined
    // Map UI status to subgraph status
    const statusMap: Record<Exclude<OperationStatus, 'All'>, SubgraphOperationStatus> = {
      'Pending': 'PENDING',
      'Ready': 'READY',
      'Executed': 'EXECUTED',
      'Canceled': 'CANCELLED',
    }
    return statusMap[selectedFilter]
  }, [selectedFilter])

  // T091: If search input is an address, apply to BOTH proposer + target filters.
  const normalizedAddressQuery = useMemo((): Address | null => {
    const trimmed = searchQuery.trim().replace(/^0X/, '0x')
    if (!trimmed) return null
    if (
      isAddress(trimmed, {
        strict: false,
      })
    ) {
      return trimmed.toLowerCase() as Address
    }
    return null
  }, [searchQuery])

  const textSearch = useMemo(() => {
    if (normalizedAddressQuery) return ''
    return searchQuery.trim().toLowerCase()
  }, [normalizedAddressQuery, searchQuery])

  const dateFromTs = useMemo((): bigint | undefined => {
    if (!dateFrom) return undefined
    const ms = Date.parse(`${dateFrom}T00:00:00Z`)
    if (Number.isNaN(ms)) return undefined
    return BigInt(Math.floor(ms / 1000))
  }, [dateFrom])

  const dateToTs = useMemo((): bigint | undefined => {
    if (!dateTo) return undefined
    const ms = Date.parse(`${dateTo}T23:59:59Z`)
    if (Number.isNaN(ms)) return undefined
    return BigInt(Math.floor(ms / 1000))
  }, [dateTo])

  const dateRangeError = useMemo(() => {
    if (dateFromTs !== undefined && dateToTs !== undefined && dateFromTs > dateToTs) {
      return 'Invalid date range: “From” must be earlier than “To”.'
    }
    return null
  }, [dateFromTs, dateToTs])

  // T116: reset pagination when filters change
  useEffect(() => {
    setPageIndex(0)
  }, [
    selectedFilter,
    normalizedAddressQuery,
    textSearch,
    dateFromTs,
    dateToTs,
    timelockAddress,
  ])

  // Fetch operations from subgraph with filters
  const { data: subgraphOperations, isLoading, isError, refetch } = useOperations(
    {
      timelockController: timelockAddress,
      status: statusFilter,
      proposer: normalizedAddressQuery ?? undefined,
      target: normalizedAddressQuery ?? undefined,
      dateFrom: dateFromTs,
      dateTo: dateToTs,
    },
    {
      enabled: !!timelockAddress && !dateRangeError,
      pagination: {
        first: pageSize,
        skip: pageIndex * pageSize,
      },
    }
  )

  // Automatically refresh operations list after successful execution (T044)
  useEffect(() => {
    if (isExecuteSuccess) {
      // Invalidate all operations queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['operations', chainId] })

      // Also invalidate operations summary for dashboard updates
      queryClient.invalidateQueries({ queryKey: ['operations-summary', chainId] })

      // Close the execute confirmation modal
      setConfirmExecuteOperation(null)
    }
  }, [isExecuteSuccess, chainId, queryClient])

  // T085: Automatically refresh operations list after successful cancellation
  useEffect(() => {
    if (isCancelSuccess) {
      queryClient.invalidateQueries({ queryKey: ['operations', chainId] })
      queryClient.invalidateQueries({ queryKey: ['operations-summary', chainId] })

      // Close the cancel confirmation modal
      setConfirmCancelOperation(null)
    }
  }, [isCancelSuccess, chainId, queryClient])

  // Helper functions for formatting
  const shortenAddress = (address: string): string => {
    if (address.length < 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatAbsoluteTime = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    })
  }

  const mapSubgraphStatus = (status: SubgraphOperationStatus): Exclude<OperationStatus, 'All'> => {
    const statusMap: Record<SubgraphOperationStatus, Exclude<OperationStatus, 'All'>> = {
      'PENDING': 'Pending',
      'READY': 'Ready',
      'EXECUTED': 'Executed',
      'CANCELLED': 'Canceled',
    }
    return statusMap[status]
  }

  // Transform subgraph operations to UI operations format
  const operations: Operation[] = useMemo(() => {
    if (!subgraphOperations) return []

    return subgraphOperations.map((op: SubgraphOperation) => {
      const subgraphCalls = (op.calls || []) as Array<{
        target: `0x${string}`
        value: bigint
        data: `0x${string}`
        signature: string | null
      }>

      const isBatch = subgraphCalls.length > 0
      const primaryTarget = op.target ?? (subgraphCalls[0]?.target ?? null)
      const primaryValue = op.value ?? (subgraphCalls[0]?.value ?? null)
      const primaryData = op.data ?? (subgraphCalls[0]?.data ?? null)

      // Determine targets - prefer calls relationship (batch) otherwise single target
      const targets: string[] = isBatch
        ? subgraphCalls.map((c) => c.target)
        : primaryTarget
          ? [primaryTarget]
          : []
      const callsCount = isBatch ? subgraphCalls.length : primaryTarget ? 1 : 0
      const firstCallSignature = subgraphCalls[0]?.signature ?? null
      const firstFunctionName =
        firstCallSignature && firstCallSignature.includes('(')
          ? firstCallSignature.split('(')[0]
          : firstCallSignature
      const selector =
        primaryData && primaryData !== '0x' && primaryData.length >= 10
          ? primaryData.slice(0, 10)
          : null
      const targetLabel = primaryTarget ? shortenAddress(primaryTarget) : 'unknown target'
      const collapsedSummary =
        callsCount > 1
          ? firstFunctionName
            ? `Batch (${callsCount} calls), starts with ${firstFunctionName}.`
            : `Batch operation with ${callsCount} calls.`
          : firstFunctionName
            ? `${firstFunctionName} on ${targetLabel}.`
            : selector
              ? `Contract call ${selector} on ${targetLabel}.`
              : `Administrative update on ${targetLabel}.`

      // Format operation for UI
      const uiOperation: Operation = {
        id: shortenAddress(op.id),
        fullId: op.id,
        summary: collapsedSummary,
        status: mapSubgraphStatus(op.status),
        calls: callsCount,
        targets: targets.map(shortenAddress),
        proposer: shortenAddress(op.scheduledBy),
        timelockAddress: timelockAddress!,
        cancelledAt: op.cancelledAt,
        executedAt: op.executedAt,
        delay: op.delay ?? BigInt(0),
        scheduledAt: op.scheduledAt ?? BigInt(0),
        // Transaction hashes
        scheduledTx: op.scheduledTx,
        executedTx: op.executedTx,
        cancelledTx: op.cancelledTx,
        // Execution parameters for useTimelockWrite
        target: primaryTarget,
        value: primaryValue,
        data: primaryData,
        predecessor: op.predecessor ?? ZERO_BYTES32,
        salt: op.salt ?? ZERO_BYTES32,
        details: {
          fullId: op.id,
          fullProposer: op.scheduledBy,
          scheduled: formatAbsoluteTime(op.scheduledAt),
          callsDetails: isBatch
            ? subgraphCalls.map((c) => ({
                target: c.target,
                value: c.value > BigInt(0) ? `${formatEther(c.value)} RBTC` : '0',
                rawValue: c.value,
                data: c.data,
                signature: c.signature,
              }))
            : primaryTarget && primaryValue !== null
              ? [
                  {
                    target: primaryTarget,
                    value:
                      primaryValue > BigInt(0)
                        ? `${formatEther(primaryValue)} RBTC`
                        : '0',
                    rawValue: primaryValue,
                    data: primaryData,
                    signature: null,
                  },
                ]
              : [],
        },
      }

      return uiOperation
    })
  }, [subgraphOperations, timelockAddress])

  // Filter operations by search query (client-side)
  const clientFilteredOperations = useMemo(() => {
    if (!textSearch) return operations
    return operations.filter((op) =>
      op.id.toLowerCase().includes(textSearch) ||
      op.proposer.toLowerCase().includes(textSearch) ||
      op.details?.fullId.toLowerCase().includes(textSearch) ||
      op.details?.fullProposer.toLowerCase().includes(textSearch)
    )
  }, [operations, textSearch])

  const resultsCount = useMemo(() => {
    const skip = pageIndex * pageSize
    const showing = clientFilteredOperations.length
    const from = showing === 0 ? 0 : skip + 1
    const to = skip + showing
    return {
      showing,
      total: operations.length,
      from,
      to,
    }
  }, [clientFilteredOperations.length, operations.length, pageIndex, pageSize])

  const canPrevPage = pageIndex > 0
  const canNextPage = Boolean(subgraphOperations && subgraphOperations.length === pageSize)

  const activeFilters = useMemo(() => {
    const items: Array<{ key: string; label: string; onClear: () => void }> = []
    if (selectedFilter !== 'All') {
      items.push({
        key: 'status',
        label: `Status: ${selectedFilter}`,
        onClear: () => setSelectedFilter('All'),
      })
    }
    if (normalizedAddressQuery) {
      items.push({
        key: 'address',
        label: `Address: ${shortenAddress(normalizedAddressQuery)}`,
        onClear: () => setSearchQuery(''),
      })
    } else if (textSearch) {
      items.push({
        key: 'search',
        label: `Search: ${searchQuery.trim()}`,
        onClear: () => setSearchQuery(''),
      })
    }
    if (dateFrom || dateTo) {
      const label = `Date: ${dateFrom || '…'} → ${dateTo || '…'}`
      items.push({
        key: 'date',
        label,
        onClear: () => {
          setDateFrom('')
          setDateTo('')
        },
      })
    }
    return items
  }, [dateFrom, dateTo, normalizedAddressQuery, searchQuery, selectedFilter, textSearch])

  const clearAllFilters = () => {
    setSelectedFilter('All')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'bg-status-ready'
      case 'Pending':
        return 'bg-status-pending'
      case 'Executed':
        return 'bg-status-executed'
      case 'Canceled':
        return 'bg-status-canceled'
      default:
        return 'bg-border-dark'
    }
  }

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'text-status-ready'
      case 'Pending':
        return 'text-status-pending'
      case 'Executed':
        return 'text-status-executed'
      case 'Canceled':
        return 'text-status-canceled'
      default:
        return 'text-text-dark-secondary'
    }
  }

  const handleDetailsClick = (id: string) => {
    setSelectedOperationId((prev) => (prev === id ? null : id))
  }

  const selectedOperation = useMemo(
    () => clientFilteredOperations.find((op) => op.id === selectedOperationId) ?? null,
    [clientFilteredOperations, selectedOperationId]
  )

  useEffect(() => {
    if (!selectedOperationId) return
    const stillVisible = clientFilteredOperations.some(
      (op) => op.id === selectedOperationId
    )
    if (!stillVisible) setSelectedOperationId(null)
  }, [clientFilteredOperations, selectedOperationId])

  useEffect(() => {
    if (configurations.length === 0 || !selected) {
      setSelectedOperationId(null)
    }
  }, [configurations.length, selected])

  const handleExecute = (id: string) => {
    // Find the operation by shortened ID
    const operation = operations.find((op) => op.id === id)
    if (!operation) {
      console.error('Operation not found:', id)
      return
    }

    // Validate operation has required parameters
    if (!operation.target || operation.value === null || !operation.data) {
      console.error('Operation missing required parameters for execution:', operation)
      return
    }

    // T111: Open simulation preview first
    setConfirmExecuteOperation(operation)
  }

  const handleCancel = (operation: Operation) => {
    // T082: Show confirmation dialog with operation details before submission
    setConfirmCancelOperation(operation)
  }

  const confirmCancel = () => {
    if (!confirmCancelOperation) return
    // Ensure previous cancel mutation state doesn't bleed into the next one.
    // Note: Modal is closed via useEffect when isCancelSuccess becomes true
    resetCancel()
    setActiveCancelOperationId(confirmCancelOperation.fullId)
    cancel(confirmCancelOperation.fullId)
  }

  const confirmExecute = () => {
    if (!confirmExecuteOperation) return
    // Execute the operation using useTimelockWrite
    // Note: Modal is closed via useEffect when isExecuteSuccess becomes true

    const isBatch = confirmExecuteOperation.calls > 1

    if (isBatch && confirmExecuteOperation.details?.callsDetails) {
      // Batch operation - pass arrays to trigger executeBatch()
      const callsDetails = confirmExecuteOperation.details.callsDetails
      execute({
        targets: callsDetails.map((c) => c.target as Address),
        values: callsDetails.map((c) => c.rawValue),
        payloads: callsDetails.map((c) => (c.data || '0x') as `0x${string}`),
        predecessor: confirmExecuteOperation.predecessor,
        salt: confirmExecuteOperation.salt,
      })
    } else {
      // Single operation - pass single values to trigger execute()
      execute({
        target: confirmExecuteOperation.target!,
        value: confirmExecuteOperation.value!,
        data: confirmExecuteOperation.data!,
        predecessor: confirmExecuteOperation.predecessor,
        salt: confirmExecuteOperation.salt,
      })
    }
  }

  const formatTargets = (targets: string[]) => {
    if (targets.length <= 1) return targets[0] || ''
    return `${targets[0]}, +${targets.length - 1} more`
  }

  return (
    <>
      {configurations.length === 0 ? (
        <TimelockExplorerEmptyState
          icon="playlist_add"
          title="No timelocks configured yet"
          body="Add a timelock configuration in Settings to start monitoring queued and executed governance actions."
          ctaHref="/settings"
          ctaLabel="Go to Settings"
          docsUrl={docsUrl}
        />
      ) : !selected ? (
        <TimelockExplorerEmptyState
          icon="warning"
          title="Select a timelock to explore operations"
          body="Choose an active timelock from the header selector to load governance operations for that controller."
          ctaHref="/settings"
          ctaLabel="Manage timelocks in Settings"
          docsUrl={docsUrl}
        />
      ) : (
        <>
      {/* T111: Execute simulation preview dialog */}
      {confirmExecuteOperation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="execute-dialog-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmExecuteOperation(null)
          }}
        >
          <div className="w-full max-w-xl rounded-lg border border-border-dark bg-surface-dark p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="execute-dialog-title"
                  className="text-xl font-bold text-text-dark-primary"
                >
                  Confirm execution
                </h3>
                <p className="mt-1 text-sm text-text-dark-secondary">
                  We’ll run a simulation (eth_call) first to preview whether the
                  transaction is likely to succeed.
                </p>
              </div>
              <button
                className="text-text-dark-secondary hover:text-text-dark-primary"
                onClick={() => setConfirmExecuteOperation(null)}
                aria-label="Close execute confirmation dialog"
                ref={executeDialogCloseRef}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-md bg-background-dark p-4 font-mono text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Operation ID</span>
                <span className="text-text-dark-primary break-all">
                  {confirmExecuteOperation.details?.fullId ??
                    confirmExecuteOperation.fullId}
                </span>
              </div>

              {/* Show all calls for batch operations, or single call details */}
              {confirmExecuteOperation.calls > 1 &&
              confirmExecuteOperation.details?.callsDetails ? (
                <div className="space-y-3">
                  <div className="flex justify-between gap-3">
                    <span className="text-text-dark-secondary">Calls</span>
                    <span className="text-text-dark-primary">
                      {confirmExecuteOperation.calls}
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {confirmExecuteOperation.details.callsDetails.map(
                      (call, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-border-dark/60 bg-surface p-3 space-y-2"
                        >
                          <div className="text-xs font-semibold text-text-dark-secondary">
                            Call {idx + 1}
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-text-dark-secondary text-xs">
                              Target
                            </span>
                            <span className="text-text-dark-primary break-all text-xs">
                              {call.target}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-text-dark-secondary text-xs">
                              Value
                            </span>
                            <span className="text-text-dark-primary break-all text-xs">
                              {call.rawValue > BigInt(0)
                                ? `${formatEther(call.rawValue)} RBTC`
                                : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-text-dark-secondary text-xs">
                              Calldata
                            </span>
                            <span className="text-text-dark-primary break-all text-xs">
                              {call.data ?? '—'}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-dark-secondary">Target</span>
                    <span className="text-text-dark-primary break-all">
                      {confirmExecuteOperation.target ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-dark-secondary">Value</span>
                    <span className="text-text-dark-primary break-all">
                      {confirmExecuteOperation.value === null
                        ? '—'
                        : confirmExecuteOperation.value > BigInt(0)
                          ? `${formatEther(confirmExecuteOperation.value)} RBTC`
                          : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-dark-secondary">Calldata</span>
                    <span className="text-text-dark-primary break-all">
                      {confirmExecuteOperation.data ?? '—'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* FR-031: explicit call summary with decoded calldata (when available) */}
            {confirmExecuteOperation.calls > 1 &&
            confirmExecuteOperation.details?.callsDetails ? (
              // Batch operation - show summary for each call
              <div className="mt-4 rounded border border-border-dark bg-background-dark p-4 text-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="font-semibold text-text-dark-primary">
                    Call summaries ({confirmExecuteOperation.calls})
                  </span>
                  {isDecodingExecute && (
                    <span className="text-text-dark-secondary text-xs">
                      Decoding...
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {confirmExecuteOperation.details.callsDetails.map(
                    (call, idx) => {
                      const decoded = decodedBatchCalls[idx]
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-border-dark/60 bg-surface p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-text-dark-secondary">
                              Call {idx + 1}
                            </span>
                            {decoded ? (
                              isVerifiedBlockscout(decoded) ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200">
                                  Unverified
                                </span>
                              )
                            ) : null}
                          </div>
                          <div className="flex justify-between gap-3 font-mono text-xs">
                            <span className="text-text-dark-secondary">
                              Function
                            </span>
                            <span className="text-text-dark-primary break-all text-right">
                              {decoded
                                ? decoded.signature || decoded.functionName
                                : call.signature || '—'}
                            </span>
                          </div>
                          {isVerifiedBlockscout(decoded) &&
                          decoded &&
                          decoded.params.length > 0 ? (
                            <div className="mt-2">
                              <div className="text-[10px] font-bold uppercase text-text-dark-secondary mb-1">
                                Arguments
                              </div>
                              <div className="space-y-1 text-[10px]">
                                {decoded.params.map((p, pi) => (
                                  <div
                                    key={pi}
                                    className="rounded border border-border-dark/40 bg-black/5 p-1.5"
                                  >
                                    <div className="text-text-dark-secondary">
                                      {p.name} ({p.type})
                                    </div>
                                    <pre className="whitespace-pre-wrap wrap-break-word text-text-dark-primary">
                                      {stringifyValue(p.value)}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {call.data ? (
                            <div className="pt-1">
                              <Link
                                href={`/decoder?calldata=${encodeURIComponent(
                                  call.data
                                )}&contractAddress=${encodeURIComponent(
                                  call.target
                                )}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline underline-offset-4"
                              >
                                Open in Decoder
                                <span className="material-symbols-outlined text-xs!">
                                  open_in_new
                                </span>
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      )
                    }
                  )}
                </div>
              </div>
            ) : (
              // Single operation - existing behavior
              <div className="mt-4 rounded border border-border-dark bg-background-dark p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-text-dark-primary">
                    Call summary
                  </span>
                  {isVerifiedBlockscout(decodedExecute) ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
                      Verified contract
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200">
                      Unverified - showing raw hex
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2 font-mono text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-text-dark-secondary">Function</span>
                    <span className="text-text-dark-primary break-all text-right">
                      {isDecodingExecute ? (
                        'Decoding…'
                      ) : decodedExecute ? (
                        decodedExecute.signature || decodedExecute.functionName
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  {executeDecodeError ? (
                    <div className="text-xs text-red-300">
                      Decode failed: {executeDecodeError}
                    </div>
                  ) : null}

                  {/* Only show typed args when we have Blockscout-verified ABI */}
                  {isVerifiedBlockscout(decodedExecute) &&
                  decodedExecute &&
                  decodedExecute.params.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs font-bold uppercase text-text-dark-secondary mb-1">
                        Arguments
                      </div>
                      <div className="space-y-2 text-xs">
                        {decodedExecute.params.map((p, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border-dark/60 bg-surface p-2"
                          >
                            <div className="text-text-dark-secondary">
                              {p.name} ({p.type})
                            </div>
                            <pre className="whitespace-pre-wrap wrap-break-word text-text-dark-primary">
                              {stringifyValue(p.value)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {confirmExecuteOperation.data ? (
                    <div className="pt-2">
                      <Link
                        href={`/decoder?calldata=${encodeURIComponent(
                          confirmExecuteOperation.data
                        )}&contractAddress=${encodeURIComponent(
                          confirmExecuteOperation.target ?? ''
                        )}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
                      >
                        Open in Decoder
                        <span className="material-symbols-outlined text-base!">
                          open_in_new
                        </span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-4 rounded border border-border-dark bg-background-dark p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-text-dark-primary">
                  Simulation
                </span>
                {executeSimulation.status === 'pending' ? (
                  <span className="text-text-dark-secondary">Running…</span>
                ) : executeSimulation.status === 'success' ? (
                  <span
                    className="text-green-300"
                    title="Result of a dry-run simulation (eth_call). It helps catch obvious failures but cannot guarantee final on-chain success."
                  >
                    Likely succeeds
                  </span>
                ) : executeSimulation.status === 'error' ? (
                  <span
                    className="text-red-300"
                    title="Result of a dry-run simulation (eth_call). It helps catch obvious failures but cannot guarantee final on-chain success."
                  >
                    May fail
                  </span>
                ) : (
                  <span className="text-text-dark-secondary">—</span>
                )}
              </div>
              {executeSimulation.status === 'error' ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-300 hover:underline">
                    Show error details
                  </summary>
                  <p className="mt-2 text-red-300 wrap-break-word text-xs">
                    {executeSimulation.message}
                  </p>
                </details>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-md border border-border-dark bg-transparent px-4 py-2 text-sm font-semibold text-text-dark-secondary hover:bg-surface-elevated/40"
                onClick={() => setConfirmExecuteOperation(null)}
                disabled={isExecuting}
              >
                Close
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  isExecuting
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : hasExecutorRole
                      ? 'bg-status-ready/20 text-status-ready hover:bg-status-ready/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                }`}
                onClick={confirmExecute}
                disabled={!hasExecutorRole || isCheckingExecutorRole || isExecuting || executeSimulation.status === 'pending'}
                title={
                  isExecuting
                    ? 'Transaction pending...'
                    : isCheckingExecutorRole
                      ? 'Checking permissions...'
                      : !hasExecutorRole
                        ? 'Your wallet does not have the EXECUTOR_ROLE'
                        : executeSimulation.status === 'pending'
                          ? 'Waiting for simulation...'
                          : 'Execute this operation'
                }
              >
                {isExecuting ? 'Executing…' : 'Execute operation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* T082: Cancel confirmation dialog */}
      {confirmCancelOperation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmCancelOperation(null)
          }}
        >
          <div className="w-full max-w-xl rounded-lg border border-border-dark bg-surface-dark p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="cancel-dialog-title"
                  className="text-xl font-bold text-text-dark-primary"
                >
                  Confirm cancellation
                </h3>
                <p className="mt-1 text-sm text-text-dark-secondary">
                  This will submit a transaction calling <code>cancel(id)</code> on the timelock.
                </p>
              </div>
              <button
                className="text-text-dark-secondary hover:text-text-dark-primary"
                onClick={() => setConfirmCancelOperation(null)}
                aria-label="Close cancel confirmation dialog"
                ref={cancelDialogCloseRef}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-md bg-background-dark p-4 font-mono text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Operation ID</span>
                <span className="text-text-dark-primary break-all">
                  {confirmCancelOperation.details?.fullId ??
                    confirmCancelOperation.fullId}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Proposer</span>
                <span className="text-text-dark-primary break-all">
                  {confirmCancelOperation.details?.fullProposer ??
                    confirmCancelOperation.proposer}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Status</span>
                <span className="text-text-dark-primary">
                  {confirmCancelOperation.status}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-dark-secondary">Targets</span>
                <span className="text-text-dark-primary break-all">
                  {confirmCancelOperation.targets.join(', ') || '—'}
                </span>
              </div>
            </div>

            {/* T111: cancel simulation */}
            <div className="mt-4 rounded border border-border-dark bg-background-dark p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-text-dark-primary">
                  Simulation
                </span>
                {cancelSimulation.status === 'pending' ? (
                  <span className="text-text-dark-secondary">Running…</span>
                ) : cancelSimulation.status === 'success' ? (
                  <span
                    className="text-green-300"
                    title="Result of a dry-run simulation (eth_call). It helps catch obvious failures but cannot guarantee final on-chain success."
                  >
                    Likely succeeds
                  </span>
                ) : cancelSimulation.status === 'error' ? (
                  <span
                    className="text-red-300"
                    title="Result of a dry-run simulation (eth_call). It helps catch obvious failures but cannot guarantee final on-chain success."
                  >
                    May fail
                  </span>
                ) : (
                  <span className="text-text-dark-secondary">—</span>
                )}
              </div>
              {cancelSimulation.status === 'error' ? (
                <p className="mt-2 text-red-300 wrap-break-word">
                  {cancelSimulation.message}
                </p>
              ) : null}
            </div>

            {isCancelError && cancelError ? (
              <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {formatTxError(cancelError)}
              </div>
            ) : null}

            {isCancelSuccess && cancelTxHash ? (
              <div className="mt-4 rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
                Cancelled successfully. Tx:{' '}
                <span className="font-mono break-all">{cancelTxHash}</span>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-md border border-border-dark bg-transparent px-4 py-2 text-sm font-semibold text-text-dark-secondary hover:bg-surface-elevated/40"
                onClick={() => setConfirmCancelOperation(null)}
                disabled={isCancelling}
              >
                Close
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  isCancelling
                    ? 'bg-primary/20 text-primary cursor-wait'
                    : hasCancellerRole
                      ? 'bg-status-canceled/20 text-status-canceled hover:bg-status-canceled/30'
                      : 'bg-border-dark text-text-dark-secondary cursor-not-allowed opacity-50'
                }`}
                onClick={confirmCancel}
                disabled={!hasCancellerRole || isCheckingCancellerRole || isCancelling}
                title={
                  isCancelling
                    ? 'Transaction pending...'
                    : isCheckingCancellerRole
                      ? 'Checking permissions...'
                      : !hasCancellerRole
                        ? 'Your wallet does not have the CANCELLER_ROLE'
                        : 'Cancel this operation'
                }
              >
                {isCancelling ? 'Cancelling…' : 'Cancel operation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark px-6 py-4 mb-4">
        <div className="flex items-center gap-4 text-text-dark-primary">
          <div className="size-6 text-primary">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <h1 className="text-text-dark-primary text-lg font-bold leading-tight tracking-[-0.015em]">
            Timelock Management
          </h1>
        </div>
        <Link
          href="/new_proposal"
          className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:opacity-90 transition-opacity"
          aria-label="Schedule a new timelock operation"
          title="Schedule a new timelock operation"
        >
          <span className="material-symbols-outlined text-xl!">add</span>
          <span className="truncate">Schedule Operation</span>
        </Link>
      </header>

      <main className="flex flex-col gap-4 p-4 md:p-6">
        {/* Page Heading */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-text-dark-primary text-4xl font-black leading-tight tracking-[-0.033em]">
            Timelock Operations
          </h2>
        </div>
        <p className="text-text-dark-secondary text-sm">
          All scheduled, ready, executed, and canceled operations for the currently selected timelock.
        </p>

        {/* Toolbar / Filters */}
        <div className="app-card flex flex-col gap-4 p-3 md:flex-row md:items-center md:justify-between">
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                'All',
                'Pending',
                'Ready',
                'Executed',
                'Canceled',
              ] as OperationStatus[]
            ).map((filter) => (
              <div
                key={filter}
                className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full text-sm font-medium leading-normal transition-colors ${
                  selectedFilter === filter
                    ? 'bg-primary text-white'
                    : 'bg-border-dark text-text-dark-primary hover:bg-surface-elevated'
                }`}
              >
                <button
                  type="button"
                  className="flex h-full items-center gap-x-2 rounded-full px-4 outline-none"
                  onClick={() => setSelectedFilter(filter)}
                >
                  {filter}
                </button>
                {filter !== 'All' ? (
                  <span className="pr-2">
                    <TooltipIcon
                      ariaLabel={`What does ${filter} mean?`}
                      text={STATUS_TOOLTIPS[filter]}
                    />
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {/* Search Bar & Advanced Filter */}
          <div className="flex items-center gap-2">
            <div className="grow">
              <label className="flex flex-col min-w-40 h-11 w-full">
                <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                  <div className="text-text-dark-secondary flex items-center justify-center rounded-l-lg border-r-0 border-none bg-border-dark pl-3">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border-l-0 border-none bg-border-dark text-base font-normal leading-normal text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-0 h-full px-3"
                    placeholder="Search by ID, or paste an address…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </label>
            </div>
            {/* T092: Date range */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 rounded-lg border border-border-dark bg-border-dark px-3 text-sm text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-2 focus:ring-primary/20"
              aria-label="Date from"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 rounded-lg border border-border-dark bg-border-dark px-3 text-sm text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-2 focus:ring-primary/20"
              aria-label="Date to"
            />
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-dark bg-border-dark text-text-dark-secondary hover:bg-surface-elevated transition-colors"
              type="button"
              aria-label="Show advanced filters"
              title="Show advanced filters"
            >
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        <p className="text-text-dark-secondary text-xs">
          Use these filters to focus on actions that still need review or execution, or to audit past executions and cancellations.
        </p>

        {/* T092: Date range validation error */}
        {dateRangeError ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
            {dateRangeError}
          </div>
        ) : null}

        {/* T093: Active filter badges */}
        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-2 rounded-full bg-border-dark px-3 py-1 text-sm text-text-dark-primary"
              >
                {f.label}
                <button
                  className="text-text-dark-secondary hover:text-text-dark-primary"
                  onClick={f.onClear}
                  aria-label={`Clear ${f.key} filter`}
                >
                  <span className="material-symbols-outlined text-base!">close</span>
                </button>
              </span>
            ))}
            <button
              className="text-sm font-semibold text-text-dark-secondary hover:text-text-dark-primary underline underline-offset-4"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}

        {/* T094: Results count */}
        {!isLoading && !isError ? (
          <div className="text-sm text-text-dark-secondary">
            Showing {resultsCount.from}–{resultsCount.to} operations on this page
          </div>
        ) : null}

        {/* T116: Pagination controls */}
        {!isLoading && !isError ? (
          <div className="app-card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2 text-sm text-text-dark-secondary">
              <span>Rows per page</span>
              <select
                className="h-9 rounded-lg border border-border-dark bg-border-dark px-3 text-sm text-text-dark-primary focus:outline-0 focus:ring-2 focus:ring-primary/20"
                value={pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setPageSize(next)
                  setPageIndex(0)
                }}
                aria-label="Rows per page"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="ml-2">
                Page {pageIndex + 1}
                {canNextPage ? '+' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold transition-colors ${
                  canPrevPage
                    ? 'bg-border-dark text-text-dark-primary hover:bg-surface-elevated'
                    : 'bg-border-dark text-text-dark-secondary opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canPrevPage && setPageIndex((p) => Math.max(0, p - 1))}
                disabled={!canPrevPage}
                aria-label="Previous page"
              >
                Prev
              </button>
              <button
                className={`flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold transition-colors ${
                  canNextPage
                    ? 'bg-border-dark text-text-dark-primary hover:bg-surface-elevated'
                    : 'bg-border-dark text-text-dark-secondary opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canNextPage && setPageIndex((p) => p + 1)}
                disabled={!canNextPage}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {/* Error State - Execute Transaction Failed */}
        {isExecuteError && executeError && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <span className="material-symbols-outlined text-red-500 text-3xl">
                  error
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-red-500 font-bold text-lg mb-2">
                  Execution Failed
                </h3>
                <p className="text-text-dark-primary text-sm mb-2">
                  The operation execution transaction failed. This could be due to:
                </p>
                <ul className="text-text-dark-secondary text-sm list-disc list-inside mb-4 space-y-1">
                  <li>Insufficient permissions (missing EXECUTOR_ROLE)</li>
                  <li>Operation not yet ready (waiting period not finished)</li>
                  <li>Network congestion or gas issues</li>
                  <li>Contract state changed since operation was scheduled</li>
                </ul>
                <details className="text-text-dark-secondary text-xs font-mono bg-background-dark p-3 rounded">
                  <summary className="cursor-pointer font-bold mb-2">Error Details</summary>
                  <pre className="whitespace-pre-wrap wrap-break-word">
                    {formatTxError(executeError)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Success State - Execute Transaction Succeeded */}
        {isExecuteSuccess && executeTxHash && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <span className="material-symbols-outlined text-green-500 text-3xl">
                  check_circle
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-green-500 font-bold text-lg mb-2">
                  Execution Successful!
                </h3>
                <p className="text-text-dark-primary text-sm mb-4">
                  The operation has been executed successfully. The transaction has been confirmed on the blockchain.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`${getBlockscoutExplorerUrl(chainId)}/tx/${executeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-green-500/20 text-green-500 text-sm font-medium hover:bg-green-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      open_in_new
                    </span>
                    View transaction on Blockscout
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State - Subgraph Unavailable */}
        {isError && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <span className="material-symbols-outlined text-yellow-500 text-3xl">
                  warning
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-yellow-500 font-bold text-lg mb-2">
                  Subgraph Unavailable
                </h3>
                <p className="text-text-dark-primary text-sm mb-4">
                  The Graph subgraph is currently unavailable. This may be due to network issues,
                  subgraph indexing delays, or maintenance.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => refetch()}
                    className="flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-yellow-500/20 text-yellow-500 text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      refresh
                    </span>
                    Try Again
                  </button>
                  <a
                    href="https://thegraph.com/studio/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-border-dark text-text-dark-secondary text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      open_in_new
                    </span>
                    The Graph Studio
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="app-card p-6">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-28" />
            </div>
            <div className="mt-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`op-skel-${i}`}
                  className="min-w-[980px] border-b border-border-dark px-6 py-4"
                >
                  <div className="grid grid-cols-[minmax(360px,3.4fr)_minmax(130px,1fr)_minmax(190px,1.2fr)_minmax(180px,1.2fr)] items-center gap-6">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-9 w-16" />
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && clientFilteredOperations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-text-dark-primary text-lg font-medium">No operations found</p>
            <p className="text-text-dark-secondary text-sm mt-2">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'No operations have been scheduled yet'}
            </p>
          </div>
        )}

        {/* Operations Table */}
        {!isLoading && !isError && clientFilteredOperations.length > 0 && (
          <VirtualizedOperationsList
            operations={clientFilteredOperations}
            selectedOperationId={selectedOperationId}
            onDetailsClick={handleDetailsClick}
            onExecute={handleExecute}
            onCancel={handleCancel}
            hasExecutorRole={hasExecutorRole}
            isCheckingExecutorRole={isCheckingExecutorRole}
            isExecuting={isExecuting}
            isExecuteSuccess={isExecuteSuccess}
            isExecuteError={isExecuteError}
            hasCancellerRole={hasCancellerRole}
            isCheckingCancellerRole={isCheckingCancellerRole}
            isCancelling={isCancelling}
            isCancelSuccess={isCancelSuccess}
            isCancelError={isCancelError}
            activeCancelOperationId={activeCancelOperationId}
            minDelay={minDelay}
            getStatusColor={getStatusColor}
            getStatusTextColor={getStatusTextColor}
            formatTargets={formatTargets}
            formatAbsoluteTime={formatAbsoluteTime}
          />
        )}
      </main>
        </>
      )}
      {selected && selectedOperation ? (
        <OperationDetailsDrawer
          operation={selectedOperation}
          isExpanded
          onClose={() => setSelectedOperationId(null)}
          onDetailsClick={handleDetailsClick}
          onExecute={handleExecute}
          onCancel={handleCancel}
          hasExecutorRole={hasExecutorRole}
          isCheckingExecutorRole={isCheckingExecutorRole}
          isExecuting={isExecuting}
          isExecuteSuccess={isExecuteSuccess}
          isExecuteError={isExecuteError}
          hasCancellerRole={hasCancellerRole}
          isCheckingCancellerRole={isCheckingCancellerRole}
          isCancelling={
            isCancelling &&
            activeCancelOperationId !== null &&
            activeCancelOperationId === selectedOperation.fullId
          }
          isCancelSuccess={
            isCancelSuccess &&
            activeCancelOperationId !== null &&
            activeCancelOperationId === selectedOperation.fullId
          }
          isCancelError={
            isCancelError &&
            activeCancelOperationId !== null &&
            activeCancelOperationId === selectedOperation.fullId
          }
          minDelay={minDelay}
          getStatusColor={getStatusColor}
          getStatusTextColor={getStatusTextColor}
          formatTargets={formatTargets}
          formatAbsoluteTime={formatAbsoluteTime}
        />
      ) : null}
    </>
  )
}

function VirtualizedOperationsList(props: {
  operations: Operation[]
  selectedOperationId: string | null
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
  activeCancelOperationId: `0x${string}` | null
  minDelay?: bigint
  getStatusColor: (status: string) => string
  getStatusTextColor: (status: string) => string
  formatTargets: (targets: string[]) => string
  formatAbsoluteTime: (timestamp: bigint) => string
}) {
  const parentRef = React.useRef<HTMLDivElement | null>(null)
  // Keep rows non-virtualized for this explorer table because row heights are
  // dynamic (LLM summaries + expanded details) and absolute-position virtualization
  // can cause overlap while heights are recalculated.
  const shouldVirtualize = false
  const shouldPrewarm = process.env.NODE_ENV !== 'test'
  const PREWARM_VISIBLE_ROWS = 25

  const rowVirtualizer = useVirtualizer({
    count: props.operations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  // When an accordion row expands/collapses, its height changes.
  // Ensure the virtualizer recalculates offsets so rows don't overlap.
  React.useLayoutEffect(() => {
    if (!shouldVirtualize) return
    rowVirtualizer.measure()
  }, [props.selectedOperationId, rowVirtualizer, shouldVirtualize])

  const prewarmIndexSet = React.useMemo(() => {
    if (!shouldPrewarm) return new Set<number>()
    // Prewarm from the top of the current page so non-expanded rows still get
    // human summaries without needing explicit row expansion.
    return new Set(
      props.operations
        .slice(0, PREWARM_VISIBLE_ROWS)
        .map((_, index) => index)
    )
  }, [PREWARM_VISIBLE_ROWS, props.operations, shouldPrewarm])

  return (
    <div className="app-card w-full overflow-x-auto">
      <div role="table" aria-label="Timelock operations" className="w-full">
        {/* Header */}
        <div
          role="rowgroup"
          className="min-w-[980px] border-b border-border-dark text-xs uppercase text-text-dark-secondary"
        >
          <div role="row" className="grid grid-cols-[minmax(360px,3.4fr)_minmax(130px,1fr)_minmax(190px,1.2fr)_minmax(180px,1.2fr)] px-6 py-4">
            <div role="columnheader">Summary</div>
            <div role="columnheader" className="flex items-center gap-1">
              Status{' '}
              <span className="material-symbols-outlined text-base!">swap_vert</span>
            </div>
            <div role="columnheader" className="flex items-center gap-1">
              Time / Countdown <span className="material-symbols-outlined text-base!">swap_vert</span>
            </div>
            <div role="columnheader" className="text-right">
              Actions
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          ref={parentRef}
          className="max-h-[70vh] overflow-auto"
          role="rowgroup"
        >
          {shouldVirtualize ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const operation = props.operations[virtualRow.index]
                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <OperationRow
                      operation={operation}
                      isExpanded={props.selectedOperationId === operation.id}
                      prewarmExplanation={prewarmIndexSet.has(virtualRow.index)}
                      onDetailsClick={props.onDetailsClick}
                      onExecute={props.onExecute}
                      onCancel={props.onCancel}
                      hasExecutorRole={props.hasExecutorRole}
                      isCheckingExecutorRole={props.isCheckingExecutorRole}
                      isExecuting={props.isExecuting}
                      isExecuteSuccess={props.isExecuteSuccess}
                      isExecuteError={props.isExecuteError}
                      hasCancellerRole={props.hasCancellerRole}
                      isCheckingCancellerRole={props.isCheckingCancellerRole}
                      isCancelling={
                        props.isCancelling &&
                        props.activeCancelOperationId !== null &&
                        props.activeCancelOperationId === operation.fullId
                      }
                      isCancelSuccess={
                        props.isCancelSuccess &&
                        props.activeCancelOperationId !== null &&
                        props.activeCancelOperationId === operation.fullId
                      }
                      isCancelError={
                        props.isCancelError &&
                        props.activeCancelOperationId !== null &&
                        props.activeCancelOperationId === operation.fullId
                      }
                      minDelay={props.minDelay}
                      getStatusColor={props.getStatusColor}
                      getStatusTextColor={props.getStatusTextColor}
                      formatTargets={props.formatTargets}
                      formatAbsoluteTime={props.formatAbsoluteTime}
                      showExpandedContent={false}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="w-full">
              {props.operations.map((operation, index) => (
                <OperationRow
                  key={operation.fullId}
                  operation={operation}
                  isExpanded={props.selectedOperationId === operation.id}
                  prewarmExplanation={prewarmIndexSet.has(index)}
                  onDetailsClick={props.onDetailsClick}
                  onExecute={props.onExecute}
                  onCancel={props.onCancel}
                  hasExecutorRole={props.hasExecutorRole}
                  isCheckingExecutorRole={props.isCheckingExecutorRole}
                  isExecuting={props.isExecuting}
                  isExecuteSuccess={props.isExecuteSuccess}
                  isExecuteError={props.isExecuteError}
                  hasCancellerRole={props.hasCancellerRole}
                  isCheckingCancellerRole={props.isCheckingCancellerRole}
                  isCancelling={
                    props.isCancelling &&
                    props.activeCancelOperationId !== null &&
                    props.activeCancelOperationId === operation.fullId
                  }
                  isCancelSuccess={
                    props.isCancelSuccess &&
                    props.activeCancelOperationId !== null &&
                    props.activeCancelOperationId === operation.fullId
                  }
                  isCancelError={
                    props.isCancelError &&
                    props.activeCancelOperationId !== null &&
                    props.activeCancelOperationId === operation.fullId
                  }
                  minDelay={props.minDelay}
                  getStatusColor={props.getStatusColor}
                  getStatusTextColor={props.getStatusTextColor}
                  formatTargets={props.formatTargets}
                  formatAbsoluteTime={props.formatAbsoluteTime}
                  showExpandedContent={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OperationDetailsDrawer(
  props: React.ComponentProps<typeof OperationRow> & { onClose: () => void }
) {
  const { operation, onClose, ...rowProps } = props

  React.useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Operation details"
        className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-border-dark bg-background shadow-2xl lg:w-[70vw]"
      >
        <div className="sticky top-0 z-10 border-b border-border-dark bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-dark-secondary">
                Operation Detail
              </p>
              <p className="truncate font-mono text-text-dark-primary">{operation.id}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-text-dark-secondary hover:bg-surface-elevated hover:text-text-dark-primary"
              aria-label="Close operation details panel"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="p-6">
          <OperationRow
            {...rowProps}
            operation={operation}
            isExpanded
            detailMode="drawer"
            showExpandedContent
          />
        </div>
      </aside>
    </>
  )
}

export default OperationsExplorerView
