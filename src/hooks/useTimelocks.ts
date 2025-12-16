import { useContext } from 'react';
import { TimelockContext } from '@/context/TimelockContext';

// Custom hook to use the TimelockContext
export const useTimelocks = () => {
  const context = useContext(TimelockContext);
  if (context === undefined) {
    throw new Error('useTimelocks must be used within a TimelockProvider');
  }
  return context;
};
