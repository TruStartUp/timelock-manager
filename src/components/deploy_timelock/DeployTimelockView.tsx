import React from 'react'
import Link from 'next/link'

const DeployTimelockView: React.FC = () => {
  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-text-dark-secondary text-sm font-medium hover:text-primary transition-colors mb-6"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Settings
          </Link>
          <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">
            Deploy Timelock
          </h1>
          <p className="text-text-dark-secondary text-base font-normal leading-normal mt-3">
            Deploy a new OpenZeppelin TimelockController contract on Rootstock. This view will guide you through configuring min delay, proposers, executors, and admin.
          </p>
        </div>
        <div className="rounded-lg border border-[#55493a] bg-surface-dark p-8 text-center">
          <p className="text-text-dark-secondary text-sm leading-relaxed">
            Deploy flow coming soon. Use Settings to add an existing timelock by address in the meantime.
          </p>
        </div>
      </div>
    </main>
  )
}

export default DeployTimelockView
