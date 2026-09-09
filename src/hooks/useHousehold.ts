import { useContext } from 'react';
import { HouseholdContext } from '@/contexts/HouseholdContext';

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error('useHousehold doit être utilisé dans <HouseholdProvider>');
  return context;
}
