// Streaming options chain hook returning normalized contracts and state
import { useOptionsChain } from './useMassiveData';

export function useStreamingOptionsChain(symbol: string | null) {
  // Request all expirations by default; strike window controlled server-side
  const { contracts, loading, error, asOf } = useOptionsChain(symbol);

  // Calculate staleness (stale if asOf is more than 5s ago)
  const isStale = asOf ? Date.now() - asOf > 5000 : false;

  return {
    contracts,
    loading,
    error,
    isStale,
    asOf,
  };
}
