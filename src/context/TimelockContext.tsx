// src/context/TimelockContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimelockConfiguration } from '@/types/timelock';
import { timelockConfigurationsArraySchema } from '@/lib/validation';

// Define the shape of the context state and actions
interface TimelockContextType {
  configurations: TimelockConfiguration[];
  selectedConfiguration: TimelockConfiguration | null;
  addConfiguration: (config: Omit<TimelockConfiguration, 'id'>) => void;
  removeConfiguration: (id: string) => void;
  selectConfiguration: (id: string | null) => void;
  isLoading: boolean;
  error: string | null;
}

// Create the context with a default undefined value
const TimelockContext = createContext<TimelockContextType | undefined>(undefined);

// Provider component
export const TimelockProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [configurations, setConfigurations] = useState<TimelockConfiguration[]>([]);
  const [selectedConfiguration, setSelectedConfiguration] = useState<TimelockConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load from localStorage (will be expanded in T005)
  useEffect(() => {
    try {
      const storedConfigs = localStorage.getItem('timelock-manager:configurations');
      if (storedConfigs) {
        const parsedConfigs = JSON.parse(storedConfigs);
        const validatedConfigs = timelockConfigurationsArraySchema.parse(parsedConfigs);
        setConfigurations(validatedConfigs);
        // Set a default selected configuration if available
        if (validatedConfigs.length > 0) {
          setSelectedConfiguration(validatedConfigs[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load or parse timelock configurations from localStorage', e);
      setError('Failed to load timelock configurations.');
      setConfigurations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever configurations change (will be expanded in T005)
  useEffect(() => {
    if (!isLoading) { // Only save after initial load
      try {
        localStorage.setItem('timelock-manager:configurations', JSON.stringify(configurations));
      } catch (e) {
        console.error('Failed to save timelock configurations to localStorage', e);
        setError('Failed to save timelock configurations.');
      }
    }
  }, [configurations, isLoading]);

  const addConfiguration = useCallback((config: Omit<TimelockConfiguration, 'id'>) => {
    const newConfig: TimelockConfiguration = { ...config, id: uuidv4() };
    setConfigurations((prev) => [...prev, newConfig]);
    if (!selectedConfiguration) { // Automatically select if it's the first one
      setSelectedConfiguration(newConfig);
    }
  }, [selectedConfiguration]);

  const removeConfiguration = useCallback((id: string) => {
    setConfigurations((prev) => prev.filter((config) => config.id !== id));
    if (selectedConfiguration?.id === id) {
      setSelectedConfiguration(null); // Deselect if removed
    }
  }, [selectedConfiguration]);

  const selectConfiguration = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedConfiguration(null);
      return;
    }
    const configToSelect = configurations.find(config => config.id === id);
    if (configToSelect) {
      setSelectedConfiguration(configToSelect);
    } else {
      setError(`Configuration with ID ${id} not found.`);
    }
  }, [configurations]);


  const value = {
    configurations,
    selectedConfiguration,
    addConfiguration,
    removeConfiguration,
    selectConfiguration,
    isLoading,
    error,
  };

  return <TimelockContext.Provider value={value}>{children}</TimelockContext.Provider>;
};

// Custom hook to use the TimelockContext
export const useTimelocks = () => {
  const context = useContext(TimelockContext);
  if (context === undefined) {
    throw new Error('useTimelocks must be used within a TimelockProvider');
  }
  return context;
};
