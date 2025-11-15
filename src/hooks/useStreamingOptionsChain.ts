// Streaming options chain hook with 3-second refresh
// Returns raw options data from Massive API that auto-refreshes while active

import { useOptionsChain } from './useMassiveData';

export function useStreamingOptionsChain(symbol: string | null) {
  const { optionsChain } = useOptionsChain(symbol);
  
  // Return the results array directly for use in components
  return optionsChain?.results || null;
}
