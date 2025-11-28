import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col">
      <div className="layout-container flex h-full grow flex-col">
        {/* TopNavBar - Header */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-color px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="h-6 w-6 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z" fill="currentColor" fillRule="evenodd"></path>
                <path clipRule="evenodd" d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
            <h1 className="text-text-primary text-xl font-bold leading-tight tracking-[-0.015em]">Rootstock Timelock Management</h1>
          </div>
          <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-6 bg-primary text-background-dark text-sm font-bold leading-normal tracking-[0.015em] hover:brightness-90 transition-all">
            <span className="truncate">Schedule New Operation</span>
          </button>
        </header>

        <main className="flex flex-col gap-8 px-6">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-5">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-border-color text-center py-4 px-6">
          <p className="text-text-secondary text-sm">© 2024 Rootstock. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
