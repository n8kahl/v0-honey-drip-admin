import { describe, it, expect, vi } from 'vitest';
import { 
  evaluateLiquidity, 
  analyzeTradeTape,
  type OptionContract 
} from '../options-advanced';

describe('Options Advanced Features', () => {
  describe('evaluateLiquidity', () => {
    it('should classify liquid contracts correctly', () => {
      const liquidContract: OptionContract = {
        ticker: 'O:SPY251220C00550000',
        strike_price: 550,
        expiration_date: '2025-12-20',
        contract_type: 'call',
        last_quote: {
          bid: 10.0,
          ask: 10.1,
          bid_size: 100,
          ask_size: 100,
        },
        day: {
          volume: 50000,
          open_interest: 100000,
        },
      };

      const result = evaluateLiquidity(liquidContract);

      expect(result.quality).toBe('excellent');
      expect(result.spread).toBe(0.1);
      expect(result.spreadPercent).toBeCloseTo(0.99);
    });

    it('should classify illiquid contracts correctly', () => {
      const illiquidContract: OptionContract = {
        ticker: 'O:XYZ251220C00100000',
        strike_price: 100,
        expiration_date: '2025-12-20',
        contract_type: 'call',
        last_quote: {
          bid: 0.5,
          ask: 1.0,
          bid_size: 1,
          ask_size: 1,
        },
        day: {
          volume: 10,
          open_interest: 50,
        },
      };

      const result = evaluateLiquidity(illiquidContract);

      expect(result.quality).toBe('poor');
      expect(result.spreadPercent).toBeGreaterThan(5);
      expect(result.warnings).toContain('Wide spread (>5%)');
      expect(result.warnings).toContain('Low volume (<1000)');
    });

    it('should handle missing data gracefully', () => {
      const incompleteContract: Partial<OptionContract> = {
        ticker: 'O:TEST251220C00100000',
      };

      const result = evaluateLiquidity(incompleteContract as OptionContract);

      expect(result.quality).toBe('poor');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeTradeTape', () => {
    it('should detect bullish sentiment from trade flow', () => {
      const bullishTrades = [
        { price: 10.0, size: 100, exchange: 1, conditions: [37], timestamp: Date.now() },
        { price: 10.1, size: 200, exchange: 1, conditions: [37], timestamp: Date.now() },
        { price: 10.2, size: 150, exchange: 1, conditions: [37], timestamp: Date.now() },
      ];

      const result = analyzeTradeTape(bullishTrades);

      expect(result.sentiment).toBe('bullish');
      expect(result.buyVolume).toBeGreaterThan(result.sellVolume);
      expect(result.largeTradeCount).toBeGreaterThan(0);
    });

    it('should detect bearish sentiment from trade flow', () => {
      const bearishTrades = [
        { price: 10.0, size: 100, exchange: 1, conditions: [], timestamp: Date.now() },
        { price: 9.9, size: 200, exchange: 1, conditions: [], timestamp: Date.now() },
        { price: 9.8, size: 150, exchange: 1, conditions: [], timestamp: Date.now() },
      ];

      const result = analyzeTradeTape(bearishTrades);

      expect(result.sentiment).toBe('bearish');
      expect(result.sellVolume).toBeGreaterThan(result.buyVolume);
    });

    it('should calculate vwap correctly', () => {
      const trades = [
        { price: 10.0, size: 100, exchange: 1, conditions: [], timestamp: Date.now() },
        { price: 11.0, size: 200, exchange: 1, conditions: [], timestamp: Date.now() },
        { price: 12.0, size: 100, exchange: 1, conditions: [], timestamp: Date.now() },
      ];

      const result = analyzeTradeTape(trades);

      // VWAP = (10*100 + 11*200 + 12*100) / (100+200+100) = 4400/400 = 11.0
      expect(result.vwap).toBeCloseTo(11.0, 2);
    });
  });
});
