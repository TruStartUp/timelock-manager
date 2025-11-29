import { useState } from 'react'

const PermissionsView = () => {
  const [searchValue, setSearchValue] = useState('')
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
            <div className="flex items-center gap-4 bg-primary/20 p-3 justify-between rounded-lg cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="text-primary flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10">
                  <span className="material-symbols-outlined">shield</span>
                </div>
                <p className="text-primary text-base font-medium leading-normal flex-1 truncate">
                  TIMELOCK_ADMIN_ROLE
                </p>
              </div>
              <div className="shrink-0">
                <div className="text-primary flex size-7 items-center justify-center">
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 hover:bg-surface-dark p-3 justify-between rounded-lg cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="text-text-light flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10">
                  <span className="material-symbols-outlined">post_add</span>
                </div>
                <p className="text-text-light text-base font-normal leading-normal flex-1 truncate">
                  PROPOSER_ROLE
                </p>
              </div>
              <div className="shrink-0">
                <div className="text-text-dark flex size-7 items-center justify-center">
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 hover:bg-surface-dark p-3 justify-between rounded-lg cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="text-text-light flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10">
                  <span className="material-symbols-outlined">play_arrow</span>
                </div>
                <p className="text-text-light text-base font-normal leading-normal flex-1 truncate">
                  EXECUTOR_ROLE
                </p>
              </div>
              <div className="shrink-0">
                <div className="text-text-dark flex size-7 items-center justify-center">
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 hover:bg-surface-dark p-3 justify-between rounded-lg cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="text-text-light flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10">
                  <span className="material-symbols-outlined">cancel</span>
                </div>
                <p className="text-text-light text-base font-normal leading-normal flex-1 truncate">
                  CANCELLER_ROLE
                </p>
              </div>
              <div className="shrink-0">
                <div className="text-text-dark flex size-7 items-center justify-center">
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          <div className="bg-surface-dark rounded-xl p-6">
            <div className="pb-4 border-b border-white/10">
              <h3 className="text-2xl font-semibold text-white">
                TIMELOCK_ADMIN_ROLE
              </h3>
              <p className="text-text-dark mt-1">
                Grants permission to modify Timelock settings and manage other
                roles.
              </p>
            </div>
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-white">
                Current Holders (2)
              </h4>
              <div className="flex flex-col gap-3 mt-4">
                <div className="flex items-center justify-between p-3 bg-background-dark rounded-lg">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-accent-yellow material-symbols-outlined text-xl"
                      title="This address holds multiple significant roles."
                    >
                      warning
                    </span>
                    <span className="font-mono text-sm bg-white/10 px-3 py-1 rounded-full text-text-light">
                      0x1A2b...c3D4
                    </span>
                  </div>
                  <button className="text-text-dark hover:text-white">
                    <span className="material-symbols-outlined text-xl">
                      content_copy
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-background-dark rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-transparent material-symbols-outlined text-xl"></span>{' '}
                    {/* Spacer */}
                    <span className="font-mono text-sm bg-white/10 px-3 py-1 rounded-full text-text-light">
                      0x5E6f...g7H8
                    </span>
                  </div>
                  <button className="text-text-dark hover:text-white">
                    <span className="material-symbols-outlined text-xl">
                      content_copy
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-dark rounded-xl p-6">
            <h4 className="text-lg font-semibold text-white mb-4">
              Role History
            </h4>
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
                  <tr className="border-b border-white/10">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2 text-accent-green bg-accent-green/10 px-2 py-1 rounded-full text-xs font-medium">
                        <span className="material-symbols-outlined text-base">
                          add_circle
                        </span>
                        Grant
                      </span>
                    </td>
                    <td className="p-3 font-mono text-text-light">
                      0x5E6f...g7H8
                    </td>
                    <td className="p-3 font-mono text-primary hover:underline cursor-pointer">
                      0xabcd...1234
                    </td>
                    <td className="p-3 text-text-dark text-right">
                      2023-10-26 14:30 UTC
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2 text-accent-red bg-accent-red/10 px-2 py-1 rounded-full text-xs font-medium">
                        <span className="material-symbols-outlined text-base">
                          remove_circle
                        </span>
                        Revoke
                      </span>
                    </td>
                    <td className="p-3 font-mono text-text-light">
                      0x9J0k...l1M2
                    </td>
                    <td className="p-3 font-mono text-primary hover:underline cursor-pointer">
                      0xefgh...5678
                    </td>
                    <td className="p-3 text-text-dark text-right">
                      2023-09-15 09:00 UTC
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2 text-accent-green bg-accent-green/10 px-2 py-1 rounded-full text-xs font-medium">
                        <span className="material-symbols-outlined text-base">
                          add_circle
                        </span>
                        Grant
                      </span>
                    </td>
                    <td className="p-3 font-mono text-text-light">
                      0x1A2b...c3D4
                    </td>
                    <td className="p-3 font-mono text-primary hover:underline cursor-pointer">
                      0xijkl...9012
                    </td>
                    <td className="p-3 text-text-dark text-right">
                      2023-08-01 18:45 UTC
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default PermissionsView
