import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ConnectButton } from '@rainbow-me/rainbowkit'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter()

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
            <ConnectButton showBalance />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export default Layout
