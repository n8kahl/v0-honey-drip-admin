import { massive } from '.';
import { streamingManager } from './streaming-manager';
import { type TradeUpdate, type WebSocketMessage } from './websocket';

// Core option contract shape used by advanced helpers and tests
export interface OptionContract {
  ticker: string;
  strike_price?: number;
  expiration_date?: string;
  contract_type?: 'call' | 'put' | string;
  implied_volatility?: number;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    rho?: number;
  };
  open_interest?: number;
  volume?: number;
  last_quote?: {
    bid?: number;
    ask?: number;
    bp?: number;
    ap?: number;
    bid_size?: number;
    ask_size?: number;
  };
  day?: {
    volume?: number;
    open_interest?: number;
  };
}

export type OptionsSnapshot = OptionContract;

export interface UiOptionRow {
  ticker: string;
  type: 'C' | 'P';
  strike: number;
  expiration: string;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  oi?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  mid?: number;
}

export function toUiRow(s: OptionsSnapshot): UiOptionRow {
  const greeks = s.greeks ?? {};
  const quote = s.last_quote ?? {};
  const bid = quote.bid ?? quote.bp;
  const ask = quote.ask ?? quote.ap;
  let mid: number | undefined;
  if (bid != null && ask != null) {
    mid = (bid + ask) / 2;
  }

  return {
    ticker: s.ticker,
    type: s.contract_type?.toUpperCase() === 'CALL' ? 'C' : 'P',
    strike: Number(s.strike_price ?? 0),
    expiration: s.expiration_date ?? '',
    iv: s.implied_volatility,
    delta: greeks.delta,
    gamma: greeks.gamma,
    theta: greeks.theta,
    vega: greeks.vega,
    rho: greeks.rho,
    oi: s.open_interest ?? s.day?.open_interest,
    volume: s.volume ?? s.day?.volume,
    bid,
    ask,
    mid: mid ?? undefined,
  };
}

export interface OptionsQuote {
  ticker: string;
  bid: number;
  ask: number;
  mid: number;
  last?: number;
  volume?: number;
  openInterest?: number;
  bidSize?: number;
  askSize?: number;
  timestamp: number;
}

export interface OptionsTrade {
  price: number;
  size: number;
  exchange: number;
  conditions: number[];
  timestamp: number;
}

export interface OptionsAgg1s {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface TradeTape {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  buyVolume: number;
  sellVolume: number;
  largeTradeCount: number;
  vwap: number;
  buyPressure: number;
  // Enhanced flow metrics
  sweepCount: number;           // Multi-exchange aggressive fills (smart money)
  blockCount: number;            // Institutional-size trades (>$100k notional)
  unusualActivity: boolean;      // Volume significantly above normal
  darkPoolPercent: number;       // % of volume on dark pools
  avgTradeSize: number;          // Average contract size per trade
  flowScore: number;             // 0-100 overall flow strength score
  flowBias: 'bullish' | 'bearish' | 'neutral'; // Directional bias from flow
}

export interface LiquidityMetrics {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  spread: number;
  spreadPercent: number;
  volume: number;
  openInterest: number;
  warnings: string[];
}

export interface OptionsThresholds {
  maxSpreadPercent: number;
  minVolume: number;
  minOI: number;
  minPrice: number;
  maxPrice: number;
  minBidSize: number;
  minAskSize: number;
}

export interface OptionsUnderlying {
  ticker: string;
  price: number;
  changePercent?: number;
}

export function evaluateLiquidity(contract: OptionContract): LiquidityMetrics {
  const bid = contract.last_quote?.bid ?? contract.last_quote?.bp ?? 0;
  const ask = contract.last_quote?.ask ?? contract.last_quote?.ap ?? 0;
  const volume = contract.day?.volume ?? contract.volume ?? 0;
  const openInterest = contract.day?.open_interest ?? contract.open_interest ?? 0;

  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  const spread = bid > 0 && ask > 0 ? ask - bid : 0;
  const spreadPercent = mid > 0 ? (spread / mid) * 100 : 100;

  const warnings: string[] = [];
  if (spreadPercent > 5) warnings.push('Wide spread (>5%)');
  if (volume < 1000) warnings.push('Low volume (<1000)');
  if (openInterest < 1000) warnings.push('Low open interest (<1000)');

  let quality: LiquidityMetrics['quality'] = 'fair';
  if (spreadPercent <= 1 && volume >= 1000 && openInterest >= 5000) {
    quality = 'excellent';
  } else if (spreadPercent <= 3 && volume >= 1000 && openInterest >= 2000) {
    quality = 'good';
  } else if (spreadPercent > 5 || volume < 100 || openInterest < 100) {
    quality = 'poor';
  }

  return {
    quality,
    spread,
    spreadPercent,
    volume,
    openInterest,
    warnings,
  };
}

export function evaluateContractLiquidity(
  snapshot: OptionsSnapshot,
  thresholds: OptionsThresholds
): LiquidityMetrics {
  const base = evaluateLiquidity(snapshot);
  const warnings = [...base.warnings];
  let quality = base.quality;

  if (base.spreadPercent > thresholds.maxSpreadPercent) {
    warnings.push(`Spread above threshold (${thresholds.maxSpreadPercent}%)`);
    quality = 'poor';
  }
  if (base.volume < thresholds.minVolume) {
    warnings.push(`Volume below threshold (${thresholds.minVolume})`);
    quality = 'poor';
  }
  if (base.openInterest < thresholds.minOI) {
    warnings.push(`Open interest below threshold (${thresholds.minOI})`);
    quality = 'poor';
  }

  return {
    ...base,
    quality,
    warnings,
  };
}

export function analyzeTradeTape(
  trades: OptionsTrade[],
  quote?: OptionsQuote | null,
  openInterest?: number
): TradeTape {
  if (!trades.length) {
    return {
      sentiment: 'neutral',
      buyVolume: 0,
      sellVolume: 0,
      largeTradeCount: 0,
      vwap: 0,
      buyPressure: 0,
      sweepCount: 0,
      blockCount: 0,
      unusualActivity: false,
      darkPoolPercent: 0,
      avgTradeSize: 0,
      flowScore: 0,
      flowBias: 'neutral',
    };
  }

  let buyVolume = 0;
  let sellVolume = 0;
  let largeTradeCount = 0;
  let sweepCount = 0;
  let blockCount = 0;
  let darkPoolVolume = 0;
  let pvSum = 0;
  let vSum = 0;
  let prevPrice = trades[0].price;

  // Sweep detection: condition codes indicating multi-exchange aggressive fills
  // 37 = Intermarket Sweep, 38 = Derivatively Priced, 39 = Re-opening Prints, 41 = Sold Last
  const sweepConditions = new Set([37, 38, 41]);

  // Dark pool exchange codes (approximate, varies by data provider)
  const darkPoolExchanges = new Set([4, 7, 8, 9]); // Common dark pool venues

  for (const t of trades) {
    const size = t.size || 0;
    const price = t.price || 0;
    const notional = price * size * 100; // Contract notional value

    // Direction classification (enhanced)
    const isAggressiveBuy = t.conditions?.includes(37) || price > prevPrice;
    const isAggressiveSell = !isAggressiveBuy && price < prevPrice;

    // Sweep detection: multi-exchange aggressive orders (smart money)
    const isSweep = t.conditions?.some(c => sweepConditions.has(c)) ?? false;
    if (isSweep) sweepCount += 1;

    // Block detection: institutional-size trades (>$100k notional)
    if (notional > 100000) blockCount += 1;

    // Large trade threshold (100+ contracts)
    if (size >= 100) largeTradeCount += 1;

    // Dark pool volume tracking
    if (darkPoolExchanges.has(t.exchange)) {
      darkPoolVolume += size;
    }

    // Volume accounting
    if (isAggressiveBuy) buyVolume += size;
    if (isAggressiveSell) sellVolume += size;

    pvSum += price * size;
    vSum += size;
    prevPrice = price;
  }

  const vwap = vSum > 0 ? pvSum / vSum : quote?.mid ?? 0;
  const totalVolume = buyVolume + sellVolume || 1;
  const buyPressure = (buyVolume / totalVolume) * 100;
  const avgTradeSize = vSum / trades.length;
  const darkPoolPercent = (darkPoolVolume / vSum) * 100;

  // Unusual activity: current volume >> open interest (30%+ of OI is unusual)
  const unusualActivity = openInterest ? vSum > openInterest * 0.3 : false;

  // Flow score calculation (0-100)
  let flowScore = 0;
  flowScore += sweepCount * 15;           // Sweeps are high conviction (+15 each)
  flowScore += blockCount * 10;           // Blocks indicate institutions (+10 each)
  flowScore += largeTradeCount * 3;       // Large trades (+3 each)
  flowScore += unusualActivity ? 20 : 0;  // Unusual volume is significant (+20)
  flowScore += Math.abs(buyPressure - 50); // Directional bias strength (0-50)
  flowScore = Math.min(100, flowScore);

  // Flow bias: directional conviction from sweeps and blocks
  let flowBias: TradeTape['flowBias'] = 'neutral';
  const sweepBuyVolume = trades
    .filter(t => t.conditions?.some(c => sweepConditions.has(c)) && (t.price > prevPrice || t.conditions?.includes(37)))
    .reduce((sum, t) => sum + (t.size || 0), 0);
  const sweepSellVolume = trades
    .filter(t => t.conditions?.some(c => sweepConditions.has(c)) && t.price < prevPrice)
    .reduce((sum, t) => sum + (t.size || 0), 0);

  if (sweepBuyVolume > sweepSellVolume * 1.5 || (blockCount > 0 && buyPressure > 60)) {
    flowBias = 'bullish';
  } else if (sweepSellVolume > sweepBuyVolume * 1.5 || (blockCount > 0 && buyPressure < 40)) {
    flowBias = 'bearish';
  }

  // Sentiment (legacy, based on overall volume)
  let sentiment: TradeTape['sentiment'] = 'neutral';
  if (buyVolume > sellVolume * 1.2) sentiment = 'bullish';
  else if (sellVolume > buyVolume * 1.2) sentiment = 'bearish';

  return {
    sentiment,
    buyVolume,
    sellVolume,
    largeTradeCount,
    vwap,
    buyPressure,
    sweepCount,
    blockCount,
    unusualActivity,
    darkPoolPercent,
    avgTradeSize,
    flowScore,
    flowBias,
  };
}

class OptionsAdvancedManager {
  private restTradePollers: Map<string, any> = new Map();
  private lastRestTradeTimestamp: Map<string, number> = new Map();

  subscribeTrades(ticker: string, callback: (trade: OptionsTrade) => void): () => void {
    let active = true;

    const wsUnsubscribe = massive.subscribeOptionAggregates([ticker], (msg: WebSocketMessage) => {
      if (!active) return;
      if (msg.type !== 'trade') return;
      const data = msg.data as TradeUpdate;
      if (!data || data.ticker !== ticker) return;

      const trade: OptionsTrade = {
        price: data.price,
        size: data.size,
        exchange: data.exchange,
        conditions: data.conditions,
        timestamp: data.timestamp,
      };
      callback(trade);
    });

    const pollKey = ticker;

    const startRestPolling = () => {
      if (this.restTradePollers.has(pollKey)) return;

      const poll = async () => {
        if (!active) return;

        // Only use REST when WS is not open
        if (massive.getConnectionState() === 'open') {
          return;
        }

        try {
          const results = await massive.getOptionTrades(ticker, {
            limit: 50,
            order: 'asc',
            sort: 'timestamp',
          });

          if (!Array.isArray(results) || results.length === 0) return;

          const lastTs = this.lastRestTradeTimestamp.get(pollKey) ?? 0;
          let maxTs = lastTs;

          for (const r of results as any[]) {
            const ts =
              r.sip_timestamp ??
              r.participant_timestamp ??
              r.timestamp ??
              0;
            if (!ts || ts <= lastTs) continue;

            const trade: OptionsTrade = {
              price: r.price ?? 0,
              size: r.size ?? r.volume ?? 0,
              exchange: r.exchange ?? 0,
              conditions: Array.isArray(r.conditions) ? r.conditions : [],
              timestamp: ts,
            };

            callback(trade);
            if (ts > maxTs) {
              maxTs = ts;
            }
          }

          if (maxTs > lastTs) {
            this.lastRestTradeTimestamp.set(pollKey, maxTs);
          }
        } catch (error) {
          console.error('[OptionsAdvanced] REST trades poll failed', error);
        }
      };

      // Initial poll
      void poll();
      const interval = setInterval(poll, 3000);
      this.restTradePollers.set(pollKey, interval);
    };

    startRestPolling();

    return () => {
      active = false;
      wsUnsubscribe();
      const interval = this.restTradePollers.get(pollKey);
      if (interval) {
        clearInterval(interval);
        this.restTradePollers.delete(pollKey);
      }
      this.lastRestTradeTimestamp.delete(pollKey);
    };
  }

  subscribeQuotes(ticker: string, callback: (quote: OptionsQuote) => void): () => void {
    const handle = streamingManager.subscribe(
      ticker,
      ['options'],
      ({ data, timestamp }) => {
        let q: OptionsQuote | null = null;
        if (data && typeof data === 'object') {
          // From WS option stream
          if ('bid' in data || 'bp' in data) {
            const bid = (data.bid ?? data.bp) || 0;
            const ask = (data.ask ?? data.ap) || bid;
            const mid = ask && bid ? (ask + bid) / 2 : bid || ask;
            q = {
              ticker,
              bid,
              ask,
              mid,
              last: data.last,
              volume: data.volume,
              openInterest: data.open_interest,
              bidSize: data.bidSize ?? data.bs,
              askSize: data.askSize ?? data.as,
              timestamp,
            };
          } else if (data.last_quote) {
            const quote = data.last_quote;
            const bid = quote.bid ?? quote.bp ?? 0;
            const ask = quote.ask ?? quote.ap ?? bid;
            const mid = ask && bid ? (ask + bid) / 2 : bid || ask;
            q = {
              ticker,
              bid,
              ask,
              mid,
              last: data.last_trade?.price ?? data.underlying?.price,
              volume: data.day?.volume,
              openInterest: data.open_interest ?? data.day?.open_interest,
              bidSize: quote.bid_size,
              askSize: quote.ask_size,
              timestamp,
            };
          }
        }
        if (q) {
          callback(q);
        }
      },
      { isOption: true }
    );

    return () => streamingManager.unsubscribe(handle);
  }

  subscribeAgg1s(
    ticker: string,
    callback: (agg: OptionsAgg1s) => void,
    isOption: boolean = false
  ): () => void {
    if (isOption) {
      // Derive simple 1s bars from option quotes
      return this.subscribeQuotes(ticker, (quote) => {
        const t = Date.now();
        const price = quote.mid || quote.last || 0;
        const agg: OptionsAgg1s = {
          t,
          o: price,
          h: price,
          l: price,
          c: price,
          v: quote.volume ?? 0,
        };
        callback(agg);
      });
    }

    const handle = streamingManager.subscribe(
      ticker,
      ['agg1s'],
      ({ data, timestamp }) => {
        if (!data) return;
        const price = data.last || data.value || data.price || 0;
        const agg: OptionsAgg1s = {
          t: timestamp,
          o: price,
          h: price,
          l: price,
          c: price,
          v: data.volume || 0,
        };
        callback(agg);
      },
      { isOption: false }
    );

    return () => streamingManager.unsubscribe(handle);
  }

  async fetchOptionsChain(
    underlying: string,
    thresholds: OptionsThresholds
  ): Promise<{ contracts: OptionsSnapshot[]; filtered: number }> {
    const snapshot = await massive.getOptionsSnapshot(underlying);
    const results: OptionsSnapshot[] = snapshot.results || snapshot || [];
    const filtered: OptionsSnapshot[] = [];

    for (const contract of results) {
      const ui = toUiRow(contract);
      if (ui.mid == null || ui.mid < thresholds.minPrice || ui.mid > thresholds.maxPrice) continue;
      const metrics = evaluateContractLiquidity(contract, thresholds);
      if (metrics.quality === 'poor') continue;
      filtered.push(contract);
    }

    return {
      contracts: filtered,
      filtered: results.length - filtered.length,
    };
  }
}

export const optionsAdvanced = new OptionsAdvancedManager();
