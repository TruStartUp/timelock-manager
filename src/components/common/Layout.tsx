import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { ROOTSTOCK_CHAINS } from '@/lib/constants'
import { TimelockSelector } from '@/components/timelock/TimelockSelector'
import { useTheme } from '@/components/common/ThemeProvider'
import rootstockLogo from '@/assets/rootstock-logo.svg'

interface LayoutProps {
  children: React.ReactNode
}

const getStaticAssetUrl = (asset: unknown): string => {
  // Next static imports (png/svg/etc.) typically come through as { src: string, ... }.
  if (typeof asset === 'string') return asset
  if (asset && typeof asset === 'object' && 'src' in asset) {
    const src = (asset as any).src
    if (typeof src === 'string') return src
  }
  return ''
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { theme, toggleTheme } = useTheme()
  const { switchChain, isPending: isSwitchingChain, chains } = useSwitchChain()
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false)

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
    '/safe_verification': 'SAFE Verification',
    '/settings': 'Settings',
    '/deploy_timelock': 'Deploy Timelock',
    '/subgraph/deploy': 'Subgraph Deploy',
  }

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/'
    return router.pathname.startsWith(href)
  }

  React.useEffect(() => {
    // Close the mobile drawer on navigation.
    setIsMobileNavOpen(false)
  }, [router.pathname])

  const getCurrentViewTitle = () => {
    const direct = routeTitleMap[router.pathname]
    if (direct) return direct

    const slug = router.pathname.replace(/^\//, '').replace(/_/g, ' ').trim()
    if (!slug) return 'Dashboard'

    return slug.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      {/* Mobile overlay + drawer */}
      {isMobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`${
          isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-border-color bg-surface p-4 shadow-2xl shadow-slate-950/20 transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-auto lg:w-64 lg:translate-x-0 lg:shadow-none`}
        aria-label="Primary navigation"
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl size-10 ring-1 ring-border-color"
                data-alt="Rootstock logo"
                role="img"
                aria-label="Rootstock Timelock Manager logo"
                style={{
                  backgroundImage:
                    `url(${getStaticAssetUrl(rootstockLogo)})`,
                }}
              ></div>
              <div className="flex flex-col">
                <h1 className="text-text-primary text-base font-semibold leading-normal">
                  Rootstock
                </h1>
                <p className="text-text-secondary text-xs font-semibold uppercase tracking-[0.18em] leading-normal">
                  Timelock Management
                </p>
              </div>
            </div>

            <button
              type="button"
              className="rounded-xl p-2 text-text-secondary hover:bg-surface-elevated lg:hidden"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="Close navigation menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <nav className="flex flex-col gap-2 mt-4">
            <Link
              href="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <p className="text-sm font-medium leading-normal">Dashboard</p>
            </Link>
            <Link
              href="/operations_explorer"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/operations_explorer')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">gavel</span>
              <p className="text-sm font-medium leading-normal">
                Operations Explorer
              </p>
            </Link>
            <Link
              href="/new_proposal"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/new_proposal')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">post_add</span>
              <p className="text-sm font-medium leading-normal">New Proposal</p>
            </Link>
            <Link
              href="/deploy_timelock"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/deploy_timelock')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              <p className="text-sm font-medium leading-normal">Deploy Timelock</p>
            </Link>
            <Link
              href="/permissions"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/permissions')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/decoder')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">code</span>
              <p className="text-sm font-medium leading-normal">Decoder</p>
            </Link>
            <Link
              href="/safe_verification"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/safe_verification')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">verified_user</span>
              <p className="text-sm font-medium leading-normal">
                SAFE Verification
              </p>
            </Link>
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive('/settings')
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined">settings</span>
              <p className="text-sm font-medium leading-normal">Settings</p>
            </Link>
          </nav>

          <div className="mt-auto border-t border-border-color pt-4">
            <button
              type="button"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-elevated"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span className="material-symbols-outlined text-base">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <header className="min-h-16 bg-background/85 backdrop-blur-md border-b border-border-color flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 z-10 sticky top-0 py-3">
          <div className="flex items-center gap-2 text-text-secondary text-sm min-w-0">
            <button
              type="button"
              className="rounded-xl p-2 text-text-primary hover:bg-surface-elevated lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <Link
              href="/"
              className="rounded-lg p-1 text-text-primary hover:bg-surface-elevated"
              aria-label="Go to Dashboard"
              title="Dashboard"
            >
              <span className="material-symbols-outlined text-base">home</span>
            </Link>
            <span>/</span>
            <span className="text-text-primary font-medium truncate">
              {getCurrentViewTitle()}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <TimelockSelector />
            <ConnectButton showBalance />
          </div>
        </header>

        {/* T104/T105: Network mismatch banner + one-click switching */}
        {isConnected && !isOnSupportedRootstockChain ? (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-3 text-sm text-amber-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base leading-5">
                  warning
                </span>
                <div className="flex flex-col">
                  <span className="font-semibold">Wrong network</span>
                  <span className="text-amber-100/75">
                    Switch to Rootstock to enable actions (execute, cancel,
                    schedule).
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {supportedRootstockChains.length === 0 ? (
                  <span className="text-amber-100/75">
                    Rootstock chains are not enabled in this app configuration.
                  </span>
                ) : (
                  supportedRootstockChains.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
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
