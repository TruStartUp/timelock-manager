import React from 'react';

const DashboardView: React.FC = () => {
  return (
    <>
      {/* Top Section: Contract Selector & Network Status */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        {/* TextField as Contract Selector */}
        <div className="flex flex-col min-w-80 flex-1">
          <label className="text-text-primary text-base font-medium leading-normal pb-2" htmlFor="timelock-contract">Timelock Contract</label>
          <select
            className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface h-12 placeholder:text-text-secondary px-4 text-base font-normal leading-normal appearance-none bg-no-repeat bg-right"
            id="timelock-contract"
            defaultValue="TimelockController (0x1234...5678)"
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBbm7BqvtrYyzpJI6ttwu0AnSuggWCWF8N_1bJ7ZkCJjxg1D2rvAYQKqoeR7FZDmampY9M2vwqzOic8RjPKnbOtf80cHrIayTWsd5d8IgARI5Yh-rbxwVjomNK0qFqsJwdxN76JR7sQI_VIKTGs4DbKxW0rELKIr3QcUmf8huvb_TsXcqEPB4H7E_Xouhj8eBOE2tSIoPAxvLWQfJ7mQRZIPni8FTAAYe_sYdOkLJ0v2msCBdUlOsYjXlNrCNJMYNHmTn1G1CqJLFxf")', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
          >
            <option>TimelockController (0x1234...5678)</option>
            <option>AccessManager (0xABCD...EF01)</option>
            <option>OldTimelock (0x9876...5432)</option>
          </select>
        </div>
        {/* Chips as Network Status Indicator */}
        <div className="flex items-center gap-3 pt-9">
          <div className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-surface border border-border-color px-3">
            <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
            <p className="text-text-secondary text-sm font-medium leading-normal">Connected to: <span className="text-text-primary font-semibold">Rootstock Mainnet</span></p>
          </div>
        </div>
      </div>
      {/* Main Content Grid */}
      <div className="flex flex-col gap-8">
        {/* SectionHeader for Operations */}
        <h2 className="text-text-primary text-xl font-bold leading-tight tracking-[-0.015em]">Operations Overview</h2>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">Pending Operations</p>
            <p className="text-text-primary tracking-light text-3xl font-bold leading-tight">12</p>
          </div>
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">Ready for Execution</p>
            <p className="text-text-primary tracking-light text-3xl font-bold leading-tight">3</p>
          </div>
          <div className="flex flex-col gap-2 rounded border border-border-color p-6 bg-surface">
            <p className="text-text-secondary text-base font-medium leading-normal">Executed Operations</p>
            <p className="text-text-primary tracking-light text-3xl font-bold leading-tight">89</p>
          </div>
        </div>
        {/* SectionHeader for Roles */}
        <h2 className="text-text-primary text-xl font-bold leading-tight tracking-[-0.015em] pt-4">Access Manager Roles</h2>
        {/* Roles Summary Table */}
        <div className="overflow-x-auto rounded border border-border-color bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border-color text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium" scope="col">Role</th>
                <th className="px-6 py-4 font-medium" scope="col">Role Hash</th>
                <th className="px-6 py-4 font-medium text-right" scope="col">Admins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              <tr>
                <td className="whitespace-nowrap px-6 py-4 font-medium text-text-primary">PROPOSER_ROLE</td>
                <td className="whitespace-nowrap px-6 py-4 text-text-secondary">0xb09...e41d</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-text-primary">2</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-6 py-4 font-medium text-text-primary">EXECUTOR_ROLE</td>
                <td className="whitespace-nowrap px-6 py-4 text-text-secondary">0xd8a...3411</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-text-primary">1</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-6 py-4 font-medium text-text-primary">CANCELLER_ROLE</td>
                <td className="whitespace-nowrap px-6 py-4 text-text-secondary">0x146...3d62</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-text-primary">3</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-6 py-4 font-medium text-text-primary">TIMELOCK_ADMIN_ROLE</td>
                <td className="whitespace-nowrap px-6 py-4 text-text-secondary">0x5f5...f788</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-text-primary">1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default DashboardView;