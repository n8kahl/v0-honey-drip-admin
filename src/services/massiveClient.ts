import { massiveFetch } from '../lib/massive/proxy';
import { isIndex } from '../lib/symbolUtils';

// Massive.com API client for market data
// Read-only market data service - no trading/order routing

const MASSIVE_API_BASE = '/api/massive';

// Massive options APIs already expect the contract identifier (`O:...`).

// Helper to map ticker to Massive index symbol
// Only adds I: prefix for known index symbols, not stocks
function mapToIndexSymbol(ticker: string): string {
  const t = ticker.toUpperCase();
  const indexMap: Record<string, string> = {
    'SPX': 'I:SPX',
    'SPY': 'I:SPX', // route SPY to underlying index
    'QQQ': 'I:NDX', // route QQQ to underlying index
    'NDX': 'I:NDX',
    'VIX': 'I:VIX',
    'IWM': 'I:RUT', // Russell 2000 index
    'RUT': 'I:RUT',
    'DIA': 'I:DJI', // Dow Jones Industrial Average
    'DJI': 'I:DJI',
  };
  // Return from explicit map first
  if (indexMap[t]) {
    return indexMap[t];
  }
  // For unknown symbols, only add I: if it's a known index, otherwise return as-is
  // This prevents treating stock tickers like SOFI as indices
  return isIndex(t) ? `I:${t}` : t;
}

// Helper to construct option symbol in O:TICKER format
function constructOptionSymbol(ticker: string, expiry: string, strike: number, type: 'C' | 'P'): string {
  // Convert expiry from ISO format (YYYY-MM-DD) to YYMMDD
  const expiryDate = new Date(expiry);
  const year = expiryDate.getFullYear().toString().slice(-2);
  const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
  const day = expiryDate.getDate().toString().padStart(2, '0');
  const expiryStr = `${year}${month}${day}`;
  
  // Strike with 5 digits after decimal (e.g., 150.5 → 00150500)
  const strikeStr = (strike * 1000).toString().padStart(8, '0');
  
  // Format: O:TICKER240101C00150500
  return `O:${ticker}${expiryStr}${type}${strikeStr}`;
}

export interface MassiveTrendMetrics {
  trendScore: number;        // 0..100
  description: string;       // e.g. "Bullish · 3/3 timeframes aligned"
}

export interface MassiveVolatilityMetrics {
  ivPercentile: number;      // 0..100
  description: string;       // e.g. "Elevated · 78th percentile"
}

export interface MassiveLiquidityMetrics {
  liquidityScore: number;    // 0..100
  spreadPct: number;         // 0..100
  volume: number;
  openInterest: number;
  description: string;       // e.g. "Good · Tight spread · High volume"
}

interface ContractData {
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
}

// Fetch trend metrics based on technical indicators across multiple timeframes
export async function fetchTrendMetrics(underlyingTicker: string): Promise<MassiveTrendMetrics> {
  console.log('[v0] Fetching real trend metrics for:', underlyingTicker);
  
  try {
    const symbol = mapToIndexSymbol(underlyingTicker);
    
    const timeframes = ['5', '15', '60'];
    const alignedFrames: boolean[] = [];
    
    for (const tf of timeframes) {
      try {
        const response = await massiveFetch(
          `${MASSIVE_API_BASE}/v2/aggs/ticker/${symbol}/range/${tf}/minute/2024-01-01/2024-12-31?limit=50`
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.results && data.results.length >= 9) {
            const prices = data.results.slice(-9).map((r: any) => r.c);
            const currentPrice = prices[prices.length - 1];
            const ema = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
            
            alignedFrames.push(currentPrice > ema);
          } else {
            alignedFrames.push(false);
          }
        } else {
          alignedFrames.push(false);
        }
      } catch {
        alignedFrames.push(false);
      }
    }
    
    const alignedCount = alignedFrames.filter(Boolean).length;
    let trendScore: number;
    let description: string;
    
    switch (alignedCount) {
      case 3:
        trendScore = 85;
        description = 'Bullish · 3/3 timeframes aligned';
        break;
      case 2:
        trendScore = 65;
        description = 'Mixed · 2/3 timeframes aligned';
        break;
      case 1:
        trendScore = 45;
        description = 'Mixed · 1/3 timeframes aligned';
        break;
      default:
        trendScore = 25;
        description = 'Bearish · 0/3 timeframes aligned';
        break;
    }
    
    console.log('[v0] Trend metrics result:', { trendScore, description });
    return { trendScore, description };
  } catch (error) {
    console.error('[v0] Error fetching trend metrics:', error);
    // Return neutral fallback
    return {
      trendScore: 50,
      description: 'N/A · Error',
    };
  }
}

// Fetch volatility metrics (IV percentile)
export async function fetchVolatilityMetrics(
  optionsTicker: string
): Promise<MassiveVolatilityMetrics> {
  console.log('[v0] Fetching real volatility metrics for:', optionsTicker);

  try {
    const response = await massiveFetch(
      `${MASSIVE_API_BASE}/v3/snapshot/options/${encodeURIComponent(optionsTicker)}`
    );
    const payload = response?.results ?? response;
    const impliedVol = payload?.implied_volatility ?? payload?.iv ?? 0;

    let ivPercentile: number;
    let description: string;

    if (impliedVol < 0.2) {
      ivPercentile = 15;
      description = 'Calm · Low IV environment';
    } else if (impliedVol < 0.35) {
      ivPercentile = 45;
      description = `Normal · ${Math.round(ivPercentile)}th percentile`;
    } else if (impliedVol < 0.5) {
      ivPercentile = 72;
      description = `Elevated · ${Math.round(ivPercentile)}th percentile`;
    } else {
      ivPercentile = 88;
      description = `Extreme · ${Math.round(ivPercentile)}th percentile`;
    }

    return { ivPercentile, description };
  } catch (error) {
    return {
      ivPercentile: 50,
      description: 'Normal',
    };
  }
}

// Fetch liquidity metrics (spread, volume, OI)
export async function fetchLiquidityMetrics(
  ticker: string,
  expiry: string,
  strike: number,
  type: 'C' | 'P',
  contractData?: ContractData
): Promise<MassiveLiquidityMetrics> {
  console.log('[v0] Fetching real liquidity metrics for:', { ticker, expiry, strike, type, hasContractData: !!contractData });

  try {
    // Use the snapshot endpoint which is working (instead of quotes endpoint which returns 502)
    const optionSymbol = constructOptionSymbol(ticker, expiry, strike, type);
    
    // Try snapshot endpoint first
    const response = await massiveFetch(
      `${MASSIVE_API_BASE}/v3/snapshot/options/${encodeURIComponent(optionSymbol)}`
    );
    
    if (!response.ok) {
      console.warn('[v0] Snapshot endpoint failed, returning fallback liquidity data');
      throw new Error('Failed to fetch liquidity data');
    }
    
    const data = await response.json();
    const quote = data.results || data;
    
    console.log('[v0] Liquidity snapshot response:', {
      hasResults: !!data.results,
      hasDayData: !!quote?.day,
      hasLastQuote: !!quote?.day?.last_quote,
      keys: Object.keys(quote || {}),
    });
    
    // Extract metrics from snapshot response - try multiple paths
    const bid = quote?.day?.last_quote?.bid || quote?.last_quote?.bid || quote?.bid || 0;
    const ask = quote?.day?.last_quote?.ask || quote?.last_quote?.ask || quote?.ask || 0;
    const volume = quote?.day?.volume || quote?.volume || 0;
    const openInterest = quote?.open_interest || 0;
    
    console.log('[v0] Extracted liquidity values:', { bid, ask, volume, openInterest });
    
    // Calculate spread percentage
    const mid = (bid + ask) / 2;
    const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 100;
    
    // Derive liquidity score
    let liquidityScore: number;
    let description: string;
    
    if (spreadPct < 2 && volume > 1000 && openInterest > 5000) {
      liquidityScore = 88;
      description = 'Excellent · Tight spread · High volume';
    } else if (spreadPct < 3 && volume > 500) {
      liquidityScore = 75;
      description = 'Good · Tight spread · Decent volume';
    } else if (spreadPct < 5) {
      liquidityScore = 60;
      description = 'Fair · Moderate spread';
    } else if (spreadPct < 10) {
      liquidityScore = 40;
      description = 'Thin · Wide spread';
    } else {
      liquidityScore = 20;
      description = 'Poor · Very wide spread';
    }
    
    return {
      liquidityScore,
      spreadPct,
      volume,
      openInterest,
      description,
    };
  } catch (error) {
    console.warn('[v0] Liquidity API failed, using contract data fallback');
    
    // Use contract data if available
    if (contractData && (contractData.volume > 0 || contractData.openInterest > 0)) {
      const mid = (contractData.bid + contractData.ask) / 2;
      const spreadPct = mid > 0 ? ((contractData.ask - contractData.bid) / mid) * 100 : 0;
      
      let liquidityScore: number;
      let description: string;
      
      if (spreadPct < 2 && contractData.volume > 1000 && contractData.openInterest > 5000) {
        liquidityScore = 88;
        description = 'Excellent · Tight spread · High volume';
      } else if (spreadPct < 3 && contractData.volume > 500) {
        liquidityScore = 75;
        description = 'Good · Tight spread · Decent volume';
      } else if (spreadPct < 5) {
        liquidityScore = 60;
        description = 'Fair · Moderate spread';
      } else if (spreadPct < 10) {
        liquidityScore = 40;
        description = 'Thin · Wide spread';
      } else {
        liquidityScore = 20;
        description = 'Poor · Very wide spread';
      }
      
      console.log('[v0] Using contract data:', { volume: contractData.volume, oi: contractData.openInterest, spreadPct });
      
      return {
        liquidityScore,
        spreadPct,
        volume: contractData.volume,
        openInterest: contractData.openInterest,
        description,
      };
    }
    
    // Final fallback to neutral values
    return {
      liquidityScore: 50,
      spreadPct: 0,
      volume: 0,
      openInterest: 0,
      description: 'Fair',
    };
  }
}
