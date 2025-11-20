/**
 * Mock Data Generator for Demo Mode
 * Generates realistic market data, options contracts, and strategy signals
 */

import type { Bar } from '../indicators';
import type { OptionContract } from '../massive/options-advanced';
import type { AggregatedFlowMetrics } from '../massive/aggregate-flow';
import type { StrategySignal } from '../../types/strategy';

/**
 * Generate realistic OHLCV bars for a symbol
 */
export function generateMockBars(
  symbol: string,
  count: number = 200,
  basePrice: number = 5000,
  volatility: number = 0.02
): Bar[] {
  const bars: Bar[] = [];
  const now = Date.now();
  const fiveMinutesMs = 5 * 60 * 1000;

  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const timestamp = Math.floor((now - (count - i) * fiveMinutesMs) / 1000);

    // Simulate price movement with some trend and noise
    const trendBias = Math.sin(i / 20) * 0.001; // Slow oscillating trend
    const noise = (Math.random() - 0.5) * volatility;
    const change = 1 + trendBias + noise;

    const open = price;
    const high = open * (1 + Math.abs(noise) / 2 + Math.random() * 0.003);
    const low = open * (1 - Math.abs(noise) / 2 - Math.random() * 0.003);
    const close = open * change;

    // Ensure high/low bounds
    const candleHigh = Math.max(open, close, high);
    const candleLow = Math.min(open, close, low);

    // Realistic volume (higher volatility = higher volume)
    const baseVolume = symbol.includes('SPX') ? 50000 : symbol.includes('SPY') ? 5000000 : 100000;
    const volumeMultiplier = 1 + Math.abs(noise) * 10 + (Math.random() * 0.5);
    const volume = Math.floor(baseVolume * volumeMultiplier);

    bars.push({
      time: timestamp,
      open,
      high: candleHigh,
      low: candleLow,
      close,
      volume,
    });

    price = close;
  }

  return bars;
}

/**
 * Generate mock options contracts with realistic Greeks and flow data
 */
export function generateMockOptionsChain(
  underlyingSymbol: string,
  underlyingPrice: number,
  expiryDTE: number = 0
): OptionContract[] {
  const contracts: OptionContract[] = [];
  const now = Date.now();
  const expiryDate = new Date(now + expiryDTE * 24 * 60 * 60 * 1000);

  // Generate strikes around current price (95% to 105%)
  const strikeMin = Math.floor(underlyingPrice * 0.95 / 5) * 5;
  const strikeMax = Math.ceil(underlyingPrice * 1.05 / 5) * 5;
  const strikeStep = underlyingSymbol.includes('SPX') ? 5 : 1;

  for (let strike = strikeMin; strike <= strikeMax; strike += strikeStep) {
    // Generate both call and put
    ['call', 'put'].forEach((type) => {
      const optionType = type as 'call' | 'put';
      const isCall = optionType === 'call';

      // Calculate moneyness
      const moneyness = isCall
        ? (underlyingPrice - strike) / strike
        : (strike - underlyingPrice) / strike;
      const isITM = moneyness > 0;
      const isATM = Math.abs(strike - underlyingPrice) < strikeStep * 2;

      // Delta based on moneyness (simplified Black-Scholes approximation)
      const atmDelta = isCall ? 0.5 : -0.5;
      let delta: number;
      if (isATM) {
        delta = atmDelta + (Math.random() - 0.5) * 0.1;
      } else {
        const distance = Math.abs(strike - underlyingPrice) / underlyingPrice;
        delta = isCall
          ? Math.max(0.05, 1 - distance * 5) * (isITM ? 1 : 0.3)
          : Math.min(-0.05, -(1 - distance * 5)) * (isITM ? 1 : 0.3);
      }

      // Gamma (highest ATM, decays away from ATM)
      const gamma = isATM
        ? 0.02 + Math.random() * 0.01
        : 0.005 / (1 + Math.abs(moneyness) * 10);

      // Theta (time decay, higher for ATM options)
      const theta = isATM
        ? -(8 + Math.random() * 4) // -8 to -12 per day for ATM
        : -(2 + Math.random() * 3); // -2 to -5 for OTM

      // Vega (IV sensitivity, higher ATM)
      const vega = isATM
        ? 15 + Math.random() * 10
        : 5 + Math.random() * 5;

      // Implied volatility (higher for OTM, vol smile)
      const baseIV = 0.15 + Math.abs(moneyness) * 0.5;
      const iv = baseIV + (Math.random() - 0.5) * 0.05;

      // Bid/ask based on moneyness and IV
      const intrinsicValue = Math.max(0, isCall ? underlyingPrice - strike : strike - underlyingPrice);
      const extrinsicValue = iv * underlyingPrice * Math.sqrt(expiryDTE / 365) * (isATM ? 0.4 : 0.2);
      const midPrice = intrinsicValue + extrinsicValue;
      const spread = midPrice * 0.02; // 2% spread

      const bid = Math.max(0.05, midPrice - spread / 2);
      const ask = midPrice + spread / 2;

      // Volume and OI (higher for ATM)
      const volumeMultiplier = isATM ? 5 : (isITM ? 2 : 1);
      const volume = Math.floor((500 + Math.random() * 1500) * volumeMultiplier);
      const openInterest = Math.floor((2000 + Math.random() * 8000) * volumeMultiplier);

      // Flow metrics (random but realistic)
      const hasSweep = Math.random() > 0.9; // 10% chance of sweep
      const hasBlock = Math.random() > 0.95; // 5% chance of block
      const hasUnusual = Math.random() > 0.85; // 15% chance of unusual activity

      const sweepCount = hasSweep ? Math.floor(Math.random() * 3) + 1 : 0;
      const blockCount = hasBlock ? Math.floor(Math.random() * 2) + 1 : 0;
      const largeTradeCount = Math.floor(Math.random() * 10);

      const buyPressure = 0.3 + Math.random() * 0.4; // 0.3 to 0.7
      const flowScore = sweepCount * 15 + blockCount * 10 + largeTradeCount * 2 + (hasUnusual ? 20 : 0);
      const flowBias: 'bullish' | 'bearish' | 'neutral' =
        buyPressure > 0.6 ? 'bullish' : buyPressure < 0.4 ? 'bearish' : 'neutral';

      // Create contract ticker (simplified format)
      const expiryStr = expiryDate.toISOString().split('T')[0].replace(/-/g, '');
      const ticker = `O:${underlyingSymbol}${expiryStr}${isCall ? 'C' : 'P'}${strike.toFixed(0).padStart(8, '0')}`;

      contracts.push({
        ticker,
        underlyingSymbol,
        optionType,
        strike,
        expiry: expiryDate.toISOString(),
        dte: expiryDTE,
        bid,
        ask,
        mid: midPrice,
        last: midPrice + (Math.random() - 0.5) * spread,
        volume,
        openInterest,
        impliedVolatility: iv,
        delta: Math.abs(delta), // Store absolute delta
        gamma,
        theta,
        vega,
        rho: 0.01 + Math.random() * 0.05,
        intrinsicValue,
        extrinsicValue,
        timeValue: extrinsicValue,
        breakEvenPrice: isCall ? strike + midPrice : strike - midPrice,
        maxProfit: isCall ? Infinity : strike - midPrice,
        maxLoss: midPrice,
        probabilityITM: Math.abs(delta),
        probabilityOTM: 1 - Math.abs(delta),
        probabilityTouch: Math.abs(delta) * 2,
        expectedMove: underlyingPrice * iv * Math.sqrt(expiryDTE / 365),
        tradeTape: {
          sentiment: flowBias === 'bullish' ? 'bullish' : flowBias === 'bearish' ? 'bearish' : 'neutral',
          buyVolume: Math.floor(volume * buyPressure),
          sellVolume: Math.floor(volume * (1 - buyPressure)),
          largeTradeCount,
          vwap: midPrice,
          buyPressure,
          sweepCount,
          blockCount,
          unusualActivity: hasUnusual,
          darkPoolPercent: Math.random() * 20,
          avgTradeSize: volume > 0 ? volume / (largeTradeCount + 10) : 0,
          flowScore,
          flowBias,
        },
      });
    });
  }

  // Sort by volume descending (most liquid first)
  return contracts.sort((a, b) => (b.volume || 0) - (a.volume || 0));
}

/**
 * Generate aggregated flow metrics for a symbol
 */
export function generateMockAggregatedFlow(
  symbol: string,
  bias: 'bullish' | 'bearish' | 'neutral' = 'neutral'
): AggregatedFlowMetrics {
  const hasMajorFlow = Math.random() > 0.6; // 40% chance of significant flow

  const sweepCount = hasMajorFlow ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 2);
  const blockCount = hasMajorFlow ? Math.floor(Math.random() * 3) + 1 : 0;
  const unusualActivity = hasMajorFlow && Math.random() > 0.5;

  const buyPressure = bias === 'bullish'
    ? 0.6 + Math.random() * 0.3
    : bias === 'bearish'
    ? 0.2 + Math.random() * 0.3
    : 0.4 + Math.random() * 0.2;

  const flowScore = Math.min(100,
    sweepCount * 15 +
    blockCount * 10 +
    (unusualActivity ? 20 : 0) +
    Math.floor(Math.random() * 20)
  );

  const totalVolume = symbol.includes('SPX')
    ? 100000 + Math.floor(Math.random() * 200000)
    : 50000 + Math.floor(Math.random() * 100000);

  const callPutRatio = bias === 'bullish'
    ? 1.3 + Math.random() * 0.7
    : bias === 'bearish'
    ? 0.5 + Math.random() * 0.5
    : 0.8 + Math.random() * 0.4;

  const callVolume = Math.floor(totalVolume * callPutRatio / (1 + callPutRatio));
  const putVolume = totalVolume - callVolume;

  return {
    sweepCount,
    blockCount,
    unusualActivity,
    flowScore,
    flowBias: bias,
    buyPressure,
    totalVolume,
    callVolume,
    putVolume,
    callPutRatio,
    avgTradeSize: Math.floor(totalVolume / (20 + Math.random() * 30)),
    largeTradeCount: sweepCount + blockCount + Math.floor(Math.random() * 10),
    contractsAnalyzed: 20,
    timestamp: Date.now(),
    symbol,
  };
}

/**
 * Generate mock strategy signals
 */
export function generateMockStrategySignals(
  symbol: string,
  strategyNames: string[] = ['ORB + Flow', 'EMA Bounce', 'VWAP Reclaim']
): Partial<StrategySignal>[] {
  const signals: Partial<StrategySignal>[] = [];
  const now = Date.now();

  // Randomly generate 0-3 signals for the symbol
  const signalCount = Math.floor(Math.random() * 4);

  for (let i = 0; i < signalCount; i++) {
    const strategyName = strategyNames[Math.floor(Math.random() * strategyNames.length)];
    const confidence = 50 + Math.floor(Math.random() * 45); // 50-95%
    const createdAt = new Date(now - Math.floor(Math.random() * 3600000)); // Within last hour

    signals.push({
      symbol,
      confidence,
      status: 'ACTIVE',
      createdAt: createdAt.toISOString(),
      payload: {
        strategyName,
        entryPrice: 5000 + Math.random() * 100,
        stopLoss: 4950 + Math.random() * 50,
        targets: [5050, 5100, 5150],
      },
    });
  }

  return signals;
}

/**
 * Demo symbols with realistic prices
 */
export const DEMO_SYMBOLS = [
  { symbol: 'SPX', name: 'S&P 500 Index', price: 5850, volatility: 0.015 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 585, volatility: 0.015 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 495, volatility: 0.020 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 875, volatility: 0.035 },
  { symbol: 'TSLA', name: 'Tesla Inc', price: 350, volatility: 0.045 },
  { symbol: 'AAPL', name: 'Apple Inc', price: 225, volatility: 0.025 },
];

/**
 * Generate complete demo dataset for a symbol
 */
export function generateCompleteDemo() {
  return DEMO_SYMBOLS.map(({ symbol, price, volatility }) => {
    const bars = generateMockBars(symbol, 200, price, volatility);
    const optionsChain = generateMockOptionsChain(symbol, price, 0); // 0DTE
    const flowBias = Math.random() > 0.5 ? 'bullish' : Math.random() > 0.5 ? 'bearish' : 'neutral';
    const flowMetrics = generateMockAggregatedFlow(symbol, flowBias);
    const signals = generateMockStrategySignals(symbol);

    return {
      symbol,
      price,
      bars,
      optionsChain,
      flowMetrics,
      signals,
      quote: {
        symbol,
        bid: price - 0.05,
        ask: price + 0.05,
        last: price,
        volume: Math.floor(1000000 + Math.random() * 5000000),
        change: (Math.random() - 0.5) * price * 0.02,
        changePercent: (Math.random() - 0.5) * 2,
      },
    };
  });
}
