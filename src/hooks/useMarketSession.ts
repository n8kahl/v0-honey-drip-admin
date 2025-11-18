import { useState, useEffect } from 'react';
import { massiveClient } from '../lib/massive/client';
import {
  MarketSessionState,
  parseMarketSession,
  getFallbackSession,
  type MassiveMarketStatusResponse,
} from '../lib/marketSession';

const POLL_INTERVAL = 60000; // Poll every 60 seconds
const STALE_THRESHOLD = 120000; // Consider data stale after 2 minutes

export function useMarketSession() {
  const [sessionState, setSessionState] = useState<MarketSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchSession = async () => {
    try {
      const data = await massiveClient.getMarketStatus() as MassiveMarketStatusResponse;
      const session = parseMarketSession(data);
      setSessionState(session);
      setError(null);
    } catch (err: any) {
      console.error('[v0] Market session fetch failed, using fallback:', err);
      
      // Use fallback instead of failing
      const fallback = getFallbackSession();
      setSessionState(fallback);
      setError('Using time-based fallback');
    } finally {
      setLoading(false);
    }
  };
  
  // CENTRALIZED - REMOVE: Market session polling replaced by marketDataStore
  useEffect(() => {
    // Fetch immediately
    fetchSession();
    
    // DEPRECATED: Poll at interval - use marketDataStore.marketStatus instead
    // const interval = setInterval(fetchSession, POLL_INTERVAL);
    
    return () => {
      // clearInterval(interval);
    };
  }, []);
  
  // Check if data is stale
  const isStale = sessionState 
    ? Date.now() - new Date(sessionState.asOf).getTime() > STALE_THRESHOLD
    : false;
  
  return {
    session: sessionState?.session || 'CLOSED',
    sessionState,
    loading,
    error,
    isStale,
  };
}
