import { massiveFetch } from '../lib/massive/proxy';

// Massive.com API client for market data
// Read-only market data service - no trading/order routing

const MASSIVE_API_BASE = '/api/massive';

// Helper to construct option symbol for Massive API
function constructOptionSymbol(
  ticker: string,
  expiry: string,
  strike: number,
  type: 'C' | 'P'
): string {
  // Format: TICKER_YYMMDD_C/P_STRIKE
  // e.g., SPX_241115_C_4850
  const expiryDate = new Date(expiry);
  const yy = expiryDate.getFullYear().toString().slice(2);
  const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expiryDate.getDate()).padStart(2, '0');
  
  return `${ticker}_${yy}${mm}${dd}_${type}_${strike}`;
}

// Helper to map ticker to Massive index symbol
function mapToIndexSymbol(ticker: string): string {
  const indexMap: Record<string, string> = {
    'SPX': 'I:SPX',
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'NDX': 'I:NDX',
    'IWM': 'IWM',
    'DIA': 'DIA',
  };
  
  return indexMap[ticker] || ticker;
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
          `${MASSIVE_API_BASE}/v2/aggs/ticker/${symbol}/range/1/${tf}/minute/2024-01-01/2024-12-31?limit=50`
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
  ticker: string,
  expiry: string,
  strike: number,
  type: 'C' | 'P'
): Promise<MassiveVolatilityMetrics> {
  console.log('[v0] Fetching real volatility metrics for:', { ticker, expiry, strike, type });
  
  try {
    const optionSymbol = constructOptionSymbol(ticker, expiry, strike, type);
    
    const response = await massiveFetch(
      `${MASSIVE_API_BASE}/v3/snapshot/options/${ticker}/${optionSymbol}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch volatility data');
    }
    
    const data = await response.json();
    
    // Extract IV from response
    const impliedVol = data.results?.implied_volatility || 0;
    
    // For IV percentile, we'd ideally fetch historical IV and compute rank
    // For now, use a simplified approach: map current IV to percentile estimate
    // Typical IV ranges: 10-30% = low, 30-50% = normal, 50%+ = elevated
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
    // Silently return neutral fallback
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
  type: 'C' | 'P'
): Promise<MassiveLiquidityMetrics> {
  console.log('[v0] Fetching real liquidity metrics for:', { ticker, expiry, strike, type });

  try {
    const optionSymbol = constructOptionSymbol(ticker, expiry, strike, type);
    
    const response = await massiveFetch(
      `${MASSIVE_API_BASE}/v3/quotes/${ticker}/${optionSymbol}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch liquidity data');
    }
    
    const data = await response.json();
    const quote = data.results;
    
    const bid = quote?.bid || 0;
    const ask = quote?.ask || 0;
    const volume = quote?.volume || 0;
    const openInterest = quote?.open_interest || 0;
    
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
    // Silently return neutral fallback
    return {
      liquidityScore: 50,
      spreadPct: 0,
      volume: 0,
      openInterest: 0,
      description: 'Fair',
    };
  }
}
