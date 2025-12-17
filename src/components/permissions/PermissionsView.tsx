import { useState, useMemo, useEffect } from 'react'
import { type Address } from 'viem'
import { useAccount, useChainId } from 'wagmi'
import { useRoles } from '@/hooks/useRoles'
import { useHasRole } from '@/hooks/useHasRole'
import { useIsAccessManager } from '@/hooks/useIsAccessManager'
import { useTimelocks } from '@/hooks/useTimelocks'
import { TIMELOCK_ROLES, ROLE_NAMES } from '@/lib/constants'
import { getBlockscoutExplorerUrl } from '@/services/blockscout/client'
import { getAddress } from 'viem'
import { ClientPageRoot } from 'next/dist/client/components/client-page'
import { useRouter } from 'next/router'

// Helper to format timestamp
const formatTimestamp = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

// Helper to truncate address
const truncateAddress = (address: Address): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Component for individual role member row
interface RoleMemberRowProps {
  member: Address
  isDefaultAdmin: boolean
  connectedAddress: Address | undefined
  blockscoutUrl: string
  copiedAddress: Address | null
  onCopy: (address: Address) => void
}

const RoleMemberRow = ({ member, isDefaultAdmin, connectedAddress, blockscoutUrl, copiedAddress, onCopy }: RoleMemberRowProps) => {
  const isConnectedWallet =
    connectedAddress && getAddress(member) === getAddress(connectedAddress)
  const hasMultipleRoles = false // Could be enhanced to check other roles
  
  // Check if member is AccessManager (only for DEFAULT_ADMIN_ROLE)
  const { isAccessManager, isLoading: isCheckingAccessManager } = useIsAccessManager({
    address: isDefaultAdmin ? member : undefined,
    enabled: isDefaultAdmin,
  })
  
  return (
    <div className="flex items-center justify-between p-3 bg-background-dark rounded-lg">
      <div className="flex items-center gap-3 flex-wrap">
        {hasMultipleRoles && (
          <span
            className="text-accent-yellow material-symbols-outlined text-xl"
            title="This address holds multiple significant roles."
          >
            warning
          </span>
        )}
        {!hasMultipleRoles && (
          <span className="text-transparent material-symbols-outlined text-xl"></span>
        )}
        <span
          className={`font-mono text-sm bg-white/10 px-3 py-1 rounded-full ${
            isConnectedWallet
              ? 'text-primary border border-primary/50'
              : 'text-text-light'
          }`}
        >
          {truncateAddress(member)}
        </span>
        {isConnectedWallet && (
          <span className="text-xs text-primary">(You)</span>
        )}
        {isDefaultAdmin && !isCheckingAccessManager && isAccessManager && (
          <a
            href={`${blockscoutUrl}/address/${member}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
            title="Managed by AccessManager"
          >
            <span className="material-symbols-outlined text-base">link</span>
            Managed by AccessManager
          </a>
        )}
      </div>
      <div className="relative">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(member)
              onCopy(member)
            } catch (err) {
              console.error('Failed to copy:', err)
            }
          }}
          className="text-text-dark hover:text-white transition-colors"
          title={copiedAddress === member ? 'Copied!' : 'Copy address'}
        >
          <span className="material-symbols-outlined text-xl">
            {copiedAddress === member ? 'check' : 'content_copy'}
          </span>
        </button>
        {copiedAddress === member && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-surface-dark text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
            Copied!
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
              <div className="border-4 border-transparent border-t-surface-dark"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const PermissionsView = () => {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<Address | null>(null)
  const [copiedHistoryAddress, setCopiedHistoryAddress] = useState<string | null>(null)
  const { address: connectedAddress } = useAccount()
  const chainId = useChainId()
  const blockscoutUrl = getBlockscoutExplorerUrl(chainId)
  const { selected } = useTimelocks()


  // Clear copied state after 2 seconds
  useEffect(() => {
    if (copiedAddress) {
      const timer = setTimeout(() => {
        setCopiedAddress(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [copiedAddress])

  // Clear copied history address state after 2 seconds
  useEffect(() => {
    if (copiedHistoryAddress) {
      const timer = setTimeout(() => {
        setCopiedHistoryAddress(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [copiedHistoryAddress])

  // Initialize role filter/selection from URL query param (e.g. /permissions?role=0x...)
  useEffect(() => {
    if (!router.isReady) return
    const raw = router.query.role
    const value =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw) && typeof raw[0] === 'string'
          ? raw[0]
          : ''

    const roleHash = value.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(roleHash)) return

    // Show all roles in the left column; just pre-select/highlight the requested role.
    setSearchValue('')
    setSelectedRoleHash(roleHash as `0x${string}`)
  }, [router.isReady, router.query.role])
  
  const timelockAddress = (selected?.address as Address | undefined) ?? undefined
  
  // Fetch roles and history
  const { roles, roleHistory, isLoading, isError } = useRoles({
    timelockController: timelockAddress,
  })
  
  // Filter roles by search
  const filteredRoles = useMemo(() => {
    if (!roles) return []
    if (!searchValue.trim()) return roles
    const searchLower = searchValue.toLowerCase()
    return roles.filter(
      (role) =>
        role.roleName.toLowerCase().includes(searchLower) ||
        role.roleHash.toLowerCase().includes(searchLower)
    )
  }, [roles, searchValue])
  
  // State for selected role
  const [selectedRoleHash, setSelectedRoleHash] = useState<`0x${string}` | null>(
    null
  )
  
  // Get selected role data
  const selectedRole = useMemo(() => {
    if (!selectedRoleHash || !roles) return null
    return roles.find((r) => r.roleHash === selectedRoleHash)
  }, [selectedRoleHash, roles])
  
  // Get history for selected role
  const selectedRoleHistory = useMemo(() => {
    if (!selectedRoleHash || !roleHistory) return []
    return roleHistory.filter((event) => {
      // event.role can be a string (role hash) or Role object
      const roleHash =
        typeof event.role === 'string'
          ? event.role
          : typeof event.role === 'object' && event.role !== null && 'roleHash' in event.role
          ? event.role.roleHash
          : null
      return roleHash && roleHash.toLowerCase() === selectedRoleHash.toLowerCase()
    })
  }, [selectedRoleHash, roleHistory])
  
  // Auto-select first role if none selected
  useMemo(() => {
    if (!selectedRoleHash && filteredRoles.length > 0) {
      setSelectedRoleHash(filteredRoles[0].roleHash)
    }
  }, [selectedRoleHash, filteredRoles])
  
  // Check if connected wallet has selected role
  const hasSelectedRole = useHasRole({
    account: connectedAddress,
    role: selectedRoleHash || TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE,
    timelockController: timelockAddress || '0x0000000000000000000000000000000000000000',
  })
  return (
    <main className="flex flex-1 p-6 lg:p-8">
      <div className="grid grid-cols-12 gap-6 w-full">
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-white">All Roles</h2>
          <div className="px-0 py-0">
            <label className="flex flex-col min-w-40 h-12 w-full">
              <div className="flex w-full flex-1 items-stretch rounded-full h-full">
                <div className="text-text-dark flex bg-surface-dark items-center justify-center pl-4 rounded-l-full">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-text-light focus:outline-0 focus:ring-2 focus:ring-primary/50 border-none bg-surface-dark h-full placeholder:text-text-dark px-4 rounded-l-none pl-2 text-base font-normal leading-normal"
                  placeholder="Filter roles..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`loading-${index}`}
                  className="flex items-center gap-4 p-3 rounded-lg animate-pulse bg-surface-dark"
                >
                  <div className="size-10 bg-border-color rounded-md"></div>
                  <div className="h-5 w-32 bg-border-color rounded flex-1"></div>
                </div>
              ))
            ) : isError ? (
              <div className="p-3 text-red-500 text-sm">
                Failed to load roles
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-3 text-text-secondary text-sm">
                No roles found
              </div>
            ) : (
              filteredRoles.map((role) => {
                const isSelected = selectedRoleHash === role.roleHash
                const displayName = ROLE_NAMES[role.roleHash] || role.roleName
                
                // Get icon based on role name
                const getRoleIcon = (name: string) => {
                  if (name.includes('ADMIN')) return 'shield'
                  if (name.includes('PROPOSER')) return 'post_add'
                  if (name.includes('EXECUTOR')) return 'play_arrow'
                  if (name.includes('CANCELLER')) return 'cancel'
                  return 'person'
                }
                
                return (
                  <div
                    key={role.roleHash}
                    onClick={() => setSelectedRoleHash(role.roleHash)}
                    className={`flex items-center gap-4 p-3 justify-between rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/20'
                        : 'hover:bg-surface-dark'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`${
                          isSelected ? 'text-primary' : 'text-text-light'
                        } flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10`}
                      >
                        <span className="material-symbols-outlined">
                          {getRoleIcon(displayName)}
                        </span>
                      </div>
                      <p
                        className={`${
                          isSelected
                            ? 'text-primary font-medium'
                            : 'text-text-light font-normal'
                        } text-base leading-normal flex-1 truncate`}
                      >
                        {displayName}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <div
                        className={`${
                          isSelected ? 'text-primary' : 'text-text-dark'
                        } flex size-7 items-center justify-center`}
                      >
                        <span className="material-symbols-outlined">
                          chevron_right
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          {isLoading ? (
            <div className="bg-surface-dark rounded-xl p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-48 bg-border-color rounded"></div>
                <div className="h-4 w-96 bg-border-color rounded"></div>
                <div className="h-6 w-32 bg-border-color rounded mt-6"></div>
                <div className="space-y-3 mt-4">
                  <div className="h-16 bg-border-color rounded"></div>
                  <div className="h-16 bg-border-color rounded"></div>
                </div>
              </div>
            </div>
          ) : isError ? (
            <div className="bg-surface-dark rounded-xl p-6">
              <div className="rounded border border-red-500/50 bg-red-500/10 p-4">
                <p className="text-red-500 text-sm">
                  Failed to load roles data. Please check your connection and try again.
                </p>
              </div>
            </div>
          ) : selectedRole ? (
            <div className="bg-surface-dark rounded-xl p-6">
              <div className="pb-4 border-b border-white/10">
                <h3 className="text-2xl font-semibold text-white">
                  {ROLE_NAMES[selectedRole.roleHash] || selectedRole.roleName}
                </h3>
                <p className="text-text-dark mt-1">
                  {selectedRole.roleHash === TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE
                    ? 'Grants permission to modify Timelock settings and manage other roles.'
                    : selectedRole.roleHash === TIMELOCK_ROLES.PROPOSER_ROLE
                    ? 'Grants permission to schedule new timelock operations.'
                    : selectedRole.roleHash === TIMELOCK_ROLES.EXECUTOR_ROLE
                    ? 'Grants permission to execute ready timelock operations.'
                    : selectedRole.roleHash === TIMELOCK_ROLES.CANCELLER_ROLE
                    ? 'Grants permission to cancel pending timelock operations.'
                    : 'Custom role with specific permissions.'}
                </p>
              </div>
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-white">
                  Current Holders ({selectedRole.memberCount})
                </h4>
                {selectedRole.currentMembers.length === 0 ? (
                  <p className="text-text-secondary mt-4">No current holders</p>
                ) : (
                  <div className="flex flex-col gap-3 mt-4">
                    {selectedRole.currentMembers.map((member) => {
                      const isDefaultAdmin = selectedRole.roleHash.toLowerCase() === TIMELOCK_ROLES.DEFAULT_ADMIN_ROLE.toLowerCase()
                      return (
                        <RoleMemberRow
                          key={member}
                          member={member}
                          isDefaultAdmin={isDefaultAdmin}
                          connectedAddress={connectedAddress}
                          blockscoutUrl={blockscoutUrl}
                          copiedAddress={copiedAddress}
                          onCopy={setCopiedAddress}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface-dark rounded-xl p-6">
              <p className="text-text-secondary">Select a role to view details</p>
            </div>
          )}
          <div className="bg-surface-dark rounded-xl p-6">
            <h4 className="text-lg font-semibold text-white mb-4">
              Role History
            </h4>
            {selectedRoleHistory.length === 0 ? (
              <p className="text-text-secondary">No history available for this role</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-text-dark border-b border-white/10">
                    <tr>
                      <th className="p-3 font-medium">Action</th>
                      <th className="p-3 font-medium">Target Address</th>
                      <th className="p-3 font-medium">Transaction Hash</th>
                      <th className="p-3 font-medium text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRoleHistory.map((event) => (
                      <tr key={event.id} className="border-b border-white/10">
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${
                              event.granted
                                ? 'text-accent-green bg-accent-green/10'
                                : 'text-accent-red bg-accent-red/10'
                            }`}
                          >
                            <span className="material-symbols-outlined text-base">
                              {event.granted ? 'add_circle' : 'remove_circle'}
                            </span>
                            {event.granted ? 'Grant' : 'Revoke'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-light">
                              {truncateAddress(event.account)}
                            </span>
                            <div className="relative">
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(event.account)
                                    setCopiedHistoryAddress(event.account)
                                  } catch (err) {
                                    console.error('Failed to copy:', err)
                                  }
                                }}
                                className="text-text-dark hover:text-white transition-colors"
                                title={copiedHistoryAddress === event.account ? 'Copied!' : 'Copy address'}
                              >
                                <span className="material-symbols-outlined text-base">
                                  {copiedHistoryAddress === event.account ? 'check' : 'content_copy'}
                                </span>
                              </button>
                              {copiedHistoryAddress === event.account && (
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-surface-dark text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                  Copied!
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                    <div className="border-4 border-transparent border-t-surface-dark"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <a
                            href={`${blockscoutUrl}/tx/${event.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline cursor-pointer"
                          >
                            {truncateAddress(event.transactionHash)}
                          </a>
                        </td>
                        <td className="p-3 text-text-dark text-right">
                          {formatTimestamp(event.blockTimestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default PermissionsView
