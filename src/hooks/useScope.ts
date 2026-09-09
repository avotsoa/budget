import { useContext } from 'react';
import { ScopeContext } from '@/contexts/ScopeContext';

export function useScope() {
  const context = useContext(ScopeContext);
  if (!context) throw new Error('useScope doit être utilisé dans <ScopeProvider>');
  return context;
}
