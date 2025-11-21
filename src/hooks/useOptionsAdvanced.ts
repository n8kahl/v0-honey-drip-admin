import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  optionsAdvanced, 
  OptionsTrade, 
  OptionsQuote, 
  OptionsAgg1s,
  TradeTape,
  LiquidityMetrics,
  analyzeTradeTape,
  evaluateContractLiquidity,
  OptionsSnapshot
} from '../lib/massive/options-advanced';
import { streamingManager } from '../lib/massive/streaming-manager';

/**
 * Hook for streaming quotes with stale detection for watchlist tickers
 */
export function useStreamingQuote(symbol: string | null) {
  const [quote, setQuote] = useState<{ price: number; changePercent: number } | null>(null);
  const [asOf, setAsOf] = useState<number>(Date.now());
  const [source, setSource] = useState<'websocket' | 'rest'>('rest');
  const [isStale, setIsStale] = useState(false);
  const asOfRef = useRef(asOf);
  const sourceRef = useRef(source);
  
  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      setIsStale(false);
      return;
    }

    const now = Date.now();
    setAsOf(now);
    asOfRef.current = now;
    setSource('rest');
    sourceRef.current = 'rest';
    setIsStale(false);

    const handle = streamingManager.subscribe(symbol, ['quotes'], (data) => {
      if (data.type === 'quote') {
        setQuote({
          price: data.data.price,
          changePercent: data.data.changePercent || 0,
        });
        setAsOf(data.timestamp);
        asOfRef.current = data.timestamp;
        setSource(data.source);
        sourceRef.current = data.source;
        setIsStale(false);
      }
    });

    return () => {
      streamingManager.unsubscribe(handle);
    };
  }, [symbol]);

  return { quote, asOf, source, isStale };
}

/**
 * Hook for subscribing to real-time option trades
 */
export function useOptionTrades(ticker: string | null) {
  const [trades, setTrades] = useState<OptionsTrade[]>([]);
  const [tradeTape, setTradeTape] = useState<TradeTape | null>(null);
  const [quote, setQuote] = useState<OptionsQuote | null>(null);
  
  useEffect(() => {
    if (!ticker) {
      setTrades([]);
      setTradeTape(null);
      return;
    }
    
    const tradeBuffer: OptionsTrade[] = [];
    
    // Subscribe to trades
    const unsubTrades = optionsAdvanced.subscribeTrades(ticker, (trade) => {
      tradeBuffer.push(trade);
      setTrades(prev => [...prev, trade].slice(-100)); // Keep last 100 trades
    });
    
    // Subscribe to quotes for tape analysis
    const unsubQuotes = optionsAdvanced.subscribeQuotes(ticker, (newQuote) => {
      setQuote(newQuote);
    });

    return () => {
      unsubTrades();
      unsubQuotes();
    };
  }, [ticker]);
  
  return { trades, tradeTape, quote };
}

/**
 * Hook for real-time option quotes with liquidity metrics
 */
export function useOptionQuote(ticker: string | null, snapshot?: OptionsSnapshot) {
  const [quote, setQuote] = useState<OptionsQuote | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  
  useEffect(() => {
    if (!ticker) {
      setQuote(null);
      setLiquidity(null);
      return;
    }
    
    const unsubscribe = optionsAdvanced.subscribeQuotes(ticker, (newQuote) => {
      setQuote(newQuote);
      setLastUpdate(Date.now());
      
      // Calculate liquidity if we have snapshot data
      if (snapshot) {
        const metrics = evaluateContractLiquidity(snapshot, {
          maxSpreadPercent: 15,
          minVolume: 30,
          minOI: 50,
          minPrice: 0.05,
          maxPrice: 50,
          minBidSize: 5,
          minAskSize: 5,
        });
        setLiquidity(metrics);
      }
    });
    
    return unsubscribe;
  }, [ticker, snapshot]);
  
  return { quote, liquidity, lastUpdate, source: quote ? 'websocket' : 'rest' };
}

/**
 * Hook for 1-second aggregates (option or underlying)
 */
export function useAgg1s(ticker: string | null, isOption: boolean = false) {
  const [aggs, setAggs] = useState<OptionsAgg1s[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const bufferRef = useRef<OptionsAgg1s[]>([]);
  
  useEffect(() => {
    if (!ticker) {
      setAggs([]);
      return;
    }
    
    const unsubscribe = optionsAdvanced.subscribeAgg1s(ticker, (agg) => {
      bufferRef.current.push(agg);
      
      // Keep last 300 seconds (5 minutes) of data
      if (bufferRef.current.length > 300) {
        bufferRef.current = bufferRef.current.slice(-300);
      }
      
      setAggs([...bufferRef.current]);
      setLastUpdate(Date.now());
    }, isOption);
    
    return unsubscribe;
  }, [ticker, isOption]);
  
  return { aggs, lastUpdate };
}

/**
 * Hook for fetching options chain with quality filtering
 */
export function useFilteredOptionsChain(underlying: string | null) {
  const [contracts, setContracts] = useState<OptionsSnapshot[]>([]);
  const [filteredCount, setFilteredCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const refresh = useCallback(async () => {
    if (!underlying) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await optionsAdvanced.fetchOptionsChain(underlying, {
        maxSpreadPercent: 15,
        minVolume: 30,
        minOI: 50,
        minPrice: 0.05,
        maxPrice: 50,
        minBidSize: 5,
        minAskSize: 5,
      });
      
      setContracts(result.contracts);
      setFilteredCount(result.filtered);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [underlying]);
  
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return { contracts, filteredCount, loading, error, refresh };
}
