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
import { gatherEnhancedMarketContext } from '../lib/riskEngine/marketContext';
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
  const [macroContext, setMacroContext] = useState<any>(null);
  
  const massive = useMassiveClient();

  useEffect(() => {
    if (!enabled || !ticker) {
      return;
    }

    let mounted = true;
    setLoading(true);

    async function fetchData() {
      try {
        console.log('[v0] Risk engine fetching data for', ticker);
        
        const enhancedContext = await gatherEnhancedMarketContext(ticker, massive);
        
        if (!mounted) return;
        
        setMacroContext(enhancedContext.macro);
        setBars(enhancedContext.bars);
        setKeyLevels(enhancedContext.keyLevels);
        
        const input: RiskCalculationInput = {
          entryPrice,
          currentUnderlyingPrice: enhancedContext.bars[enhancedContext.bars.length - 1]?.close || entryPrice,
          currentOptionMid: entryPrice,
          keyLevels: enhancedContext.keyLevels,
          atr: enhancedContext.atr,
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
          macroRegime: enhancedContext.macro?.regime,
          vixLevel: enhancedContext.macro?.vixLevel,
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
    
    // CENTRALIZED - REMOVE: 60s polling replaced by on-demand calculations from marketDataStore
    // const interval = setInterval(fetchData, 60000);
    
    return () => {
      mounted = false;
      // clearInterval(interval);
    };
  }, [enabled, ticker, entryPrice, expirationISO, delta, gamma, vega, theta, massive]);

  return {
    riskResult,
    keyLevels,
    loading,
    macroContext,
    asOf: riskResult ? new Date(riskResult.calculatedAt).toLocaleTimeString() : null,
  };
}
