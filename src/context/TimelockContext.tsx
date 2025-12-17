// src/context/TimelockContext.tsx

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimelockConfiguration } from '@/types/timelock';
import { timelockConfigurationsArraySchema } from '@/lib/validation';

const STORAGE_KEY = 'timelock-manager:configurations'

function getSafeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function safeGetItem(key: string): { value: string | null; error: string | null } {
  const storage = getSafeStorage()
  if (!storage) {
    return { value: null, error: 'Local storage is unavailable in this environment.' }
  }
  try {
    return { value: storage.getItem(key), error: null }
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : 'Failed to read from local storage.',
    }
  }
}

function safeSetItem(key: string, value: string): { ok: boolean; error: string | null } {
  const storage = getSafeStorage()
  if (!storage) {
    return { ok: false, error: 'Local storage is unavailable in this environment.' }
  }
  try {
    storage.setItem(key, value)
    return { ok: true, error: null }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to write to local storage.',
    }
  }
}

function safeRemoveItem(key: string): { ok: boolean; error: string | null } {
  const storage = getSafeStorage()
  if (!storage) {
    return { ok: false, error: 'Local storage is unavailable in this environment.' }
  }
  try {
    storage.removeItem(key)
    return { ok: true, error: null }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to clear local storage.',
    }
  }
}

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
    if (typeof window === 'undefined') {
      setIsLoading(false)
      return
    }

    try {
      const { value: storedConfigs, error: readError } = safeGetItem(STORAGE_KEY)
      if (readError) {
        setError(`Unable to access local storage. ${readError}`)
        setConfigurations([])
        setSelected(null)
        return
      }

      if (!storedConfigs) {
        setConfigurations([])
        setSelected(null)
        setError(null)
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(storedConfigs)
      } catch (err) {
        console.error('Failed to parse timelock configurations from localStorage', err)
        setError(
          'Timelock configurations in local storage are corrupted. They were cleared so you can re-add them in Settings.'
        )
        setConfigurations([])
        setSelected(null)
        safeRemoveItem(STORAGE_KEY)
        return
      }

      const validated = timelockConfigurationsArraySchema.safeParse(parsed)
      if (!validated.success) {
        console.error(
          'Timelock configurations in localStorage failed validation',
          validated.error
        )
        setError(
          'Timelock configurations in local storage are invalid. They were cleared so you can re-add them in Settings.'
        )
        setConfigurations([])
        setSelected(null)
        safeRemoveItem(STORAGE_KEY)
        return
      }

      setConfigurations(validated.data)
      setSelected(validated.data[0] ?? null)
      setError(null)
    } finally {
      setIsLoading(false)
    }
  }, []);

  // Save to localStorage whenever configurations change
  useEffect(() => {
    if (isLoading) return
    if (typeof window === 'undefined') return // client only

    const payload = JSON.stringify(configurations)
    const result = safeSetItem(STORAGE_KEY, payload)
    if (!result.ok) {
      console.error('Failed to save timelock configurations to localStorage', result.error)
      setError(
        `Could not save timelock configurations to local storage. Your changes may not persist. ${result.error ?? ''}`.trim()
      )
    } else {
      // Clear storage-related errors once we successfully persist again.
      setError(null)
    }
  }, [configurations, isLoading]);

  const addConfig = useCallback((config: Omit<TimelockConfiguration, 'id'>) => {
    const newConfig: TimelockConfiguration = { ...config, id: uuidv4() };
    setConfigurations((prev) => [...prev, newConfig]);
    if (!selected) { // Automatically select if it's the first one
      setSelected(newConfig);
    }
    setError(null)
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
    setError(null)
  }, [selected]);

  const select = useCallback((id: string | null) => {
    if (id === null || id === '') {
      setSelected(null);
      setError(null)
      return;
    }
    const configToSelect = configurations.find(config => config.id === id);
    if (configToSelect) {
      setSelected(configToSelect);
      setError(null)
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
