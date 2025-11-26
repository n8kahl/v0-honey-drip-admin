/**
 * useGreeksAnalysis.ts - Greeks Analysis Hook for Radar
 *
 * Phase 2.3: Provides comprehensive Greeks analysis for watchlist symbols
 * including IV analysis, theta decay projections, and gamma exposure.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMarketDataStore } from "../stores/marketDataStore";
import { useMarketStore } from "../stores/marketStore";
import { getIVStats, getIVHistory, type IVStats, type IVReading } from "../lib/greeks/ivHistory";

// ============= Types =============

export interface IVAnalysis {
  symbol: string;
  currentIV: number;
  ivRank: number; // 0-100
  ivPercentile: number; // 0-100
  ivHistory30d: IVReading[];
  isHigh: boolean;
  isLow: boolean;
  trend: "rising" | "falling" | "stable";
  recommendation: IVRecommendation;
}

export interface IVRecommendation {
  action: "buy" | "sell" | "neutral";
  strategy: string;
  reasoning: string;
  confidence: number;
}

export interface ThetaDecayProjection {
  dte: number;
  decayRate: number; // Daily decay as percentage
  cumulativeDecay: number;
  criticalZone: boolean; // True if in accelerated decay zone
}

export interface GammaExposureLevel {
  strike: number;
  callGamma: number;
  putGamma: number;
  netGamma: number;
  isGammaFlip: boolean;
}

export interface GammaExposureAnalysis {
  symbol: string;
  currentPrice: number;
  gammaFlipLevel: number | null;
  netGammaExposure: number;
  exposureByStrike: GammaExposureLevel[];
  marketMakerBias: "positive" | "negative" | "neutral";
  volatilityForecast: "suppressed" | "elevated" | "neutral";
}

export interface DTERecommendation {
  recommendedDTE: number;
  reasoning: string[];
  alternativeDTEs: Array<{ dte: number; suitability: number; reason: string }>;
  riskLevel: "low" | "medium" | "high";
}

export interface GreeksAnalysisResult {
  symbol: string;
  ivAnalysis: IVAnalysis | null;
  thetaProjections: ThetaDecayProjection[];
  gammaExposure: GammaExposureAnalysis | null;
  dteRecommendation: DTERecommendation | null;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
}

// ============= Constants =============

// VIX thresholds for future use in VIX-aware recommendations

const _VIX_THRESHOLDS = { low: 15, elevated: 20, high: 25, extreme: 35 };

const DTE_PROFILES = {
  scalp: { min: 0, max: 3, optimal: 1 },
  dayTrade: { min: 1, max: 7, optimal: 3 },
  swing: { min: 7, max: 45, optimal: 21 },
  leap: { min: 45, max: 365, optimal: 90 },
};

// ============= Hook =============

export interface UseGreeksAnalysisOptions {
  symbol?: string;
  enabled?: boolean;
  refreshInterval?: number;
}

export function useGreeksAnalysis(options: UseGreeksAnalysisOptions = {}) {
  const { symbol: targetSymbol, enabled = true, refreshInterval = 30000 } = options;

  const watchlist = useMarketStore((state) => state.watchlist);
  const getSymbolData = useMarketDataStore((state) => state.getSymbolData);
  const getGreeks = useMarketDataStore((state) => state.getGreeks);

  const [analyses, setAnalyses] = useState<Map<string, GreeksAnalysisResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get symbols to analyze
  const symbolsToAnalyze = useMemo(() => {
    if (targetSymbol) return [targetSymbol];
    return watchlist.map((item) => item.symbol);
  }, [targetSymbol, watchlist]);

  // Analyze IV for a symbol
  const analyzeIV = useCallback(
    (symbol: string): IVAnalysis | null => {
      const stats = getIVStats(symbol);
      const history = getIVHistory(symbol);
      const greeks = getGreeks(symbol);

      if (!stats || !greeks?.iv) {
        return null;
      }

      // Calculate trend from recent history
      const recentHistory = history.slice(-10);
      let trend: "rising" | "falling" | "stable" = "stable";
      if (recentHistory.length >= 2) {
        const first = recentHistory[0].iv;
        const last = recentHistory[recentHistory.length - 1].iv;
        const change = (last - first) / first;
        if (change > 0.1) trend = "rising";
        else if (change < -0.1) trend = "falling";
      }

      // Generate recommendation
      const recommendation = generateIVRecommendation(stats, trend);

      return {
        symbol,
        currentIV: greeks.iv,
        ivRank: stats.rank,
        ivPercentile: stats.percentile,
        ivHistory30d: history.slice(-30),
        isHigh: stats.isHigh,
        isLow: stats.isLow,
        trend,
        recommendation,
      };
    },
    [getGreeks]
  );

  // Generate IV-based recommendation
  const generateIVRecommendation = useCallback(
    (stats: IVStats, trend: "rising" | "falling" | "stable"): IVRecommendation => {
      const { percentile, isHigh, isLow } = stats;

      if (isHigh && trend === "rising") {
        return {
          action: "sell",
          strategy: "Credit Spreads / Iron Condors",
          reasoning: "IV is elevated and rising - premium selling strategies favorable",
          confidence: 85,
        };
      }

      if (isHigh && trend === "falling") {
        return {
          action: "neutral",
          strategy: "Wait for IV to stabilize",
          reasoning: "IV is high but falling - potential IV crush risk for sellers",
          confidence: 60,
        };
      }

      if (isLow && trend === "falling") {
        return {
          action: "buy",
          strategy: "Long Calls/Puts or Debit Spreads",
          reasoning: "IV is depressed - options are cheap, favorable for buyers",
          confidence: 80,
        };
      }

      if (isLow && trend === "rising") {
        return {
          action: "buy",
          strategy: "Long Straddles/Strangles",
          reasoning: "IV is low and expanding - volatility play opportunity",
          confidence: 75,
        };
      }

      // Neutral conditions
      return {
        action: "neutral",
        strategy: "Direction-based plays",
        reasoning: `IV at ${percentile.toFixed(0)}th percentile - focus on directional thesis`,
        confidence: 50,
      };
    },
    []
  );

  // Calculate theta decay projections
  const calculateThetaProjections = useCallback((): ThetaDecayProjection[] => {
    const projections: ThetaDecayProjection[] = [];
    const dteDays = [0, 1, 2, 3, 5, 7, 14, 21, 30, 45, 60];

    dteDays.forEach((dte) => {
      // Theta decay accelerates as expiration approaches
      // Using simplified decay model: decay ∝ 1/sqrt(DTE)
      const baseDte = Math.max(dte, 0.5); // Avoid division by zero
      const decayRate = 100 / Math.sqrt(baseDte) / 100; // Normalized decay rate
      const cumulativeDecay = dteDays
        .filter((d) => d <= dte)
        .reduce((sum, d) => sum + 100 / Math.sqrt(Math.max(d, 0.5)) / 100, 0);

      projections.push({
        dte,
        decayRate: Math.min(decayRate, 1), // Cap at 100%
        cumulativeDecay: Math.min(cumulativeDecay, 1),
        criticalZone: dte <= 7, // Last week is critical
      });
    });

    return projections;
  }, []);

  // Calculate gamma exposure (simplified)
  const calculateGammaExposure = useCallback(
    (symbol: string): GammaExposureAnalysis | null => {
      const symbolData = getSymbolData(symbol);
      if (!symbolData) return null;

      const currentPrice = symbolData.price?.current ?? 0;
      if (currentPrice === 0) return null;

      // Generate mock strikes around current price
      // In production, this would come from options chain data
      const strikeRange = Math.round(currentPrice * 0.1);
      const strikes: GammaExposureLevel[] = [];

      for (let i = -10; i <= 10; i++) {
        const strike = Math.round((currentPrice + i * (strikeRange / 10)) / 5) * 5;

        // Simplified gamma model - higher near ATM
        const distance = Math.abs(strike - currentPrice) / currentPrice;
        const baseGamma = Math.exp(-distance * 20) * 0.1;

        // Assume slightly more call gamma above, put gamma below
        const callGamma = strike >= currentPrice ? baseGamma * 1.1 : baseGamma * 0.9;
        const putGamma = strike <= currentPrice ? baseGamma * 1.1 : baseGamma * 0.9;

        strikes.push({
          strike,
          callGamma,
          putGamma: -putGamma, // Put gamma is negative for market makers
          netGamma: callGamma - putGamma,
          isGammaFlip: false,
        });
      }

      // Find gamma flip level (where net gamma crosses zero)
      let gammaFlipLevel: number | null = null;
      for (let i = 1; i < strikes.length; i++) {
        if (
          (strikes[i - 1].netGamma > 0 && strikes[i].netGamma < 0) ||
          (strikes[i - 1].netGamma < 0 && strikes[i].netGamma > 0)
        ) {
          gammaFlipLevel = (strikes[i - 1].strike + strikes[i].strike) / 2;
          strikes[i - 1].isGammaFlip = true;
          break;
        }
      }

      const netGammaExposure = strikes.reduce((sum, s) => sum + s.netGamma, 0);

      return {
        symbol,
        currentPrice,
        gammaFlipLevel,
        netGammaExposure,
        exposureByStrike: strikes,
        marketMakerBias:
          netGammaExposure > 0.1 ? "positive" : netGammaExposure < -0.1 ? "negative" : "neutral",
        volatilityForecast:
          netGammaExposure > 0.2 ? "suppressed" : netGammaExposure < -0.2 ? "elevated" : "neutral",
      };
    },
    [getSymbolData]
  );

  // Generate DTE recommendation
  const generateDTERecommendation = useCallback(
    (
      ivAnalysis: IVAnalysis | null,
      tradingStyle: "scalp" | "dayTrade" | "swing" | "leap" = "dayTrade"
    ): DTERecommendation => {
      const profile = DTE_PROFILES[tradingStyle];
      const reasoning: string[] = [];
      const alternatives: Array<{ dte: number; suitability: number; reason: string }> = [];

      let recommendedDTE = profile.optimal;
      let riskLevel: "low" | "medium" | "high" = "medium";

      // Adjust based on IV
      if (ivAnalysis?.isHigh) {
        reasoning.push("High IV suggests shorter DTE for theta capture");
        recommendedDTE = Math.max(profile.min, Math.floor(recommendedDTE * 0.7));
        riskLevel = "high";
      } else if (ivAnalysis?.isLow) {
        reasoning.push("Low IV suggests longer DTE for time value");
        recommendedDTE = Math.min(profile.max, Math.ceil(recommendedDTE * 1.3));
        riskLevel = "low";
      } else {
        reasoning.push("Moderate IV - standard DTE selection");
      }

      // Add IV trend consideration
      if (ivAnalysis?.trend === "rising") {
        reasoning.push("Rising IV - consider vega exposure");
      } else if (ivAnalysis?.trend === "falling") {
        reasoning.push("Falling IV - beware IV crush on long positions");
      }

      // Generate alternatives
      alternatives.push({
        dte: profile.min,
        suitability: tradingStyle === "scalp" ? 90 : 60,
        reason: "Aggressive: Maximum theta decay",
      });
      alternatives.push({
        dte: profile.optimal,
        suitability: 85,
        reason: "Balanced: Good theta/vega ratio",
      });
      alternatives.push({
        dte: profile.max,
        suitability: tradingStyle === "swing" || tradingStyle === "leap" ? 80 : 50,
        reason: "Conservative: More time for thesis",
      });

      return {
        recommendedDTE,
        reasoning,
        alternativeDTEs: alternatives,
        riskLevel,
      };
    },
    []
  );

  // Main analysis function
  const analyzeSymbol = useCallback(
    (symbol: string): GreeksAnalysisResult => {
      const ivAnalysis = analyzeIV(symbol);
      const thetaProjections = calculateThetaProjections();
      const gammaExposure = calculateGammaExposure(symbol);
      const dteRecommendation = generateDTERecommendation(ivAnalysis);

      return {
        symbol,
        ivAnalysis,
        thetaProjections,
        gammaExposure,
        dteRecommendation,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      };
    },
    [analyzeIV, calculateThetaProjections, calculateGammaExposure, generateDTERecommendation]
  );

  // Run analysis
  const runAnalysis = useCallback(() => {
    if (!enabled || symbolsToAnalyze.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const newAnalyses = new Map<string, GreeksAnalysisResult>();

      symbolsToAnalyze.forEach((symbol) => {
        const result = analyzeSymbol(symbol);
        newAnalyses.set(symbol, result);
      });

      setAnalyses(newAnalyses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, symbolsToAnalyze, analyzeSymbol]);

  // Initial analysis and refresh
  useEffect(() => {
    if (!enabled) return;

    runAnalysis();

    const interval = setInterval(runAnalysis, refreshInterval);
    return () => clearInterval(interval);
  }, [enabled, runAnalysis, refreshInterval]);

  // Get analysis for a specific symbol
  const getAnalysis = useCallback(
    (symbol: string): GreeksAnalysisResult | null => {
      return analyses.get(symbol.toUpperCase()) || null;
    },
    [analyses]
  );

  // Get all analyses as array
  const allAnalyses = useMemo(() => {
    return Array.from(analyses.values());
  }, [analyses]);

  return {
    analyses: allAnalyses,
    getAnalysis,
    isLoading,
    error,
    refresh: runAnalysis,
  };
}

export default useGreeksAnalysis;
