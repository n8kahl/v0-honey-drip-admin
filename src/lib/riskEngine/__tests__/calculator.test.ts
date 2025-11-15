import { describe, it, expect } from 'vitest';
import {
  calculateRisk,
  calculateBreakevenStop,
  calculateTrailingStop,
} from '../calculator';
import { RiskCalculationInput, AdminRiskDefaults, KeyLevels } from '../types';

describe('Risk Calculator', () => {
  const mockDefaults: AdminRiskDefaults = {
    mode: 'percent',
    tpPercent: 50,
    slPercent: 20,
    trailMode: 'atr',
    atrPeriod: 14,
    atrMultiplier: 1.5,
  };

  const mockKeyLevels: KeyLevels = {
    preMarketHigh: 120,
    preMarketLow: 95,
    orbHigh: 115,
    orbLow: 100,
    priorDayHigh: 125,
    priorDayLow: 98,
    priorDayClose: 110,
    vwap: 112,
    vwapUpperBand: 118,
    vwapLowerBand: 106,
    bollingerUpper: 120,
    bollingerLower: 104,
    bollingerMiddle: 112,
  };

  describe('calculateRisk - Percent Mode', () => {
    it('should calculate TP/SL correctly in percent mode', () => {
      const input: RiskCalculationInput = {
        entryPrice: 100,
        currentUnderlyingPrice: 105,
        currentOptionMid: 5.0,
        keyLevels: mockKeyLevels,
        defaults: mockDefaults,
      };

      const result = calculateRisk(input);
      
      expect(result.targetPrice).toBe(150); // 100 * 1.5
      expect(result.stopLoss).toBe(80);     // 100 * 0.8
      expect(result.riskRewardRatio).toBeCloseTo(2.5, 1); // (50/20)
      expect(result.confidence).toBe('medium');
      expect(result.usedLevels).toContain('percent');
    });
  });

  describe('calculateRisk - Calculated Mode', () => {
    it('should calculate TP/SL using key levels', () => {
      const input: RiskCalculationInput = {
        entryPrice: 110,
        currentUnderlyingPrice: 112,
        currentOptionMid: 6.0,
        keyLevels: mockKeyLevels,
        atr: 5.0,
        defaults: {
          ...mockDefaults,
          mode: 'calculated',
        },
      };

      const result = calculateRisk(input);
      
      // Should use nearest resistance (orbHigh: 115) as target
      expect(result.targetPrice).toBeGreaterThan(input.entryPrice);
      expect(result.stopLoss).toBeLessThan(input.entryPrice);
      expect(result.confidence).toBe('high'); // Should be high with multiple levels
      expect(result.usedLevels.length).toBeGreaterThan(0);
    });

    it('should fallback to defaults when no levels available', () => {
      const input: RiskCalculationInput = {
        entryPrice: 100,
        currentUnderlyingPrice: 105,
        currentOptionMid: 5.0,
        keyLevels: {}, // Empty levels
        defaults: {
          ...mockDefaults,
          mode: 'calculated',
        },
      };

      const result = calculateRisk(input);
      
      expect(result.targetPrice).toBeGreaterThan(input.entryPrice);
      expect(result.stopLoss).toBeLessThan(input.entryPrice);
      expect(result.confidence).toBe('low'); // Low confidence with defaults
      expect(result.usedLevels).toContain('default');
    });
  });

  describe('calculateBreakevenStop', () => {
    it('should return entry price for breakeven', () => {
      const entryPrice = 100;
      const breakeven = calculateBreakevenStop(entryPrice);
      expect(breakeven).toBe(entryPrice);
    });
  });

  describe('calculateTrailingStop', () => {
    it('should calculate trailing stop correctly', () => {
      const currentPrice = 115;
      const highWaterMark = 120;
      const atr = 5.0;
      const atrMultiplier = 1.0;

      const trailingStop = calculateTrailingStop(
        currentPrice,
        highWaterMark,
        atr,
        atrMultiplier
      );

      expect(trailingStop).toBe(115); // 120 - (5 * 1.0)
    });

    it('should adjust with different ATR multiplier', () => {
      const currentPrice = 115;
      const highWaterMark = 120;
      const atr = 5.0;
      const atrMultiplier = 1.5;

      const trailingStop = calculateTrailingStop(
        currentPrice,
        highWaterMark,
        atr,
        atrMultiplier
      );

      expect(trailingStop).toBe(112.5); // 120 - (5 * 1.5)
    });
  });
});
