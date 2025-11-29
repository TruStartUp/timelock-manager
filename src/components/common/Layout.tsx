import React from 'react'
import Link from 'next/link'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen">
      {/* SideNavBar */}
      <aside className="flex w-64 flex-col bg-[#231a0f] p-4">
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
              className="flex items-center gap-3 px-3 py-2 text-text-light hover:bg-surface-dark rounded-full"
            >
              <span className="material-symbols-outlined">dashboard</span>
              <p className="text-sm font-medium leading-normal">Dashboard</p>
            </Link>
            <Link
              href="/operations_explorer"
              className="flex items-center gap-3 px-3 py-2 text-text-light hover:bg-surface-dark rounded-full"
            >
              <span className="material-symbols-outlined">gavel</span>
              <p className="text-sm font-medium leading-normal">
                Operations Explorer
              </p>
            </Link>
            <Link
              href="/new_proposal"
              className="flex items-center gap-3 px-3 py-2 text-text-light hover:bg-surface-dark rounded-full"
            >
              <span className="material-symbols-outlined">post_add</span>
              <p className="text-sm font-medium leading-normal">New Proposal</p>
            </Link>
            <Link
              href="/permissions"
              className="flex items-center gap-3 px-3 py-2 rounded-full bg-primary/20 text-primary"
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
              className="flex items-center gap-3 px-3 py-2 text-text-light hover:bg-surface-dark rounded-full"
            >
              <span className="material-symbols-outlined">code</span>
              <p className="text-sm font-medium leading-normal">Decoder</p>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 text-text-light hover:bg-surface-dark rounded-full"
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
      {/* Main Content */}
      <main className="flex flex-1 flex-col p-6 lg:p-8">{children}</main>
    </div>
  )
}

export default Layout
