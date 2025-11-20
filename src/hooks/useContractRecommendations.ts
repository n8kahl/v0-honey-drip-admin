/**
 * useContractRecommendations Hook
 * Analyzes options contracts and provides AI-powered recommendations
 * Integrates flow data, Greeks analysis, and macro context
 */

import { useMemo } from 'react';
import type { OptionContract } from '../lib/massive/options-advanced';
import {
  recommendContracts,
  getDefaultSPX0DTEConfig,
  getDefaultNDX0DTEConfig,
  type RecommendationConfig,
  type ContractScore,
  type ContractWithFlow,
} from '../lib/massive/contract-recommendations';

interface UseContractRecommendationsOptions {
  contracts: OptionContract[];
  underlyingSymbol: string;
  underlyingPrice: number;
  direction?: 'bullish' | 'bearish' | 'neutral';
  timeHorizon?: '0dte' | 'same_day' | 'next_day' | 'weekly' | 'monthly';
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
  hoursToExpiry?: number;
  enabled?: boolean;
}

export function useContractRecommendations({
  contracts,
  underlyingSymbol,
  underlyingPrice,
  direction = 'neutral',
  timeHorizon = '0dte',
  riskProfile = 'moderate',
  hoursToExpiry = 6.5,
  enabled = true,
}: UseContractRecommendationsOptions) {
  // Memoize recommendations to avoid recalculation on every render
  const recommendations = useMemo(() => {
    if (!enabled || !contracts || contracts.length === 0 || !underlyingPrice) {
      return [];
    }

    // Get default config based on underlying
    let config: RecommendationConfig;
    if (underlyingSymbol === 'SPX' || underlyingSymbol === 'I:SPX') {
      config = getDefaultSPX0DTEConfig(direction);
    } else if (underlyingSymbol === 'NDX' || underlyingSymbol === 'I:NDX') {
      config = getDefaultNDX0DTEConfig(direction);
    } else {
      // Generic config for other underlyings
      config = {
        direction,
        timeHorizon,
        riskProfile,
        positionType: 'long',
        minDelta: 0.25,
        maxDelta: 0.70,
        minVolume: 100,
        minOpenInterest: 500,
        maxSpreadPercent: 5,
        minPremium: 0.50,
        maxPremium: 100,
      };
    }

    // Override config with user preferences
    config.direction = direction;
    config.timeHorizon = timeHorizon;
    config.riskProfile = riskProfile;

    // Cast contracts to ContractWithFlow (flow data will be attached if available)
    const contractsWithFlow = contracts as ContractWithFlow[];

    // Run recommendation engine
    const scores = recommendContracts(contractsWithFlow, underlyingPrice, config, hoursToExpiry);

    return scores;
  }, [contracts, underlyingSymbol, underlyingPrice, direction, timeHorizon, riskProfile, hoursToExpiry, enabled]);

  // Get top recommendation (rank #1)
  const topRecommendation = recommendations.length > 0 ? recommendations[0] : null;

  // Get strong buy recommendations
  const strongBuys = recommendations.filter(r => r.recommendation === 'strong_buy');

  // Get recommendations by ticker (for quick lookup)
  const recommendationsByTicker = useMemo(() => {
    const map = new Map<string, ContractScore>();
    recommendations.forEach(rec => {
      map.set(rec.ticker, rec);
    });
    return map;
  }, [recommendations]);

  // Helper to get recommendation for a specific contract
  const getRecommendation = (ticker: string): ContractScore | null => {
    return recommendationsByTicker.get(ticker) || null;
  };

  // Statistics
  const stats = useMemo(() => {
    const total = recommendations.length;
    const strongBuyCount = recommendations.filter(r => r.recommendation === 'strong_buy').length;
    const buyCount = recommendations.filter(r => r.recommendation === 'buy').length;
    const considerCount = recommendations.filter(r => r.recommendation === 'consider').length;
    const avoidCount = recommendations.filter(r => r.recommendation === 'avoid').length;

    const avgScore = total > 0
      ? Math.round(recommendations.reduce((sum, r) => sum + r.score, 0) / total)
      : 0;

    const avgFlowScore = total > 0
      ? Math.round(recommendations.reduce((sum, r) => sum + r.metrics.flowScore, 0) / total)
      : 0;

    return {
      total,
      strongBuyCount,
      buyCount,
      considerCount,
      avoidCount,
      avgScore,
      avgFlowScore,
    };
  }, [recommendations]);

  return {
    recommendations,
    topRecommendation,
    strongBuys,
    getRecommendation,
    recommendationsByTicker,
    stats,
  };
}

/**
 * Helper hook to determine if it's a good time to trade 0DTE
 * Based on time of day and market conditions
 */
export function use0DTETradingWindow() {
  const now = new Date();
  const etHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const hour = parseInt(etHour, 10);

  // Market hours: 9:30 AM - 4:00 PM ET
  const isMarketOpen = hour >= 9 && hour < 16;

  // Best 0DTE trading windows (avoid lunch chop)
  const isMorningSession = hour >= 9 && hour < 11; // 9:30-11:00 AM
  const isAfternoonSession = hour >= 14 && hour < 16; // 2:00-4:00 PM (power hour)
  const isLunchChop = hour >= 11 && hour < 14; // 11:00 AM - 2:00 PM (avoid)

  const sessionLabel =
    !isMarketOpen ? 'Closed' :
    isMorningSession ? 'Morning Session (High Activity)' :
    isAfternoonSession ? 'Power Hour (High Activity)' :
    isLunchChop ? 'Lunch Hour (Low Activity)' :
    'Regular Hours';

  const shouldTrade0DTE = isMarketOpen && !isLunchChop;

  return {
    isMarketOpen,
    isMorningSession,
    isAfternoonSession,
    isLunchChop,
    shouldTrade0DTE,
    sessionLabel,
    currentHourET: hour,
  };
}

/**
 * Calculate hours to expiry for 0DTE options
 * Assumes expiry at 4:00 PM ET
 */
export function getHoursToExpiry(): number {
  const now = new Date();

  // Get current time in ET
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const etParts = etFormatter.formatToParts(now);
  const etHour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0', 10);
  const etMinute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0', 10);

  // Market close at 4:00 PM ET (16:00)
  const marketCloseHour = 16;
  const marketCloseMinute = 0;

  // Calculate hours remaining
  const currentMinutes = etHour * 60 + etMinute;
  const closeMinutes = marketCloseHour * 60 + marketCloseMinute;
  const minutesRemaining = closeMinutes - currentMinutes;
  const hoursRemaining = minutesRemaining / 60;

  return Math.max(0, hoursRemaining);
}
