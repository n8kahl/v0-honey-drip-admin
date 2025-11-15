import { useState, useEffect, useMemo } from 'react';
import {
  calculateRisk,
  calculateATR,
  RiskCalculationInput,
  RiskCalculationResult,
  KeyLevels,
  Bar,
  DEFAULT_RISK_SETTINGS,
  getMarketStatus,
  calculatePremarketLevels,
  calculateORB,
  calculatePriorPeriodHL,
  calculateVWAPWithBands,
  calculateBollingerBands,
} from '../lib/riskEngine';
import { useMassiveClient } from './useMassiveData';

interface UseRiskEngineProps {
  ticker: string;
  entryPrice: number;
  expirationISO?: string;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
  enabled?: boolean;
}

export function useRiskEngine({
  ticker,
  entryPrice,
  expirationISO,
  delta,
  gamma,
  vega,
  theta,
  enabled = true,
}: UseRiskEngineProps) {
  const [riskResult, setRiskResult] = useState<RiskCalculationResult | null>(null);
  const [keyLevels, setKeyLevels] = useState<KeyLevels>({});
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(false);
  
  const massiveClient = useMassiveClient();

  // Fetch 1-minute bars and calculate key levels
  useEffect(() => {
    if (!enabled || !ticker) {
      return;
    }

    let mounted = true;
    setLoading(true);

    async function fetchData() {
      try {
        console.log('[v0] Risk engine fetching data for', ticker);
        
        // Fetch 1-minute bars for the last day (390 minutes of market hours)
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        
        // TODO: Use massiveClient.getAggregateBars
        // For now, mock the data structure
        const mockBars: Bar[] = []; // Would fetch from API
        
        if (!mounted) return;
        
        setBars(mockBars);
        
        const marketStatus = getMarketStatus(new Date());
        const atr = calculateATR(mockBars, 14);
        const vwapData = calculateVWAPWithBands(mockBars);
        const bollingerData = calculateBollingerBands(mockBars, 20, 2);
        const orbData = calculateORB(mockBars, DEFAULT_RISK_SETTINGS.orbMinutes || 15);
        const preMarketData = calculatePremarketLevels(mockBars.slice(0, 60)); // First hour
        
        // TODO: Fetch prior period data (day/week/month/quarter/year)
        // For now, use mock data
        const priorDayData = { high: 0, low: 0, close: 0 };
        const weeklyData = { high: 0, low: 0 };
        const monthlyData = { high: 0, low: 0 };
        
        const levels: KeyLevels = {
          preMarketHigh: preMarketData.high,
          preMarketLow: preMarketData.low,
          orbHigh: orbData.high,
          orbLow: orbData.low,
          vwap: vwapData.vwap,
          vwapUpperBand: vwapData.upperBand,
          vwapLowerBand: vwapData.lowerBand,
          bollingerUpper: bollingerData.upper,
          bollingerLower: bollingerData.lower,
          bollingerMiddle: bollingerData.middle,
          priorDayHigh: priorDayData.high,
          priorDayLow: priorDayData.low,
          priorDayClose: priorDayData.close,
          weeklyHigh: weeklyData.high,
          weeklyLow: weeklyData.low,
          monthlyHigh: monthlyData.high,
          monthlyLow: monthlyData.low,
        };
        
        if (!mounted) return;
        setKeyLevels(levels);
        
        const input: RiskCalculationInput = {
          entryPrice,
          currentUnderlyingPrice: mockBars[mockBars.length - 1]?.close || entryPrice,
          currentOptionMid: entryPrice, // Would fetch real option mid
          keyLevels: levels,
          atr,
          defaults: DEFAULT_RISK_SETTINGS,
          delta,
          gamma,
          vega,
          theta,
          expirationISO,
        };
        
        const result = calculateRisk(input);
        
        if (!mounted) return;
        setRiskResult(result);
        
        console.log('[v0] Risk calculation complete:', {
          tradeType: result.tradeType,
          dte: result.dte,
          targetPrice: result.targetPrice,
          targetPremium: result.targetPremium,
          stopLoss: result.stopLoss,
          reasoning: result.reasoning,
        });
      } catch (error) {
        console.error('[v0] Risk engine error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled, ticker, entryPrice, expirationISO, delta, gamma, vega, theta, massiveClient]);

  return {
    riskResult,
    keyLevels,
    loading,
    // Helpers to format "as of" timestamp
    asOf: riskResult ? new Date(riskResult.calculatedAt).toLocaleTimeString() : null,
  };
}
