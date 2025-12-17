import React from 'react'
import { type Address } from 'viem'
import { useChainId } from 'wagmi'
import { rootstock, rootstockTestnet } from 'wagmi/chains'
import Link from 'next/link'
import { useOperationsSummary } from '@/hooks/useOperations'
import { useRoles } from '@/hooks/useRoles'
import { ROLE_NAMES } from '@/lib/constants'
import { useTimelocks } from '@/hooks/useTimelocks'


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
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-full max-w-2xl rounded-lg border border-border-color bg-surface p-8 text-center">
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
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-black hover:bg-primary/80 transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-full max-w-2xl rounded-lg border border-border-color bg-surface p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
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
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-black hover:bg-primary/80 transition-colors"
            >
              Manage timelocks in Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Main Content Grid */}
      <div className="flex flex-col gap-8">
        {/* SectionHeader for Operations */}
        <h2 className="text-text-primary text-xl font-bold leading-tight tracking-[-0.015em]">
          Operations Overview
        </h2>
        {/* Stats Cards */}
        {isError && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-red-500 text-sm">
              Failed to load operations data. Please check your connection and try again.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">
              Pending Operations
            </p>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse bg-border-color rounded"></div>
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
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">
              Ready for Execution
            </p>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse bg-border-color rounded"></div>
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
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">
              Executed Operations
            </p>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse bg-border-color rounded"></div>
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
          <div className="rounded border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-red-500 text-sm">
              Failed to load roles data. Please check your connection and try again.
            </p>
          </div>
        )}
        <div className="overflow-x-auto rounded border border-border-color bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border-color text-text-secondary">
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
                    No roles found
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
