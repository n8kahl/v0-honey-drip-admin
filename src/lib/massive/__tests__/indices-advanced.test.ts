import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  fetchIndexQuote, 
  fetchIndexIndicators, 
  gatherMacroContext,
  formatMacroContextPills,
  MacroContext 
} from '../indices-advanced';

describe('INDICES ADVANCED', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchIndexQuote', () => {
    it('should fetch SPX quote successfully', async () => {
      const quote = await fetchIndexQuote('SPX');
      
      expect(quote).toHaveProperty('symbol', 'SPX');
      expect(quote).toHaveProperty('value');
      expect(quote).toHaveProperty('change');
      expect(quote).toHaveProperty('changePercent');
      expect(quote).toHaveProperty('timestamp');
      expect(quote).toHaveProperty('asOf');
    });

    it('should handle fetch errors gracefully', async () => {
      const quote = await fetchIndexQuote('INVALID_SYMBOL');
      
      expect(quote.value).toBe(0);
      expect(quote.asOf).toBe('N/A');
    });
  });

  describe('gatherMacroContext', () => {
    it('should gather complete macro context', async () => {
      const macro = await gatherMacroContext();
      
      expect(macro).toHaveProperty('spx');
      expect(macro).toHaveProperty('ndx');
      expect(macro).toHaveProperty('vix');
      expect(macro).toHaveProperty('marketRegime');
      expect(macro).toHaveProperty('riskBias');
      expect(macro).toHaveProperty('timestamp');
      
      expect(['bullish', 'bearish', 'neutral']).toContain(macro.spx.trend);
      expect(['trending', 'choppy', 'volatile']).toContain(macro.marketRegime);
    });

    it('should classify VIX levels correctly', async () => {
      const macro = await gatherMacroContext();
      
      expect(['low', 'mid', 'high']).toContain(macro.vix.level);
      expect(macro.vix.signal).toContain('VIX:');
    });

    it('should detect EMA alignment', async () => {
      const macro = await gatherMacroContext();
      
      expect(typeof macro.spx.emaAlignment).toBe('boolean');
    });
  });

  describe('formatMacroContextPills', () => {
    it('should format macro context as UI pills', () => {
      const mockMacro: MacroContext = {
        spx: {
          value: 5000,
          trend: 'bullish',
          trendStrength: 'strong',
          vwapRelation: 'above',
          emaAlignment: true,
          rsiState: 'neutral',
          atrRegime: 'normal',
        },
        ndx: {
          value: 17000,
          trend: 'bullish',
        },
        vix: {
          value: 18,
          trend: 'stable',
          level: 'mid',
          signal: 'VIX: Moderate (18.0)',
        },
        marketRegime: 'trending',
        riskBias: 'bullish',
        timestamp: Date.now(),
      };

      const pills = formatMacroContextPills(mockMacro);
      
      expect(pills.length).toBeGreaterThan(0);
      expect(pills[0]).toHaveProperty('label');
      expect(pills[0]).toHaveProperty('variant');
      expect(['positive', 'negative', 'neutral', 'warning']).toContain(pills[0].variant);
    });

    it('should show warning for high VIX', () => {
      const mockMacro: MacroContext = {
        spx: {
          value: 5000,
          trend: 'bearish',
          trendStrength: 'moderate',
          vwapRelation: 'below',
          emaAlignment: false,
          rsiState: 'oversold',
          atrRegime: 'elevated',
        },
        ndx: {
          value: 17000,
          trend: 'bearish',
        },
        vix: {
          value: 28,
          trend: 'rising',
          level: 'high',
          signal: 'VIX: Elevated (28.0) — tighten SL',
        },
        marketRegime: 'volatile',
        riskBias: 'bearish',
        timestamp: Date.now(),
      };

      const pills = formatMacroContextPills(mockMacro);
      
      const vixPill = pills.find(p => p.label.includes('VIX'));
      expect(vixPill?.variant).toBe('warning');
    });
  });
});
