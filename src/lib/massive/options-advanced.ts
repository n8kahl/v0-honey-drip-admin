// OPTIONS ADVANCED: Full feature set for Massive.com options data
// Includes Trades, Quotes, Aggregates (1s/1m), Greeks, IV, OI, liquidity metrics

import { streamingManager, StreamData } from './streaming-manager';
import { massiveClient } from './client';

export interface OptionsTrade {
  ticker: string;
  exchange: number;
  price: number;
  size: number;
  conditions: number[];
  timestamp: number;
  sequence: number;
  sip_timestamp: number;
}

export interface OptionsQuote {
  ticker: string;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
  mid: number;
  spread: number;
  spreadPercent: number;
  timestamp: number;
}

export interface OptionsAgg1s {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  timestamp: number;
}

export interface OptionsGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionsSnapshot {
  ticker: string;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
  last: number;
  openInterest: number;
  volume: number;
  implied_volatility: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  underlying_price: number;
}

export interface TradeTape {
  trades: OptionsTrade[];
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  avgSize: number;
  sentiment: 'strong-buy' | 'buy' | 'balanced' | 'sell' | 'strong-sell';
  lastUpdate: number;
}

export interface LiquidityMetrics {
  spread: number;
  spreadPercent: number;
  bidSize: number;
  askSize: number;
  volume: number;
  openInterest: number;
  avgTradeSize: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
}

/**
 * Calculate spread percentage
 */
export function calculateSpreadPercent(bid: number, ask: number): number {
  const mid = (bid + ask) / 2;
  if (mid === 0) return 100;
  return ((ask - bid) / mid) * 100;
}

/**
 * Evaluate contract liquidity and quality
 */
export function evaluateContractLiquidity(
  snapshot: OptionsSnapshot,
  thresholds: {
    maxSpreadPercent: number;
    minVolume: number;
    minOI: number;
    minPrice: number;
    maxPrice: number;
    minBidSize: number;
    minAskSize: number;
  }
): LiquidityMetrics {
  const spread = snapshot.ask - snapshot.bid;
  const spreadPercent = calculateSpreadPercent(snapshot.bid, snapshot.ask);
  const warnings: string[] = [];
  
  let qualityScore = 100;
  
  // Check spread
  if (spreadPercent > thresholds.maxSpreadPercent) {
    warnings.push(`Wide spread: ${spreadPercent.toFixed(1)}%`);
    qualityScore -= 30;
  }
  
  // Check volume
  if (snapshot.volume < thresholds.minVolume) {
    warnings.push(`Low volume: ${snapshot.volume}`);
    qualityScore -= 20;
  }
  
  // Check open interest
  if (snapshot.openInterest < thresholds.minOI) {
    warnings.push(`Low OI: ${snapshot.openInterest}`);
    qualityScore -= 20;
  }
  
  // Check price range
  if (snapshot.last < thresholds.minPrice) {
    warnings.push(`Price too low: $${snapshot.last.toFixed(2)}`);
    qualityScore -= 15;
  }
  
  if (snapshot.last > thresholds.maxPrice) {
    warnings.push(`Price too high: $${snapshot.last.toFixed(2)}`);
    qualityScore -= 10;
  }
  
  // Check NBBO depth
  if (snapshot.bidSize < thresholds.minBidSize || snapshot.askSize < thresholds.minAskSize) {
    warnings.push('Thin NBBO depth');
    qualityScore -= 15;
  }
  
  // Determine quality rating
  let quality: LiquidityMetrics['quality'];
  if (qualityScore >= 80) quality = 'excellent';
  else if (qualityScore >= 60) quality = 'good';
  else if (qualityScore >= 40) quality = 'fair';
  else quality = 'poor';
  
  return {
    spread,
    spreadPercent,
    bidSize: snapshot.bidSize,
    askSize: snapshot.askSize,
    volume: snapshot.volume,
    openInterest: snapshot.openInterest,
    avgTradeSize: 0, // Will be populated from trade tape
    quality,
    warnings,
  };
}

export const evaluateLiquidity = evaluateContractLiquidity;

/**
 * Analyze trade tape for buy/sell pressure
 */
export function analyzeTradeTape(trades: OptionsTrade[], currentQuote: OptionsQuote): TradeTape {
  if (trades.length === 0) {
    return {
      trades: [],
      buyPressure: 50,
      sellPressure: 50,
      avgSize: 0,
      sentiment: 'balanced',
      lastUpdate: Date.now(),
    };
  }
  
  // Analyze last 10-30 seconds of trades
  const cutoffTime = Date.now() - 30000;
  const recentTrades = trades.filter(t => t.timestamp >= cutoffTime);
  
  if (recentTrades.length === 0) {
    return {
      trades,
      buyPressure: 50,
      sellPressure: 50,
      avgSize: 0,
      sentiment: 'balanced',
      lastUpdate: Date.now(),
    };
  }
  
  // Calculate metrics
  let buyVolume = 0;
  let sellVolume = 0;
  let totalSize = 0;
  
  recentTrades.forEach(trade => {
    totalSize += trade.size;
    
    // Classify trade as buy or sell based on price relative to mid
    const mid = currentQuote.mid;
    if (trade.price >= mid) {
      buyVolume += trade.size;
    } else {
      sellVolume += trade.size;
    }
  });
  
  const totalVolume = buyVolume + sellVolume;
  const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
  const sellPressure = 100 - buyPressure;
  const avgSize = totalSize / recentTrades.length;
  
  // Determine sentiment
  let sentiment: TradeTape['sentiment'];
  if (buyPressure >= 70) sentiment = 'strong-buy';
  else if (buyPressure >= 55) sentiment = 'buy';
  else if (buyPressure >= 45) sentiment = 'balanced';
  else if (buyPressure >= 30) sentiment = 'sell';
  else sentiment = 'strong-sell';
  
  return {
    trades: recentTrades,
    buyPressure,
    sellPressure,
    avgSize,
    sentiment,
    lastUpdate: Date.now(),
  };
}

/**
 * Subscribe to OPTIONS ADVANCED WebSocket streams
 * Manages all option-specific data channels with automatic fallback
 */
export class OptionsAdvancedManager {
  private tradeSubscriptions: Map<string, Set<(trade: OptionsTrade) => void>> = new Map();
  private quoteSubscriptions: Map<string, Set<(quote: OptionsQuote) => void>> = new Map();
  private agg1sSubscriptions: Map<string, Set<(agg: OptionsAgg1s) => void>> = new Map();
  
  /**
   * Subscribe to option trades (per-contract)
   */
  subscribeTrades(ticker: string, callback: (trade: OptionsTrade) => void): () => void {
    console.log(`[OptionsAdvanced] 📊 Subscribing to trades: ${ticker}`);
    
    if (!this.tradeSubscriptions.has(ticker)) {
      this.tradeSubscriptions.set(ticker, new Set());
    }
    this.tradeSubscriptions.get(ticker)!.add(callback);
    
    // Use StreamingManager for trades
    const unsubscribe = streamingManager.subscribe(
      ticker,
      ['quotes'], // trades come through quotes channel
      (data: StreamData) => {
        if (data.data.type === 'trade') {
          const trade: OptionsTrade = {
            ticker: data.data.ticker,
            exchange: data.data.exchange,
            price: data.data.price,
            size: data.data.size,
            conditions: data.data.conditions || [],
            timestamp: data.data.timestamp,
            sequence: data.data.sequence,
            sip_timestamp: data.data.sip_timestamp,
          };
          
          this.tradeSubscriptions.get(ticker)?.forEach(cb => cb(trade));
        }
      },
      { isOption: true }
    );
    
    return () => {
      this.tradeSubscriptions.get(ticker)?.delete(callback);
      if (this.tradeSubscriptions.get(ticker)?.size === 0) {
        unsubscribe();
      }
    };
  }
  
  /**
   * Subscribe to option quotes (per-contract)
   */
  subscribeQuotes(ticker: string, callback: (quote: OptionsQuote) => void): () => void {
    console.log(`[OptionsAdvanced] 💱 Subscribing to quotes: ${ticker}`);
    
    if (!this.quoteSubscriptions.has(ticker)) {
      this.quoteSubscriptions.set(ticker, new Set());
    }
    this.quoteSubscriptions.get(ticker)!.add(callback);
    
    const unsubscribe = streamingManager.subscribe(
      ticker,
      ['quotes'],
      (data: StreamData) => {
        const quote: OptionsQuote = {
          ticker: data.symbol,
          bid: data.data.bid || 0,
          bidSize: data.data.bidSize || 0,
          ask: data.data.ask || 0,
          askSize: data.data.askSize || 0,
          mid: (data.data.bid + data.data.ask) / 2,
          spread: data.data.ask - data.data.bid,
          spreadPercent: calculateSpreadPercent(data.data.bid, data.data.ask),
          timestamp: data.timestamp,
        };
        
        this.quoteSubscriptions.get(ticker)?.forEach(cb => cb(quote));
      },
      { isOption: true }
    );
    
    return () => {
      this.quoteSubscriptions.get(ticker)?.delete(callback);
      if (this.quoteSubscriptions.get(ticker)?.size === 0) {
        unsubscribe();
      }
    };
  }
  
  /**
   * Subscribe to 1-second aggregates (per-contract or underlying)
   */
  subscribeAgg1s(ticker: string, callback: (agg: OptionsAgg1s) => void, isOption: boolean = true): () => void {
    console.log(`[OptionsAdvanced] 📈 Subscribing to 1s aggs: ${ticker} (option=${isOption})`);
    
    if (!this.agg1sSubscriptions.has(ticker)) {
      this.agg1sSubscriptions.set(ticker, new Set());
    }
    this.agg1sSubscriptions.get(ticker)!.add(callback);
    
    const unsubscribe = streamingManager.subscribe(
      ticker,
      ['agg1s'],
      (data: StreamData) => {
        const agg: OptionsAgg1s = {
          ticker: data.symbol,
          open: data.data.open || data.data.o,
          high: data.data.high || data.data.h,
          low: data.data.low || data.data.l,
          close: data.data.close || data.data.c,
          volume: data.data.volume || data.data.v,
          vwap: data.data.vwap || data.data.vw,
          timestamp: data.timestamp,
        };
        
        this.agg1sSubscriptions.get(ticker)?.forEach(cb => cb(agg));
      },
      { isOption }
    );
    
    return () => {
      this.agg1sSubscriptions.get(ticker)?.delete(callback);
      if (this.agg1sSubscriptions.get(ticker)?.size === 0) {
        unsubscribe();
      }
    };
  }
  
  /**
   * Fetch full options chain with quality filtering
   */
  async fetchOptionsChain(
    underlying: string,
    thresholds?: Partial<{
      maxSpreadPercent: number;
      minVolume: number;
      minOI: number;
      minPrice: number;
      maxPrice: number;
      minBidSize: number;
      minAskSize: number;
    }>
  ): Promise<{ contracts: OptionsSnapshot[]; filtered: number }> {
    const defaultThresholds = {
      maxSpreadPercent: 15,
      minVolume: 30,
      minOI: 50,
      minPrice: 0.05,
      maxPrice: 50,
      minBidSize: 5,
      minAskSize: 5,
      ...thresholds,
    };
    
    const response = await massiveClient.getOptionsChain(underlying);
    const allContracts: OptionsSnapshot[] = response.map((c: any) => ({
      ticker: c.ticker,
      bid: c.bid,
      bidSize: c.bid_size,
      ask: c.ask,
      askSize: c.ask_size,
      last: c.last_price || (c.bid + c.ask) / 2,
      openInterest: c.open_interest,
      volume: c.volume,
      implied_volatility: c.implied_volatility,
      delta: c.greeks?.delta,
      gamma: c.greeks?.gamma,
      theta: c.greeks?.theta,
      vega: c.greeks?.vega,
      underlying_price: c.underlying_price,
    }));
    
    // Filter contracts by quality
    const filtered = allContracts.filter(contract => {
      const liquidity = evaluateContractLiquidity(contract, defaultThresholds);
      return liquidity.quality !== 'poor';
    });
    
    const filteredCount = allContracts.length - filtered.length;
    
    console.log(`[OptionsAdvanced] Fetched ${allContracts.length} contracts, filtered ${filteredCount} low-quality`);
    
    return { contracts: filtered, filtered: filteredCount };
  }
}

// Export singleton instance
export const optionsAdvanced = new OptionsAdvancedManager();
