import React, { useState } from 'react';

type OperationStatus = 'All' | 'Pending' | 'Ready' | 'Executed' | 'Canceled';

interface Operation {
  id: string;
  status: Exclude<OperationStatus, 'All'>;
  calls: number;
  targets: string[];
  eta: {
    relative: string;
    absolute: string;
  };
  proposer: string;
  details?: {
    fullId: string;
    fullProposer: string;
    scheduled: string;
    callsDetails: Array<{
      target: string;
      value: string;
    }>;
  };
}

const OperationsExplorerView: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<OperationStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>('0xab...c456');

  // Example operations data - will be replaced with actual data from hooks/services
  const operations: Operation[] = [
    {
      id: '0xab...c456',
      status: 'Ready',
      calls: 3,
      targets: ['0x12...a7b8', '0x45...b8c9', '0x78...c9d0'],
      eta: {
        relative: 'in 12 hours',
        absolute: '2023-10-27 15:00 UTC',
      },
      proposer: '0xd4...e8f9',
      details: {
        fullId: '0xabc123def456...',
        fullProposer: '0xd4e56789f0...',
        scheduled: '2023-10-26 03:00',
        callsDetails: [
          { target: '0x123...a7b8', value: '0' },
          { target: '0x456...b8c9', value: '0' },
          { target: '0x789...c9d0', value: '1.5 ETH' },
        ],
      },
    },
    {
      id: '0x2d...a1b2',
      status: 'Pending',
      calls: 1,
      targets: ['0xef...d5c6'],
      eta: {
        relative: 'in 2 days',
        absolute: '2023-10-29 18:30 UTC',
      },
      proposer: '0x98...b3a4',
    },
    {
      id: '0x7f...e3d4',
      status: 'Executed',
      calls: 5,
      targets: ['0x5a...b6c7', '0x1a...c7d8', '0x2b...d8e9', '0x3c...e9f0', '0x4d...f0a1'],
      eta: {
        relative: '-',
        absolute: '2023-10-25 10:00 UTC',
      },
      proposer: '0x3c...d8e9',
    },
    {
      id: '0x9c...b5d6',
      status: 'Canceled',
      calls: 2,
      targets: ['0x8e...f1a2', '0x9f...a2b3'],
      eta: {
        relative: '-',
        absolute: '2023-10-24 12:00 UTC',
      },
      proposer: '0x7a...b3c4',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'bg-status-ready';
      case 'Pending':
        return 'bg-status-pending';
      case 'Executed':
        return 'bg-status-executed';
      case 'Canceled':
        return 'bg-status-canceled';
      default:
        return 'bg-border-dark';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'text-status-ready';
      case 'Pending':
        return 'text-status-pending';
      case 'Executed':
        return 'text-status-executed';
      case 'Canceled':
        return 'text-status-canceled';
      default:
        return 'text-text-dark-secondary';
    }
  };

  const handleRowClick = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const handleExecute = (id: string) => {
    // TODO: Implement execute logic with data hooks/services
    console.log('Execute operation:', id);
  };

  const handleCancel = (id: string) => {
    // TODO: Implement cancel logic with data hooks/services
    console.log('Cancel operation:', id);
  };

  const formatTargets = (targets: string[]) => {
    if (targets.length <= 1) return targets[0] || '';
    return `${targets[0]}, +${targets.length - 1} more`;
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark px-6 py-4 mb-4">
        <div className="flex items-center gap-4 text-text-dark-primary">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <h1 className="text-text-dark-primary text-lg font-bold leading-tight tracking-[-0.015em]">
            Timelock Management
          </h1>
        </div>
        <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full h-10 px-4 bg-primary text-background-dark text-sm font-bold leading-normal tracking-[0.015em] hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined !text-xl">add</span>
          <span className="truncate">Schedule Operation</span>
        </button>
      </header>

      <main className="flex flex-col gap-4 p-4 md:p-6">
        {/* Page Heading */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-text-dark-primary text-4xl font-black leading-tight tracking-[-0.033em]">
            Timelock Operations
          </h2>
        </div>

        {/* Toolbar / Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-lg bg-surface-dark p-3">
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {(['All', 'Pending', 'Ready', 'Executed', 'Canceled'] as OperationStatus[]).map(
              (filter) => (
                <button
                  key={filter}
                  className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 text-sm font-medium leading-normal transition-colors ${selectedFilter === filter
                      ? 'bg-primary text-background-dark'
                      : 'bg-border-dark text-text-dark-primary hover:bg-white/10'
                    }`}
                  onClick={() => setSelectedFilter(filter)}
                >
                  {filter}
                </button>
              )
            )}
          </div>

          {/* Search Bar & Advanced Filter */}
          <div className="flex items-center gap-2">
            <div className="flex-grow">
              <label className="flex flex-col min-w-40 h-11 w-full">
                <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                  <div className="text-text-dark-secondary flex items-center justify-center rounded-l-lg border-r-0 border-none bg-border-dark pl-3">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border-l-0 border-none bg-border-dark text-base font-normal leading-normal text-text-dark-primary placeholder:text-text-dark-secondary focus:outline-0 focus:ring-0 h-full px-3"
                    placeholder="Search by ID, proposer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </label>
            </div>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-border-dark text-text-dark-secondary hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        {/* Operations Table */}
        <div className="w-full overflow-x-auto rounded-lg bg-surface-dark">
          <table className="w-full min-w-[1024px] text-left text-sm">
            <thead className="border-b border-border-dark text-xs uppercase text-text-dark-secondary">
              <tr>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    ID <span className="material-symbols-outlined !text-base">swap_vert</span>
                  </div>
                </th>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    Status <span className="material-symbols-outlined !text-base">swap_vert</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center" scope="col">
                  Calls
                </th>
                <th className="px-6 py-4" scope="col">
                  Targets
                </th>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    ETA <span className="material-symbols-outlined !text-base">swap_vert</span>
                  </div>
                </th>
                <th className="px-6 py-4" scope="col">
                  <div className="flex items-center gap-1 cursor-pointer">
                    Proposer <span className="material-symbols-outlined !text-base">swap_vert</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-right" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation) => (
                <React.Fragment key={operation.id}>
                  {/* Main Row */}
                  <tr
                    className={`border-b border-border-dark transition-colors cursor-pointer ${expandedRowId === operation.id
                        ? 'bg-primary/10 hover:bg-primary/20'
                        : 'hover:bg-white/5'
                      }`}
                    onClick={() => handleRowClick(operation.id)}
                  >
                    <td className="px-6 py-4 font-mono text-text-dark-primary">{operation.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(operation.status)}`}></div>
                        <span className={`font-medium ${getStatusTextColor(operation.status)}`}>
                          {operation.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-text-dark-primary">
                      {operation.calls}
                    </td>
                    <td className="px-6 py-4 font-mono text-text-dark-secondary">
                      {formatTargets(operation.targets)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-dark-primary">{operation.eta.relative}</span>
                        <span className="text-xs text-text-dark-secondary">{operation.eta.absolute}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-dark-secondary">{operation.proposer}</td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {operation.status === 'Ready' && (
                          <>
                            <button
                              className="flex items-center justify-center rounded-md h-9 px-3 bg-status-ready/20 text-status-ready text-xs font-bold hover:bg-status-ready/30 transition-colors"
                              onClick={() => handleExecute(operation.id)}
                            >
                              EXECUTE
                            </button>
                            <button
                              className="flex items-center justify-center rounded-md h-9 px-3 bg-status-canceled/20 text-status-canceled text-xs font-bold hover:bg-status-canceled/30 transition-colors"
                              onClick={() => handleCancel(operation.id)}
                            >
                              CANCEL
                            </button>
                          </>
                        )}
                        {operation.status === 'Pending' && (
                          <button
                            className="flex items-center justify-center rounded-md h-9 px-3 bg-status-canceled/20 text-status-canceled text-xs font-bold hover:bg-status-canceled/30 transition-colors"
                            onClick={() => handleCancel(operation.id)}
                          >
                            CANCEL
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedRowId === operation.id && operation.details && (
                    <tr className="bg-primary/5">
                      <td className="p-0" colSpan={7}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-border-dark">
                          <div>
                            <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                              Operation Details
                            </h4>
                            <div className="flex flex-col gap-1 text-sm font-mono">
                              <p>
                                <span className="text-text-dark-secondary">ID:</span>{' '}
                                <span className="text-text-dark-primary">{operation.details.fullId}</span>
                              </p>
                              <p>
                                <span className="text-text-dark-secondary">Proposer:</span>{' '}
                                <span className="text-text-dark-primary">{operation.details.fullProposer}</span>
                              </p>
                              <p>
                                <span className="text-text-dark-secondary">Scheduled:</span>{' '}
                                <span className="text-text-dark-primary">{operation.details.scheduled}</span>
                              </p>
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <h4 className="text-xs font-bold uppercase text-text-dark-secondary mb-2">
                              Calls ({operation.details.callsDetails.length})
                            </h4>
                            <div className="flex flex-col gap-2 text-sm font-mono bg-background-dark p-3 rounded-md">
                              {operation.details.callsDetails.map((call, index) => (
                                <p key={index}>
                                  <span className="text-primary">{index + 1}.</span>{' '}
                                  <span className="text-text-dark-secondary">Target:</span>{' '}
                                  <span className="text-text-dark-primary">{call.target}</span>{' '}
                                  <span className="text-text-dark-secondary">Value:</span>{' '}
                                  <span className="text-text-dark-primary">{call.value}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
};

export default OperationsExplorerView;
