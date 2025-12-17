// src/components/timelock/TimelockSettings.tsx

import React, { useState } from 'react';
import { isAddress, type Address } from 'viem';
import { useTimelocks } from '@/hooks/useTimelocks';

/**
 * AddTimelockForm Component
 *
 * Form for adding new TimelockController configurations.
 * Validates address and URL format before submission.
 */
const AddTimelockForm: React.FC = () => {
  const { addConfig } = useTimelocks();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'rsk_mainnet' | 'rsk_testnet'>('rsk_testnet');
  const [subgraphUrl, setSubgraphUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Rootstock compatibility: validate lowercase address to avoid checksum issues
    const addressLower = address.trim().toLowerCase();
    if (!address.trim()) {
      newErrors.address = 'Address is required';
    } else if (!isAddress(addressLower)) {
      newErrors.address = 'Invalid Ethereum address';
    }

    if (!subgraphUrl.trim()) {
      newErrors.subgraphUrl = 'Subgraph URL is required';
    } else if (!subgraphUrl.trim().match(/^https?:\/\/.+/)) {
      newErrors.subgraphUrl = 'Invalid URL (must start with http:// or https://)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setSuccessMessage('');

    if (!validate()) return;

    // Rootstock compatibility: store address as lowercase to avoid checksum issues
    addConfig({
      name: name.trim(),
      address: address.trim().toLowerCase() as Address,
      network,
      subgraphUrl: subgraphUrl.trim(),
    });

    // Reset form and show success
    setName('');
    setAddress('');
    setNetwork('rsk_testnet');
    setSubgraphUrl('');
    setErrors({});
    setSuccessMessage('Timelock configuration added successfully!');

    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-white text-lg font-semibold">Add New Timelock</h3>

      {/* Name Field */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor="timelock-name">
          Name
        </label>
        <input
          className="w-full rounded-lg border border-[#55493a] bg-[#231a0f] px-4 py-2.5 text-white placeholder:text-[#bbad9b] focus:border-primary focus:ring-primary/50"
          id="timelock-name"
          placeholder="My Timelock Controller"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: '' }));
          }}
        />
        {errors.name && (
          <p className="text-sm text-red-400">{errors.name}</p>
        )}
      </div>

      {/* Address Field */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor="timelock-address">
          Contract Address
        </label>
        <input
          className="w-full rounded-lg border border-[#55493a] bg-[#231a0f] px-4 py-2.5 text-white placeholder:text-[#bbad9b] font-mono focus:border-primary focus:ring-primary/50 lowercase"
          id="timelock-address"
          placeholder="0x..."
          type="text"
          value={address}
          onChange={(e) => {
            // Rootstock compatibility: convert to lowercase to avoid checksum issues
            setAddress(e.target.value.toLowerCase());
            setErrors((prev) => ({ ...prev, address: '' }));
          }}
        />
        {errors.address && (
          <p className="text-sm text-red-400">{errors.address}</p>
        )}
      </div>

      {/* Network Field */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor="timelock-network">
          Network
        </label>
        <select
          className="w-full rounded-lg border border-[#55493a] bg-[#231a0f] px-4 py-2.5 text-white focus:border-primary focus:ring-primary/50"
          id="timelock-network"
          value={network}
          onChange={(e) => setNetwork(e.target.value as 'rsk_mainnet' | 'rsk_testnet')}
        >
          <option value="rsk_testnet">Rootstock Testnet</option>
          <option value="rsk_mainnet">Rootstock Mainnet</option>
        </select>
      </div>

      {/* Subgraph URL Field */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor="timelock-subgraph">
          Subgraph URL
        </label>
        <input
          className="w-full rounded-lg border border-[#55493a] bg-[#231a0f] px-4 py-2.5 text-white placeholder:text-[#bbad9b] focus:border-primary focus:ring-primary/50"
          id="timelock-subgraph"
          placeholder="https://api.studio.thegraph.com/query/..."
          type="text"
          value={subgraphUrl}
          onChange={(e) => {
            setSubgraphUrl(e.target.value);
            setErrors((prev) => ({ ...prev, subgraphUrl: '' }));
          }}
        />
        {errors.subgraphUrl && (
          <p className="text-sm text-red-400">{errors.subgraphUrl}</p>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <p className="text-sm text-green-400">{successMessage}</p>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-black bg-primary hover:bg-primary/80 transition-colors"
        >
          Add Timelock
        </button>
      </div>
    </form>
  );
}

/**
 * TimelockList Component
 *
 * Displays existing timelock configurations in a grid layout.
 * Allows users to remove configurations with confirmation.
 */
const TimelockList: React.FC = () => {
  const { configurations, removeConfig, selected } = useTimelocks();

  if (configurations.length === 0) {
    return (
      <div className="rounded-lg border border-[#55493a] bg-[#231a0f] p-6 text-center">
        <p className="text-[#bbad9b]">
          No timelock configurations yet. Add one above to get started.
        </p>
      </div>
    );
  }

  const handleRemove = (id: string, name: string): void => {
    if (window.confirm(`Are you sure you want to remove "${name}"?`)) {
      removeConfig(id);
    }
  };

  const shortenAddress = (addr: string): string => {
    if (addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div>
      <h3 className="text-white text-lg font-semibold mb-4">Configured Timelocks</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {configurations.map((config) => (
          <div
            key={config.id}
            className="rounded-lg border border-[#55493a] bg-[#231a0f] p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold flex items-center gap-2 flex-wrap">
                  {config.name}
                  {selected?.id === config.id && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </h4>
                <p className="text-xs text-text-secondary font-mono truncate mt-1" title={config.address}>
                  {shortenAddress(config.address)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      config.network === 'rsk_mainnet'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {config.network === 'rsk_mainnet' ? 'Mainnet' : 'Testnet'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(config.id, config.name)}
                className="rounded-full p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                title="Remove configuration"
                aria-label={`Remove ${config.name}`}
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
            <p className="text-xs text-text-secondary truncate mt-2" title={config.subgraphUrl}>
              {config.subgraphUrl}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * TimelockSettings Component
 *
 * Container component for managing timelock configurations.
 * Includes form for adding new timelocks and list of existing configurations.
 */
export const TimelockSettings: React.FC = () => {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3 border-b border-[#3a3227]">
        Timelock Configurations
      </h2>
      <p className="text-[#bbad9b] text-base">
        Manage your TimelockController contracts. Add new configurations or remove existing ones.
      </p>

      {/* Add Form */}
      <AddTimelockForm />

      {/* Divider */}
      <div className="my-6 h-px w-full bg-[#3a3227]"></div>

      {/* List View */}
      <TimelockList />
    </section>
  );
}
