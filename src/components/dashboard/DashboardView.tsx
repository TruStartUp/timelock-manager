import React, { useState } from 'react'
import { type Address } from 'viem'
import { useChainId } from 'wagmi'
import { rootstock, rootstockTestnet } from 'wagmi/chains'
import { useOperationsSummary } from '@/hooks/useOperations'
import { useRoles } from '@/hooks/useRoles'
import { ROLE_NAMES } from '@/lib/constants'

const DashboardView: React.FC = () => {
  const chainId = useChainId()
  
  // State for selected timelock contract address
  // Using the actual deployed TimelockController on Rootstock Testnet
  const [timelockAddress, setTimelockAddress] = useState<Address | undefined>(
    '0x09a3fa8b0706829ad2b66719b851793a7b20d08a' as Address // Real testnet contract
  )

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

  return (
    <>
      {/* Top Section: Contract Selector & Network Status */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        {/* TextField as Contract Selector */}
        <div className="flex flex-col min-w-80 flex-1">
          <label
            className="text-text-primary text-base font-medium leading-normal pb-2"
            htmlFor="timelock-contract"
          >
            Timelock Contract
          </label>
          <select
            className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface h-12 placeholder:text-text-secondary px-4 text-base font-normal leading-normal appearance-none bg-no-repeat bg-right"
            id="timelock-contract"
            value={timelockAddress}
            onChange={(e) => setTimelockAddress(e.target.value as Address)}
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBbm7BqvtrYyzpJI6ttwu0AnSuggWCWF8N_1bJ7ZkCJjxg1D2rvAYQKqoeR7FZDmampY9M2vwqzOic8RjPKnbOtf80cHrIayTWsd5d8IgARI5Yh-rbxwVjomNK0qFqsJwdxN76JR7sQI_VIKTGs4DbKxW0rELKIr3QcUmf8huvb_TsXcqEPB4H7E_Xouhj8eBOE2tSIoPAxvLWQfJ7mQRZIPni8FTAAYe_sYdOkLJ0v2msCBdUlOsYjXlNrCNJMYNHmTn1G1CqJLFxf")',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1.5em 1.5em',
            }}
          >
            <option value="0x09a3fa8b0706829ad2b66719b851793a7b20d08a">
              TimelockController - Testnet (0x09a3...d08a)
            </option>
          </select>
        </div>
        {/* Chips as Network Status Indicator */}
        <div className="flex items-center gap-3 pt-9">
          <div className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-surface border border-border-color px-3">
            <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
            <p className="text-text-secondary text-sm font-medium leading-normal">
              Connected to:{' '}
              <span className="text-text-primary font-semibold">
                {networkName}
              </span>
            </p>
          </div>
        </div>
      </div>
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
              <p className="text-text-primary tracking-light text-3xl font-bold leading-tight">
                {summary?.pending ?? 0}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">
              Ready for Execution
            </p>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse bg-border-color rounded"></div>
            ) : (
              <p className="text-text-primary tracking-light text-3xl font-bold leading-tight">
                {summary?.ready ?? 0}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">
              Executed Operations
            </p>
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse bg-border-color rounded"></div>
            ) : (
              <p className="text-text-primary tracking-light text-3xl font-bold leading-tight">
                {summary?.executed ?? 0}
              </p>
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
                        {role.memberCount}
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
