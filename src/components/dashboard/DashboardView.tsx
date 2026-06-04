import React from 'react'
import Link from 'next/link'
import { type Address } from 'viem'
import { useChainId } from 'wagmi'
import { rootstock, rootstockTestnet } from 'wagmi/chains'
import { useOperations, useOperationsSummary } from '@/hooks/useOperations'
import { useRoles } from '@/hooks/useRoles'
import { ROLE_NAMES, TIMELOCK_ROLES } from '@/lib/constants'
import { useTimelocks } from '@/hooks/useTimelocks'
import { type Operation } from '@/types/operation'

const DEFAULT_DOCS_URL = 'https://david-personal.gitbook.io/timelock-manager/'

const shortenAddress = (value?: string | null): string => {
  if (!value) return 'Unknown'
  if (value.length < 12) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

const formatAbsoluteDate = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

const formatRelativeFromNow = (timestamp: bigint): string => {
  const now = Math.floor(Date.now() / 1000)
  const diff = Number(timestamp) - now
  const abs = Math.abs(diff)

  const days = Math.floor(abs / 86400)
  const hours = Math.floor((abs % 86400) / 3600)
  const minutes = Math.floor((abs % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes}m`)
  if (parts.length === 0) parts.push('now')

  const amount = parts.join(' ')
  if (amount === 'now') return diff >= 0 ? 'in moments' : 'just now'
  return diff >= 0 ? `in ${amount}` : `${amount} ago`
}

const getStatusMeta = (status: Operation['status']) => {
  switch (status) {
    case 'READY':
      return { label: 'Ready', badgeClass: 'bg-status-ready/15 text-status-ready' }
    case 'EXECUTED':
      return { label: 'Executed', badgeClass: 'bg-status-executed/15 text-status-executed' }
    case 'CANCELLED':
      return { label: 'Cancelled', badgeClass: 'bg-status-canceled/15 text-status-canceled' }
    default:
      return { label: 'Scheduled', badgeClass: 'bg-status-pending/15 text-status-pending' }
  }
}

const selectorFromCalldata = (calldata?: string | null): string | null => {
  if (!calldata || calldata.length < 10 || calldata === '0x') return null
  return calldata.slice(0, 10)
}

const getOperationSummary = (operation: Operation): { title: string; subtitle: string } => {
  const calls = operation.calls ?? []
  const firstCall = calls[0]
  const firstSignature = firstCall?.signature?.trim()
  const target = firstCall?.target ?? operation.target ?? null

  if (calls.length > 1) {
    if (firstSignature) {
      return {
        title: `Batch operation (${calls.length} calls)`,
        subtitle: `Starts with ${firstSignature} on ${shortenAddress(target)}`,
      }
    }
    return {
      title: `Batch operation (${calls.length} calls)`,
      subtitle: `Targets include ${shortenAddress(target)}`,
    }
  }

  if (firstSignature) {
    return {
      title: firstSignature,
      subtitle: `Target ${shortenAddress(target)}`,
    }
  }

  const selector = selectorFromCalldata(firstCall?.data ?? operation.data)
  if (selector) {
    return {
      title: `Operation ${selector}`,
      subtitle: `Target ${shortenAddress(target)}`,
    }
  }

  return {
    title: `Operation ${shortenAddress(operation.id)}`,
    subtitle: `Administrative update for ${shortenAddress(target)}`,
  }
}

const getOperationTimeCopy = (operation: Operation): { label: string; absolute: string } => {
  if (operation.status === 'READY') {
    return { label: 'Ready now', absolute: formatAbsoluteDate(operation.timestamp) }
  }

  if (operation.status === 'PENDING') {
    return {
      label: `Ready ${formatRelativeFromNow(operation.timestamp)}`,
      absolute: formatAbsoluteDate(operation.timestamp),
    }
  }

  if (operation.status === 'EXECUTED' && operation.executedAt) {
    return {
      label: `Executed ${formatRelativeFromNow(operation.executedAt)}`,
      absolute: formatAbsoluteDate(operation.executedAt),
    }
  }

  if (operation.status === 'CANCELLED' && operation.cancelledAt) {
    return {
      label: `Cancelled ${formatRelativeFromNow(operation.cancelledAt)}`,
      absolute: formatAbsoluteDate(operation.cancelledAt),
    }
  }

  return {
    label: 'Scheduled',
    absolute: formatAbsoluteDate(operation.scheduledAt),
  }
}

function DashboardInsightPanel({
  networkName,
  selectedAddress,
  docsUrl,
  proposerCount,
  executorCount,
  cancellerCount,
}: {
  networkName: string
  selectedAddress: string
  docsUrl: string
  proposerCount: number
  executorCount: number
  cancellerCount: number
}) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 p-6">
        <div className="relative z-10 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            Timelock Basics
          </p>
          <h3 className="text-lg font-semibold text-text-primary">
            Why this delay matters
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            Timelock delays make governance changes auditable before execution, giving proposers, cancellers, and users a review window.
          </p>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="app-button-secondary w-full justify-center"
          >
            Open Documentation
          </a>
        </div>
        <div className="pointer-events-none absolute -bottom-16 -right-10 size-36 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="app-card p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary">
          Security Context
        </h4>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Network</dt>
            <dd className="font-medium text-text-primary">{networkName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Timelock</dt>
            <dd className="font-mono text-xs text-text-primary">{shortenAddress(selectedAddress)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Proposers</dt>
            <dd className="font-medium text-text-primary">{proposerCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Executors</dt>
            <dd className="font-medium text-text-primary">{executorCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Cancellers</dt>
            <dd className="font-medium text-text-primary">{cancellerCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function DashboardIntroduction({ docsUrl }: { docsUrl: string }) {
  return (
    <section className="app-card p-6" role="region" aria-label="About timelock controller and dashboard usage">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="material-symbols-outlined text-base" aria-hidden="true">info</span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">About Timelock Governance</span>
        </div>
        <p className="text-sm leading-relaxed text-text-primary">
          A <strong>Timelock Controller</strong> delays governance actions before they execute on-chain. This gives contributors time to inspect what was scheduled and react before changes become active.
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          Use this dashboard for a high-signal overview, then move to Operations Explorer for execution and deep technical inspection.
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
    </section>
  )
}

function TimelockBasicsNote({ docsUrl }: { docsUrl: string }) {
  return (
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
            Once you configure and select a timelock, this app can show queued operations, ready actions, execution history, and role membership for that controller.
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
  )
}

function DashboardEmptyState({
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
    <div className="flex items-center justify-center py-12">
      <div className="app-card w-full max-w-2xl p-8 text-center">
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
        <TimelockBasicsNote docsUrl={docsUrl} />
      </div>
    </div>
  )
}

function OnboardingCard({
  icon,
  eyebrow,
  title,
  body,
  ctaHref,
  ctaLabel,
  note,
}: {
  icon: string
  eyebrow: string
  title: string
  body: string
  ctaHref: string
  ctaLabel: string
  note?: React.ReactNode
}) {
  return (
    <div className="app-card flex h-full flex-col p-6 text-left">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-xl font-bold text-text-primary">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary">{body}</p>
      {note ? (
        <p className="mt-4 text-xs leading-relaxed text-text-secondary">{note}</p>
      ) : null}
      <div className="mt-6">
        <Link href={ctaHref} className="app-button-primary w-full justify-center px-6">
          {ctaLabel}
        </Link>
      </div>
    </div>
  )
}

function DashboardOnboarding({ docsUrl }: { docsUrl: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary">
            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Welcome — let&apos;s get started</h2>
          <p className="mt-2 text-text-secondary">
            Choose how you want to begin. You can add a TimelockController you already manage,
            or deploy a brand new one directly from this app.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <OnboardingCard
            icon="add_link"
            eyebrow="Already have one"
            title="Add an existing timelock"
            body="Enter your TimelockController address and its subgraph URL to start monitoring operations, roles, and execution history."
            ctaHref="/settings"
            ctaLabel="Add a timelock"
            note={
              <>
                A subgraph indexes the contract&apos;s events so this app can show its
                operations. Don&apos;t have one yet?{' '}
                <Link
                  href="/subgraph/deploy"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Deploy a subgraph
                </Link>
                .
              </>
            }
          />

          <OnboardingCard
            icon="rocket_launch"
            eyebrow="Start fresh"
            title="Create a new timelock"
            body="Deploy a new OpenZeppelin TimelockController on Rootstock in a few clicks — no terminal required."
            ctaHref="/deploy_timelock"
            ctaLabel="Deploy a timelock"
          />
        </div>

        <TimelockBasicsNote docsUrl={docsUrl} />
      </div>
    </div>
  )
}

const DashboardView: React.FC = () => {
  const chainId = useChainId()
  const { configurations, selected } = useTimelocks()
  const timelockAddress = (selected?.address as Address | undefined) ?? undefined

  const { data: summary, isLoading, isError } = useOperationsSummary(timelockAddress)
  const { data: recentOperations, isLoading: recentLoading, isError: recentError } = useOperations(
    { timelockController: timelockAddress },
    {
      enabled: !!timelockAddress,
      pagination: { first: 6, skip: 0 },
      staleTime: 60_000,
      refetchInterval: 60_000,
    }
  )
  const { roles, isLoading: rolesLoading, isError: rolesError } = useRoles({
    timelockController: timelockAddress,
  })

  const networkName =
    chainId === rootstock.id
      ? 'Rootstock Mainnet'
      : chainId === rootstockTestnet.id
        ? 'Rootstock Testnet'
        : 'Unknown Network'
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL

  const proposerCount =
    roles?.find((role) => role.roleHash === TIMELOCK_ROLES.PROPOSER_ROLE)?.memberCount ?? 0
  const executorCount =
    roles?.find((role) => role.roleHash === TIMELOCK_ROLES.EXECUTOR_ROLE)?.memberCount ?? 0
  const cancellerCount =
    roles?.find((role) => role.roleHash === TIMELOCK_ROLES.CANCELLER_ROLE)?.memberCount ?? 0

  if (configurations.length === 0) {
    return <DashboardOnboarding docsUrl={docsUrl} />
  }

  if (!selected) {
    return (
      <DashboardEmptyState
        icon="warning"
        title="Select a timelock to view the dashboard"
        body="Choose an active timelock from the selector in the header to load governance activity."
        ctaHref="/settings"
        ctaLabel="Manage timelocks in Settings"
        docsUrl={docsUrl}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="app-card overflow-hidden">
        <div className="border-b border-border-color px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
                Governance Operations
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary">
                Dashboard
              </h1>
              <p className="text-sm text-text-secondary">
                Monitor current timelock activity and access configuration for the selected controller.
              </p>
            </div>
            <Link href="/new_proposal" className="app-button-primary !text-white">
              <span className="material-symbols-outlined mr-1 text-base !text-white">add_circle</span>
              <span className="!text-white">Schedule New Operation</span>
            </Link>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="app-panel flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-base">hub</span>
              {networkName}
            </span>
            <span className="hidden text-border-color sm:inline">•</span>
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-base">account_balance_wallet</span>
              {shortenAddress(selected.address as string)}
            </span>
          </div>
        </div>
      </section>

      {isError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
          <p className="text-sm text-danger">
            Failed to load operations data. Please check your connection and try again.
          </p>
        </div>
      ) : null}

      <DashboardIntroduction docsUrl={docsUrl} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">Pending</p>
            <span className="rounded-full bg-status-pending/15 px-2 py-0.5 text-xs font-semibold text-status-pending">
              Waiting
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 h-10 w-20 animate-pulse rounded bg-border-color" />
          ) : (
            <Link
              href="/operations_explorer?status=pending"
              className="mt-3 inline-block text-3xl font-bold text-text-primary hover:underline"
              aria-label="View pending operations in Operations Explorer"
            >
              {summary?.pending ?? 0}
            </Link>
          )}
          <p className="mt-1 text-xs text-text-secondary">Operations queued and waiting for delay.</p>
        </div>

        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">Ready</p>
            <span className="rounded-full bg-status-ready/15 px-2 py-0.5 text-xs font-semibold text-status-ready">
              Action Required
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 h-10 w-20 animate-pulse rounded bg-border-color" />
          ) : (
            <Link
              href="/operations_explorer?status=ready"
              className="mt-3 inline-block text-3xl font-bold text-text-primary hover:underline"
              aria-label="View ready operations in Operations Explorer"
            >
              {summary?.ready ?? 0}
            </Link>
          )}
          <p className="mt-1 text-xs text-text-secondary">Operations currently executable on-chain.</p>
        </div>

        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">Executed</p>
            <span className="rounded-full bg-status-executed/15 px-2 py-0.5 text-xs font-semibold text-status-executed">
              Complete
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 h-10 w-20 animate-pulse rounded bg-border-color" />
          ) : (
            <Link
              href="/operations_explorer?status=executed"
              className="mt-3 inline-block text-3xl font-bold text-text-primary hover:underline"
              aria-label="View executed operations in Operations Explorer"
            >
              {summary?.executed ?? 0}
            </Link>
          )}
          <p className="mt-1 text-xs text-text-secondary">Operations already finalized and executed.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="app-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Recent Operations</h2>
              <p className="text-xs text-text-secondary">Newest activity for the selected timelock.</p>
            </div>
            <Link href="/operations_explorer" className="text-sm font-medium text-primary hover:underline">
              View All
            </Link>
          </div>

          {recentError ? (
            <div className="p-5 text-sm text-danger">
              Failed to load recent operations.
            </div>
          ) : recentLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`recent-loading-${index}`} className="h-14 animate-pulse rounded-lg bg-surface-elevated/60" />
              ))}
            </div>
          ) : recentOperations && recentOperations.length > 0 ? (
            <div className="divide-y divide-border-color">
              {recentOperations.map((operation) => {
                const statusMeta = getStatusMeta(operation.status)
                const summaryCopy = getOperationSummary(operation)
                const timeCopy = getOperationTimeCopy(operation)
                return (
                  <div key={operation.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">{summaryCopy.title}</p>
                      <p className="truncate text-xs text-text-secondary">{summaryCopy.subtitle}</p>
                      <p className="mt-1 font-mono text-[11px] text-text-muted">{shortenAddress(operation.id)}</p>
                    </div>
                    <div className="w-full min-w-[200px] flex-1 text-xs text-text-secondary sm:w-auto">
                      <p className="font-medium text-text-primary">{timeCopy.label}</p>
                      <p>{timeCopy.absolute}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                      <Link
                        href={`/operations_explorer?operation=${operation.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-5 text-sm text-text-secondary">
              No operations have been indexed for this timelock yet.
            </div>
          )}
        </div>

        <DashboardInsightPanel
          networkName={networkName}
          selectedAddress={selected.address as string}
          docsUrl={docsUrl}
          proposerCount={proposerCount}
          executorCount={executorCount}
          cancellerCount={cancellerCount}
        />
      </section>

      <section className="app-card overflow-x-auto">
        <div className="border-b border-border-color px-5 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Role Overview</h2>
          <p className="text-xs text-text-secondary">
            Current members for key timelock roles. Open the Roles page for full history.
          </p>
        </div>
        {rolesError ? (
          <div className="p-5 text-sm text-danger">
            Failed to load roles data. Please check your connection and try again.
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/40 text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium" scope="col">
                  Role
                </th>
                <th className="px-5 py-3 font-medium" scope="col">
                  Role Hash
                </th>
                <th className="px-5 py-3 text-right font-medium" scope="col">
                  Members
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {rolesLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="h-5 w-32 animate-pulse rounded bg-border-color" />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="h-5 w-24 animate-pulse rounded bg-border-color" />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="ml-auto h-5 w-8 animate-pulse rounded bg-border-color" />
                    </td>
                  </tr>
                ))
              ) : roles && roles.length > 0 ? (
                roles.map((role) => {
                  const roleHashDisplay = `${role.roleHash.slice(0, 6)}...${role.roleHash.slice(-4)}`
                  const displayName = ROLE_NAMES[role.roleHash] || role.roleName || 'Unknown Role'

                  return (
                    <tr key={role.roleHash}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-text-primary">
                        {displayName}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-text-secondary">
                        {roleHashDisplay}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-text-primary">
                        <Link
                          href={`/permissions?role=${role.roleHash}`}
                          className="hover:underline focus-visible:underline underline-offset-4"
                          aria-label={`View ${displayName} role in Permissions`}
                        >
                          {role.memberCount}
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-center text-text-secondary">
                    No roles were found for this timelock yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default DashboardView
