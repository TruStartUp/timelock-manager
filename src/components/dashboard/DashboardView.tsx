import React from 'react'
import { type Address } from 'viem'
import { useChainId } from 'wagmi'
import { rootstock, rootstockTestnet } from 'wagmi/chains'
import Link from 'next/link'
import { useOperationsSummary } from '@/hooks/useOperations'
import { useRoles } from '@/hooks/useRoles'
import { ROLE_NAMES } from '@/lib/constants'
import { useTimelocks } from '@/hooks/useTimelocks'

const DEFAULT_DOCS_URL = 'https://david-personal.gitbook.io/timelock-manager/'

function DashboardIntro() {
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL
  return (
    <div className="app-card p-6" role="region" aria-label="About Timelock Controller and this app">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">info</span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">About</span>
        </div>
        <p className="text-text-primary text-sm leading-relaxed">
          A <strong>Timelock Controller</strong> is a smart contract that delays function calls on another contract for a set period. It is used in governance so that users can see planned changes and react before they take effect.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          For example, when a management team decides to change a parameter (e.g. a fee or a cap), the timelock gives everyone time to review the operation, run checks, and cancel or adjust it if an error is found—instead of the change taking effect immediately.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          If a malicious actor (e.g. a compromised proposer) schedules a harmful change—such as minting extra tokens or draining funds—the timelock does not execute it right away. The operation is visible to the community during the delay, so holders with the canceller role can cancel it, or users can exit the protocol before it executes.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          <strong>Timelock Manager</strong> is a governance interface for OpenZeppelin TimelockController contracts on Rootstock. Use it to schedule, review, execute, and cancel operations; manage roles; and decode calldata—all from one place.
        </p>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-sm font-medium hover:underline focus-visible:underline underline-offset-2"
        >
          Learn more in the docs
        </a>
      </div>
    </div>
  )
}

const DashboardView: React.FC = () => {
  const chainId = useChainId()
  const { configurations, selected } = useTimelocks()
  const timelockAddress = (selected?.address as Address | undefined) ?? undefined

  // Fetch operations summary from subgraph
  const { data: summary, isLoading, isError } = useOperationsSummary(timelockAddress)
  
  // Fetch roles summary from subgraph
  const { roles, isLoading: rolesLoading, isError: rolesError } = useRoles({
    timelockController: timelockAddress,
  })
  
  // Get network name
  const networkName = chainId === rootstock.id 
    ? 'Rootstock Mainnet' 
    : chainId === rootstockTestnet.id 
    ? 'Rootstock Testnet' 
    : 'Unknown Network'

  if (configurations.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <DashboardIntro />
        <div className="flex flex-col items-center justify-center py-16">
          <div className="app-card w-full max-w-2xl p-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">
                playlist_add
              </span>
            </div>
            <h2 className="text-text-primary text-2xl font-bold">
              No timelocks configured yet
            </h2>
            <p className="mt-2 text-text-secondary">
              Add a timelock configuration in Settings to start exploring operations and roles.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/settings"
                className="app-button-primary rounded-full px-6"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-8">
        <DashboardIntro />
        <div className="flex flex-col items-center justify-center py-16">
          <div className="app-card w-full max-w-2xl p-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
              <span className="material-symbols-outlined text-2xl">
                warning
              </span>
            </div>
            <h2 className="text-text-primary text-2xl font-bold">
              Select a timelock to view the dashboard
            </h2>
            <p className="mt-2 text-text-secondary">
              Choose an active timelock from the selector in the header.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/settings"
                className="app-button-primary rounded-full px-6"
              >
                Manage timelocks in Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Main Content Grid */}
      <div className="flex flex-col gap-8">
        <div className="space-y-4">
          <div>
            <h1 className="text-text-primary text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="mt-2 text-text-secondary">
              Manage and monitor governance time-delayed operations.
            </p>
          </div>
          <div className="app-panel flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-text-secondary">
            <span>Network: {networkName}</span>
            <span className="hidden text-border-color sm:inline">•</span>
            <span>
              Timelock: {(selected.address as string).slice(0, 6)}...
              {(selected.address as string).slice(-4)}
            </span>
          </div>
        </div>
        <DashboardIntro />
        {/* SectionHeader for Operations */}
        <h2 className="text-text-primary text-xl font-bold leading-tight tracking-[-0.015em]">
          Operations Overview
        </h2>
        <p className="text-text-secondary text-sm">
          Pending = scheduled and waiting for the delay. Ready = can be executed now. Executed = already run.
        </p>
        {/* Stats Cards */}
        {isError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300 text-sm">
              Failed to load operations data. Please check your connection and try again.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="app-card flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-base font-medium leading-normal">
                Pending Operations
              </p>
              <span className="rounded-full bg-status-pending/10 px-2.5 py-1 text-xs font-semibold text-status-pending">
                Waiting
              </span>
            </div>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse rounded bg-border-color"></div>
            ) : (
              <Link
                href="/operations_explorer?status=pending"
                className="text-text-primary tracking-light text-3xl font-bold leading-tight hover:underline focus-visible:underline underline-offset-4"
                aria-label="View pending operations in Operations Explorer"
              >
                {summary?.pending ?? 0}
              </Link>
            )}
          </div>
          <div className="app-card flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-base font-medium leading-normal">
                Ready for Execution
              </p>
              <span className="rounded-full bg-status-ready/10 px-2.5 py-1 text-xs font-semibold text-status-ready">
                Ready
              </span>
            </div>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse rounded bg-border-color"></div>
            ) : (
              <Link
                href="/operations_explorer?status=ready"
                className="text-text-primary tracking-light text-3xl font-bold leading-tight hover:underline focus-visible:underline underline-offset-4"
                aria-label="View ready operations in Operations Explorer"
              >
                {summary?.ready ?? 0}
              </Link>
            )}
          </div>
          <div className="app-card flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-base font-medium leading-normal">
                Executed Operations
              </p>
              <span className="rounded-full bg-status-executed/10 px-2.5 py-1 text-xs font-semibold text-status-executed">
                Complete
              </span>
            </div>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse rounded bg-border-color"></div>
            ) : (
              <Link
                href="/operations_explorer?status=executed"
                className="text-text-primary tracking-light text-3xl font-bold leading-tight hover:underline focus-visible:underline underline-offset-4"
                aria-label="View executed operations in Operations Explorer"
              >
                {summary?.executed ?? 0}
              </Link>
            )}
          </div>
        </div>
        {/* SectionHeader for Roles */}
        <h2 className="text-text-primary text-xl font-bold leading-tight tracking-[-0.015em] pt-4">
          Access Manager Roles
        </h2>
        {/* Roles Summary Table */}
        {rolesError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300 text-sm">
              Failed to load roles data. Please check your connection and try again.
            </p>
          </div>
        )}
        <div className="app-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/40 text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium" scope="col">
                  Role
                </th>
                <th className="px-6 py-4 font-medium" scope="col">
                  Role Hash
                </th>
                <th className="px-6 py-4 font-medium text-right" scope="col">
                  Members
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {rolesLoading ? (
                // Loading skeleton rows
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-5 w-32 animate-pulse bg-border-color rounded"></div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-5 w-24 animate-pulse bg-border-color rounded"></div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="h-5 w-8 animate-pulse bg-border-color rounded ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : roles && roles.length > 0 ? (
                // Dynamic role rows
                roles.map((role) => {
                  // Truncate role hash for display (first 4 + last 4 chars)
                  const roleHashDisplay = `${role.roleHash.slice(0, 6)}...${role.roleHash.slice(-4)}`
                  // Get role name from ROLE_NAMES or use roleName from hook
                  const displayName = ROLE_NAMES[role.roleHash] || role.roleName || 'Unknown Role'
                  
                  return (
                    <tr key={role.roleHash}>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-text-primary">
                        {displayName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-text-secondary font-mono text-xs">
                        {roleHashDisplay}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-text-primary">
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
                // Empty state
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-text-secondary">
                    No roles were found for this timelock. It may not have any assigned roles yet, or this subgraph has not indexed them. See the docs for more details.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default DashboardView
