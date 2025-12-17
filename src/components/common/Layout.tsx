import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { ROOTSTOCK_CHAINS } from '@/lib/constants'
import { TimelockSelector } from '@/components/timelock/TimelockSelector'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingChain, chains } = useSwitchChain()

  const supportedRootstockChains = React.useMemo(() => {
    const wanted = new Set<number>([
      ROOTSTOCK_CHAINS.MAINNET,
      ROOTSTOCK_CHAINS.TESTNET,
    ])
    return (chains ?? []).filter((c) => wanted.has(c.id))
  }, [chains])

  const isOnSupportedRootstockChain = React.useMemo(() => {
    if (!isConnected) return true
    return supportedRootstockChains.some((c) => c.id === chainId)
  }, [chainId, isConnected, supportedRootstockChains])

  const routeTitleMap: Record<string, string> = {
    '/': 'Dashboard',
    '/operations_explorer': 'Operations Explorer',
    '/new_proposal': 'New Proposal',
    '/permissions': 'Roles',
    '/decoder': 'Decoder',
    '/settings': 'Settings',
  }

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/'
    return router.pathname.startsWith(href)
  }

  const getCurrentViewTitle = () => {
    const direct = routeTitleMap[router.pathname]
    if (direct) return direct

    const slug = router.pathname.replace(/^\//, '').replace(/_/g, ' ').trim()
    if (!slug) return 'Dashboard'

    return slug.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <div className="flex min-h-screen">
      {/* SideNavBar */}
      <aside className="flex w-64 flex-col bg-surface-dark p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
              data-alt="Rootstock logo"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBQfbqnbkXwR5hjsDFW9byKS85w8p01NGY6StRlX2xZIvOn_cNV1ctxWQ2Ql0qvGOGQmqGA-5_ps8b3RR_m3jM_iijanP12sul7PGKCGOuhfWQrydVW_6Lhdq3KoANJkOHZn2DziX5vmSz5_vI8YLOY8uK3px2gUheBH-r0HDCkrRtqGehRbxlQI4jJxkZtP9bGR685FENaDEBfy3aQ8p7dr70SPd3R2h-JJFqpdfHVShpCKn8BcQPkV1DKVDk1lI5OHg18ZnelkZY3")',
              }}
            ></div>
            <div className="flex flex-col">
              <h1 className="text-white text-base font-medium leading-normal">
                Rootstock
              </h1>
              <p className="text-text-dark text-sm font-normal leading-normal">
                Timelock Management
              </p>
            </div>
          </div>
          <nav className="flex flex-col gap-2 mt-4">
            <Link
              href="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                isActive('/')
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-light hover:bg-surface-dark'
              }`}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <p className="text-sm font-medium leading-normal">Dashboard</p>
            </Link>
            <Link
              href="/operations_explorer"
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                isActive('/operations_explorer')
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-light hover:bg-surface-dark'
              }`}
            >
              <span className="material-symbols-outlined">gavel</span>
              <p className="text-sm font-medium leading-normal">
                Operations Explorer
              </p>
            </Link>
            <Link
              href="/new_proposal"
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                isActive('/new_proposal')
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-light hover:bg-surface-dark'
              }`}
            >
              <span className="material-symbols-outlined">post_add</span>
              <p className="text-sm font-medium leading-normal">New Proposal</p>
            </Link>
            <Link
              href="/permissions"
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                isActive('/permissions')
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-light hover:bg-surface-dark'
              }`}
            >
              <span className="material-symbols-outlined">
                admin_panel_settings
              </span>
              <p className="text-sm font-medium leading-normal">
                Roles Management
              </p>
            </Link>
            <Link
              href="/decoder"
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                isActive('/decoder')
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-light hover:bg-surface-dark'
              }`}
            >
              <span className="material-symbols-outlined">code</span>
              <p className="text-sm font-medium leading-normal">Decoder</p>
            </Link>
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                isActive('/settings')
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-light hover:bg-surface-dark'
              }`}
            >
              <span className="material-symbols-outlined">settings</span>
              <p className="text-sm font-medium leading-normal">Settings</p>
            </Link>
          </nav>
        </div>
        <div className="mt-auto flex flex-col gap-1">
          <a
            className="flex items-center gap-3 px-3 py-2 text-text-light hover:bg-surface-dark rounded-full"
            href="#"
          >
            <span className="material-symbols-outlined">logout</span>
            <p className="text-sm font-medium leading-normal">Logout</p>
          </a>
        </div>
      </aside>
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <header className="h-16 bg-surface-dark/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 lg:px-8 z-10 sticky top-0">
          <div className="flex items-center gap-2 text-text-dark text-sm">
            <span className="material-symbols-outlined text-base">home</span>
            <span>/</span>
            <span className="text-text-light font-medium">
              {getCurrentViewTitle()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <TimelockSelector />
            <ConnectButton showBalance />
          </div>
        </header>

        {/* T104/T105: Network mismatch banner + one-click switching */}
        {isConnected && !isOnSupportedRootstockChain ? (
          <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-6 py-3 text-sm text-yellow-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base leading-5">
                  warning
                </span>
                <div className="flex flex-col">
                  <span className="font-semibold">Wrong network</span>
                  <span className="text-yellow-200/80">
                    Switch to Rootstock to enable actions (execute, cancel,
                    schedule).
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {supportedRootstockChains.length === 0 ? (
                  <span className="text-yellow-200/80">
                    Rootstock chains are not enabled in this app configuration.
                  </span>
                ) : (
                  supportedRootstockChains.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-100 hover:bg-yellow-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => switchChain({ chainId: c.id })}
                      disabled={isSwitchingChain}
                      title={`Switch to ${c.name}`}
                    >
                      {isSwitchingChain ? 'Switching…' : `Switch to ${c.name}`}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export default Layout
