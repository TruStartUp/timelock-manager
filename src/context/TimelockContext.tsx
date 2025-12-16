// src/context/TimelockContext.tsx

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimelockConfiguration } from '@/types/timelock';
import { timelockConfigurationsArraySchema } from '@/lib/validation';

// Define the shape of the context state and actions
interface TimelockContextType {
  configurations: TimelockConfiguration[];
  selected: TimelockConfiguration | null;
  addConfig: (config: Omit<TimelockConfiguration, 'id'>) => void;
  removeConfig: (id: string) => void;
  select: (id: string | null) => void;
  isLoading: boolean;
  error: string | null;
}

// Create the context with a default undefined value
export const TimelockContext = createContext<TimelockContextType | undefined>(undefined);

// Provider component
export const TimelockProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [configurations, setConfigurations] = useState<TimelockConfiguration[]>([]);
  const [selected, setSelected] = useState<TimelockConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load from localStorage
  useEffect(() => {
    // This check is to prevent error "localStorage is not defined" on server side
    if (typeof window !== 'undefined') {
      try {
        const storedConfigs = localStorage.getItem('timelock-manager:configurations');
        if (storedConfigs) {
          const parsedConfigs = JSON.parse(storedConfigs);
          const validatedConfigs = timelockConfigurationsArraySchema.parse(parsedConfigs);
          setConfigurations(validatedConfigs);
          // Set a default selected configuration if available
          if (validatedConfigs.length > 0) {
            setSelected(validatedConfigs[0]);
          }
        }
      } catch (e) {
        console.error('Failed to load or parse timelock configurations from localStorage', e);
        setError('Failed to load timelock configurations.');
        setConfigurations([]);
      } finally {
        setIsLoading(false);
      }
    } else {
        setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever configurations change
  useEffect(() => {
    if (!isLoading && typeof window !== 'undefined') { // Only save after initial load and on client side
      try {
        localStorage.setItem('timelock-manager:configurations', JSON.stringify(configurations));
      } catch (e) {
        console.error('Failed to save timelock configurations to localStorage', e);
        setError('Failed to save timelock configurations.');
      }
    }
  }, [configurations, isLoading]);

  const addConfig = useCallback((config: Omit<TimelockConfiguration, 'id'>) => {
    const newConfig: TimelockConfiguration = { ...config, id: uuidv4() };
    setConfigurations((prev) => [...prev, newConfig]);
    if (!selected) { // Automatically select if it's the first one
      setSelected(newConfig);
    }
  }, [selected]);

  const removeConfig = useCallback((id: string) => {
    setConfigurations((prev) => {
        const newConfigs = prev.filter((config) => config.id !== id);
        if (selected?.id === id) {
          // If the selected config is removed, select the first one from the new list or null
          setSelected(newConfigs.length > 0 ? newConfigs[0] : null);
        }
        return newConfigs;
    });
  }, [selected]);

  const select = useCallback((id: string | null) => {
    if (id === null) {
      setSelected(null);
      return;
    }
    const configToSelect = configurations.find(config => config.id === id);
    if (configToSelect) {
      setSelected(configToSelect);
    } else {
      console.error(`Configuration with ID ${id} not found.`);
      setError(`Configuration with ID ${id} not found.`);
    }
  }, [configurations]);


  const value = {
    configurations,
    selected,
    addConfig,
    removeConfig,
    select,
    isLoading,
    error,
  };

  return <TimelockContext.Provider value={value}>{children}</TimelockContext.Provider>;
};
