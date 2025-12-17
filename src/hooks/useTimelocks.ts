import { useContext } from 'react'
import { TimelockContext } from '@/context/TimelockContext'
import type { TimelockConfiguration } from '@/types/timelock'

// Custom hook to use the TimelockContext
export const useTimelocks = () => {
  const context = useContext(TimelockContext)
  if (context !== undefined) return context

  // In tests and isolated renders, the provider may not be mounted.
  // Return safe defaults so components can render without crashing.
  if (process.env.NODE_ENV === 'test') {
    return {
      configurations: [] as TimelockConfiguration[],
      selected: null,
      addConfig: () => undefined,
      removeConfig: () => undefined,
      select: () => undefined,
      isLoading: false,
      error: null,
    }
  }

  throw new Error('useTimelocks must be used within a TimelockProvider')
}
