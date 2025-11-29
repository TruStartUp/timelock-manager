import { useState } from 'react';

const SettingsView = () => {
  const [useCustomRpc, setUseCustomRpc] = useState(false);
  const [rpcUrl, setRpcUrl] = useState('');

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap justify-between gap-3 mb-10">
          <div className="flex min-w-72 flex-col gap-3">
            <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">
              Configuration
            </p>
            <p className="text-[#bbad9b] text-base font-normal leading-normal">
              Manage network preferences, custom RPC URLs, and contract ABIs.
            </p>
          </div>
        </div>
        <section className="flex flex-col gap-6">
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3 border-b border-[#3a3227]">
            Network Configuration
          </h2>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-4 rounded-lg border border-solid border-primary p-[15px] cursor-pointer bg-primary/10">
              <input
                defaultChecked
                className="h-5 w-5 appearance-none rounded-full border-2 border-[#55493a] bg-transparent checked:border-primary checked:bg-primary focus:outline-none focus:ring-0 focus:ring-offset-0 ring-offset-background-dark"
                name="network-selection"
                type="radio"
              />
              <div className="flex grow flex-col">
                <p className="text-white text-sm font-medium leading-normal">
                  Rootstock Mainnet
                </p>
                <p className="text-[#bbad9b] text-sm font-normal leading-normal">
                  Connect to the main Rootstock network.
                </p>
              </div>
              <span className="text-sm font-medium text-green-400">
                Connected
              </span>
            </label>
            <label className="flex items-center gap-4 rounded-lg border border-solid border-[#55493a] p-[15px] cursor-pointer hover:border-primary/50 transition-colors">
              <input
                className="h-5 w-5 appearance-none rounded-full border-2 border-[#55493a] bg-transparent checked:border-primary checked:bg-primary focus:outline-none focus:ring-0 focus:ring-offset-0 ring-offset-background-dark"
                name="network-selection"
                type="radio"
              />
              <div className="flex grow flex-col">
                <p className="text-white text-sm font-medium leading-normal">
                  Rootstock Testnet
                </p>
                <p className="text-[#bbad9b] text-sm font-normal leading-normal">
                  Connect to the test network for development.
                </p>
              </div>
            </label>
          </div>
          <div className="@container">
            <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-lg border border-[#55493a] bg-[#231a0f] p-5 @[480px]:flex-row @[480px]:items-center">
              <div className="flex flex-col gap-1">
                <p className="text-white text-base font-bold leading-tight">
                  Use Custom RPC Endpoint
                </p>
                <p className="text-[#bbad9b] text-base font-normal leading-normal">
                  Enable to connect to a custom RPC instead of the default.
                </p>
              </div>
              <label className="relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none bg-[#3a3227] p-0.5 has-[:checked]:justify-end has-[:checked]:bg-primary">
                <div
                  className="h-full w-[27px] rounded-full bg-white transition-transform"
                  style={{
                    boxShadow:
                      'rgba(0, 0, 0, 0.15) 0px 3px 8px, rgba(0, 0, 0, 0.06) 0px 3px 1px',
                  }}
                ></div>
                <input
                  className="invisible absolute"
                  type="checkbox"
                  onChange={() => setUseCustomRpc(!useCustomRpc)}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-medium text-white"
              htmlFor="rpc-url"
            >
              Custom RPC URL
            </label>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-[#55493a] bg-[#231a0f] px-4 py-2.5 text-white placeholder:text-[#bbad9b] focus:border-primary focus:ring-primary/50"
                disabled={!useCustomRpc}
                id="rpc-url"
                placeholder="https://mainnet.rsk.co"
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
              />
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-semibold text-primary disabled:text-primary/50 disabled:cursor-not-allowed"
                disabled={!useCustomRpc}
              >
                Test Connection
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button className="rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-[#3a3227] hover:bg-[#55493a] transition-colors">
              Reset to Default
            </button>
            <button
              className="rounded-full px-6 py-2.5 text-sm font-semibold text-black bg-primary hover:bg-primary/80 transition-colors disabled:bg-primary/40 disabled:cursor-not-allowed"
              disabled
            >
              Save Network Settings
            </button>
          </div>
        </section>
        <div className="my-12 h-px w-full bg-[#3a3227]"></div>
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                ABI Management
              </h2>
              <p className="text-[#bbad9b] text-base font-normal leading-normal mt-2">
                Manage ABIs used to interact with Timelock and AccessManager
                contracts.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white bg-[#3a3227] hover:bg-[#55493a] transition-colors">
                <span className="material-symbols-outlined text-base">
                  upload
                </span>
                Import ABI
              </button>
              <button className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white bg-[#3a3227] hover:bg-[#55493a] transition-colors">
                <span className="material-symbols-outlined text-base">
                  download
                </span>
                Export All
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-[#55493a] bg-[#231a0f] p-4">
              <div className="flex flex-col">
                <p className="text-white font-medium">TimelockController</p>
                <p className="text-sm text-[#bbad9b] font-mono">
                  0x1234...abcd
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-[#3a3227] text-[#bbad9b] hover:text-white transition-colors">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#55493a] bg-[#231a0f] p-4">
              <div className="flex flex-col">
                <p className="text-white font-medium">AccessManager</p>
                <p className="text-sm text-[#bbad9b] font-mono">
                  0x5678...efgh
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-[#3a3227] text-[#bbad9b] hover:text-white transition-colors">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#55493a] bg-[#231a0f] p-4">
              <div className="flex flex-col">
                <p className="text-white font-medium">
                  MyCustomContract (User Imported)
                </p>
                <p className="text-sm text-[#bbad9b] font-mono">
                  0x9abc...ijkl
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-[#3a3227] text-[#bbad9b] hover:text-white transition-colors">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default SettingsView;
