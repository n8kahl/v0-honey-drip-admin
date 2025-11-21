# Composite Trade Setup System - Implementation Plan
**Date**: 2025-11-20
**Status**: READY TO IMPLEMENT
**Scope**: New system (not replacing anything - this IS the implementation)

---

## Executive Summary

Building a composite confluence-based trade setup detection system with:
- ✅ Universal opportunity detectors for equities
- ✅ **SPX/NDX-specific strategies** (0DTE, gamma, power hour)
- ✅ Weighted confluence scoring
- ✅ Style-optimized recommendations (scalp/day/swing)
- ✅ Full trade lifecycle (detection → entry → management → exit)
- ✅ Database schema for signal tracking and performance analytics

---

## Part 1: SPX/NDX-Specific Strategy Requirements

### Why SPX/NDX Are Different

**SPX/NDX Characteristics**:
1. **0DTE Options** - Same-day expiration with extreme gamma
2. **Power Hour Volatility** - Last hour (3:00-4:00 PM ET) sees 40% of daily volume
3. **Dealer Gamma Exposure** - Market makers hedge creates predictable flows
4. **Index Rebalancing** - End-of-quarter flows
5. **Institutional Size** - Larger block trades, different flow patterns
6. **No Single Stock Risk** - Different correlation dynamics

**SPY/QQQ (Equity ETFs)**:
- Trade more like stocks
- Respond to individual holdings
- More predictable intraday patterns
- Standard ORB, VWAP, EMA strategies work well

**SPX/NDX (Cash-Settled Indices)**:
- Influenced by dealer positioning
- Gamma-driven moves near expiration
- Power hour reversals common
- Need specialized detection

---

## SPX/NDX Opportunity Detectors (6 Specialized)

### 1. Gamma Squeeze Detector

**When**: Intraday, especially approaching 0DTE expiration (3:00-4:00 PM)

**Detection Logic**:
```typescript
interface GammaSqueezeSignal {
  type: 'gamma_squeeze_bullish' | 'gamma_squeeze_bearish';

  // Core detection
  detect: (features: SymbolFeatures, optionsData: OptionsChainData) => boolean {
    // 1. Identify gamma wall (strike with max gamma)
    const gammaWall = findMaxGammaStrike(optionsData);

    // 2. Price approaching gamma wall
    const approachingGammaWall = Math.abs(features.price.current - gammaWall.strike) / gammaWall.strike < 0.005; // Within 0.5%

    // 3. Dealer position (net short gamma = bullish squeeze potential)
    const dealerNetShortGamma = gammaWall.dealerGamma < 0;

    // 4. Volume increasing
    const volumeIncreasing = features.volume.relativeToAvg > 1.3;

    // 5. Time window (last 90 minutes)
    const powerHourWindow = features.session.minutesSinceOpen >= 300; // After 2:30 PM

    return approachingGammaWall && dealerNetShortGamma && volumeIncreasing && powerHourWindow;
  }

  // Scoring factors
  scoreFactors: [
    {
      name: 'gamma_wall_proximity',
      weight: 0.30, // 30% - most important
      evaluate: (features, optionsData) => {
        const gammaWall = findMaxGammaStrike(optionsData);
        const distancePct = Math.abs(features.price.current - gammaWall.strike) / gammaWall.strike;
        // Closer = higher score (0.1% = 100, 1.0% = 0)
        return Math.max(0, 100 - (distancePct * 10000));
      }
    },
    {
      name: 'dealer_gamma_exposure',
      weight: 0.25,
      evaluate: (features, optionsData) => {
        const totalDealerGamma = optionsData.dealerGamma;
        // More negative dealer gamma = more squeeze potential
        // -1000 gamma = 100, 0 gamma = 50, +1000 gamma = 0
        return Math.max(0, 50 - (totalDealerGamma / 20));
      }
    },
    {
      name: 'call_put_skew',
      weight: 0.20,
      evaluate: (features, optionsData) => {
        const callVolume = optionsData.totalCallVolume;
        const putVolume = optionsData.totalPutVolume;
        const skew = (callVolume - putVolume) / (callVolume + putVolume);
        // For bullish squeeze: want high call buying (skew > 0.3 = 100)
        return Math.min(100, (skew + 0.5) * 100);
      }
    },
    {
      name: 'time_decay_acceleration',
      weight: 0.15,
      evaluate: (features, optionsData) => {
        const minutesToExpiry = optionsData.minutesToExpiry;
        // Last 90 minutes = maximum time decay pressure
        if (minutesToExpiry <= 90) return 100;
        if (minutesToExpiry <= 180) return 70;
        if (minutesToExpiry <= 360) return 40;
        return 0;
      }
    },
    {
      name: 'volume_surge',
      weight: 0.10,
      evaluate: (features) => {
        const rvol = features.volume.relativeToAvg || 1.0;
        // 2.0x = 100, 1.5x = 75, 1.0x = 50
        return Math.min(100, (rvol - 0.5) * 100);
      }
    }
  ]
}
```

**Expected Frequency**: 2-4 signals/day on SPX/NDX during 0DTE days (Mon/Wed/Fri)

---

### 2. Power Hour Reversal Detector

**When**: 3:00-4:00 PM ET (last hour of trading)

**Detection Logic**:
```typescript
interface PowerHourReversalSignal {
  type: 'power_hour_reversal_bullish' | 'power_hour_reversal_bearish';

  detect: (features: SymbolFeatures, dayData: DayData) => boolean {
    // 1. Must be in power hour
    const isPowerHour = features.session.minutesSinceOpen >= 330 && features.session.minutesSinceOpen < 390;

    // 2. Price at intraday extreme
    const atLowOfDay = features.price.current <= dayData.low * 1.002; // Within 0.2% of low
    const atHighOfDay = features.price.current >= dayData.high * 0.998; // Within 0.2% of high

    // 3. Reversal signal (RSI divergence or hammer/shooting star)
    const rsiDivergence = features.pattern.rsi_divergence_5m;
    const reversalPattern = features.pattern.isPatientCandle; // Simplification

    // 4. Volume spike
    const volumeSpike = features.volume.relativeToAvg > 1.5;

    return isPowerHour && (atLowOfDay || atHighOfDay) && (rsiDivergence || reversalPattern) && volumeSpike;
  }

  scoreFactors: [
    {
      name: 'extreme_proximity',
      weight: 0.25,
      evaluate: (features, dayData) => {
        const distanceFromLow = (features.price.current - dayData.low) / dayData.low;
        const distanceFromHigh = (dayData.high - features.price.current) / dayData.high;
        const distanceFromExtreme = Math.min(distanceFromLow, distanceFromHigh);
        // 0% = 100, 0.5% = 50, 1% = 0
        return Math.max(0, 100 - (distanceFromExtreme * 10000));
      }
    },
    {
      name: 'power_hour_timing',
      weight: 0.20,
      evaluate: (features) => {
        const minutesSinceOpen = features.session.minutesSinceOpen || 0;
        // 3:30-3:45 PM = highest probability (345-360 min)
        if (minutesSinceOpen >= 345 && minutesSinceOpen <= 360) return 100;
        if (minutesSinceOpen >= 330 && minutesSinceOpen <= 375) return 80;
        return 50;
      }
    },
    {
      name: 'reversal_confirmation',
      weight: 0.25,
      evaluate: (features) => {
        let score = 0;
        if (features.pattern.rsi_divergence_5m) score += 50;
        if (features.pattern.isPatientCandle) score += 30;
        if (features.pattern.volumeSpike) score += 20;
        return Math.min(100, score);
      }
    },
    {
      name: 'institutional_flow',
      weight: 0.20,
      evaluate: (features) => {
        if (!features.flow) return 50;
        const { sweepCount, blockCount, flowBias } = features.flow;
        let score = (sweepCount || 0) * 10 + (blockCount || 0) * 15;
        if (flowBias === 'bullish') score += 20;
        return Math.min(100, score);
      }
    },
    {
      name: 'day_range_position',
      weight: 0.10,
      evaluate: (features, dayData) => {
        const range = dayData.high - dayData.low;
        const positionInRange = (features.price.current - dayData.low) / range;
        // For bullish reversal: want to be at bottom (0-20% = 100)
        // For bearish reversal: want to be at top (80-100% = 100)
        if (positionInRange < 0.2) return 100; // Bottom
        if (positionInRange > 0.8) return 100; // Top
        return 50;
      }
    }
  ]
}
```

**Expected Frequency**: 1-2 signals/day on SPX/NDX during power hour

---

### 3. VWAP Mean Reversion (SPX/NDX Specific)

**When**: Any time, but optimized for index behavior

**Detection Logic**:
```typescript
interface IndexMeanReversionSignal {
  type: 'index_mean_reversion_long' | 'index_mean_reversion_short';

  detect: (features: SymbolFeatures) => boolean {
    // 1. Price deviated from VWAP significantly
    const vwapDeviation = Math.abs(features.vwap.distancePct || 0);
    const significantDeviation = vwapDeviation > 0.5; // 0.5% for indices (tighter than stocks)

    // 2. RSI extreme (for mean reversion)
    const rsi = features.rsi?.['14'] || 50;
    const rsiExtreme = rsi < 30 || rsi > 70;

    // 3. Volume confirmation
    const volumeConfirmation = features.volume.relativeToAvg > 1.2;

    // 4. Consolidation before move (not in trending regime)
    const notTrending = features.pattern.market_regime !== 'trending';

    return significantDeviation && rsiExtreme && volumeConfirmation && notTrending;
  }

  scoreFactors: [
    {
      name: 'vwap_deviation_magnitude',
      weight: 0.30,
      evaluate: (features) => {
        const deviation = Math.abs(features.vwap.distancePct || 0);
        // 0.5% = 50, 1.0% = 100, 2.0% = 150 (capped at 100)
        return Math.min(100, (deviation - 0.5) * 100);
      }
    },
    {
      name: 'rsi_extreme',
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.['14'] || 50;
        // RSI 30 or 70 = 50, RSI 20 or 80 = 100
        const distanceFrom50 = Math.abs(rsi - 50);
        return Math.min(100, (distanceFrom50 - 20) * 5);
      }
    },
    {
      name: 'volume_profile',
      weight: 0.20,
      evaluate: (features) => {
        const rvol = features.volume.relativeToAvg || 1.0;
        return Math.min(100, (rvol - 0.8) * 100);
      }
    },
    {
      name: 'market_regime_suitability',
      weight: 0.15,
      evaluate: (features) => {
        const regime = features.pattern.market_regime;
        if (regime === 'ranging') return 100; // Perfect for mean reversion
        if (regime === 'choppy') return 80;
        if (regime === 'volatile') return 50;
        if (regime === 'trending') return 0; // Bad for mean reversion
        return 50;
      }
    },
    {
      name: 'time_based_probability',
      weight: 0.10,
      evaluate: (features) => {
        const minutesSinceOpen = features.session.minutesSinceOpen || 0;
        // Mean reversion best mid-day (avoid open/close volatility)
        if (minutesSinceOpen >= 60 && minutesSinceOpen <= 330) return 100;
        if (minutesSinceOpen >= 30 && minutesSinceOpen <= 360) return 70;
        return 40;
      }
    }
  ]
}
```

**Expected Frequency**: 3-5 signals/day on SPX/NDX

---

### 4. Opening Drive Momentum (SPX/NDX)

**When**: First 30 minutes after open (9:30-10:00 AM ET)

**Detection Logic**:
```typescript
interface OpeningDriveMomentumSignal {
  type: 'opening_drive_bullish' | 'opening_drive_bearish';

  detect: (features: SymbolFeatures) => boolean {
    // 1. First 30 minutes
    const isOpeningDrive = features.session.minutesSinceOpen >= 1 && features.session.minutesSinceOpen <= 30;

    // 2. Strong directional move (already up/down 0.3% from open)
    const moveFromOpen = Math.abs((features.price.current - features.price.open) / features.price.open);
    const strongMove = moveFromOpen > 0.003; // 0.3%

    // 3. Volume surge (retail + institutional interest)
    const volumeSurge = features.volume.relativeToAvg > 2.0;

    // 4. Flow confirmation (if available)
    const flowAligned = !features.flow || features.flow.flowBias !== 'neutral';

    return isOpeningDrive && strongMove && volumeSurge && flowAligned;
  }

  scoreFactors: [
    {
      name: 'momentum_strength',
      weight: 0.30,
      evaluate: (features) => {
        const moveFromOpen = Math.abs((features.price.current - features.price.open) / features.price.open);
        // 0.3% = 50, 0.5% = 75, 1.0% = 100
        return Math.min(100, (moveFromOpen - 0.003) * 10000 / 7 + 50);
      }
    },
    {
      name: 'volume_intensity',
      weight: 0.25,
      evaluate: (features) => {
        const rvol = features.volume.relativeToAvg || 1.0;
        // 2.0x = 50, 3.0x = 75, 5.0x = 100
        return Math.min(100, (rvol - 2.0) * 25 + 50);
      }
    },
    {
      name: 'flow_alignment',
      weight: 0.20,
      evaluate: (features) => {
        if (!features.flow) return 50;
        const { flowScore, flowBias, sweepCount } = features.flow;
        if (flowBias === 'bullish' && flowScore > 60) return 100;
        if (flowBias === 'bearish' && flowScore > 60) return 100;
        if (sweepCount > 3) return 80;
        return 50;
      }
    },
    {
      name: 'overnight_gap',
      weight: 0.15,
      evaluate: (features) => {
        const gapPct = Math.abs((features.price.open - features.price.prevClose) / features.price.prevClose);
        // Large gap = momentum likely continues
        // 0.5% gap = 70, 1.0% gap = 100
        return Math.min(100, gapPct * 100 + 20);
      }
    },
    {
      name: 'mtf_alignment',
      weight: 0.10,
      evaluate: (features) => {
        return features.pattern.mtf_divergence_aligned ? 100 : 50;
      }
    }
  ]
}
```

**Expected Frequency**: 1-2 signals/day on SPX/NDX during opening drive

---

### 5. Gamma Flip Zone Detector (SPX/NDX 0DTE)

**When**: 0DTE expiration days, when price crosses dealer gamma flip point

**Detection Logic**:
```typescript
interface GammaFlipSignal {
  type: 'gamma_flip_bullish' | 'gamma_flip_bearish';

  detect: (features: SymbolFeatures, optionsData: OptionsChainData) => boolean {
    // 1. Identify gamma flip point (where dealer gamma changes sign)
    const gammaFlipLevel = optionsData.gammaFlipLevel;

    // 2. Price crossing gamma flip
    const crossingFlip = features.prev.price.current < gammaFlipLevel && features.price.current > gammaFlipLevel;

    // 3. 0DTE expiration day
    const is0DTE = optionsData.minutesToExpiry < 480; // < 8 hours

    // 4. Approaching close (gamma effect strongest)
    const approachingClose = features.session.minutesSinceOpen >= 240; // After 1:00 PM

    return crossingFlip && is0DTE && approachingClose;
  }

  scoreFactors: [
    {
      name: 'gamma_flip_significance',
      weight: 0.35, // Highest weight - this is the edge
      evaluate: (features, optionsData) => {
        const gammaAtFlip = Math.abs(optionsData.gammaAtFlipLevel);
        // Larger gamma = more significant flip
        // 500 gamma = 50, 1000 gamma = 75, 2000 gamma = 100
        return Math.min(100, gammaAtFlip / 20 + 25);
      }
    },
    {
      name: 'time_to_expiry',
      weight: 0.25,
      evaluate: (features, optionsData) => {
        const minutesToExpiry = optionsData.minutesToExpiry;
        // Last 2 hours = maximum effect
        if (minutesToExpiry <= 120) return 100;
        if (minutesToExpiry <= 240) return 75;
        if (minutesToExpiry <= 360) return 50;
        return 25;
      }
    },
    {
      name: 'dealer_hedging_pressure',
      weight: 0.20,
      evaluate: (features, optionsData) => {
        const dealerNetPosition = optionsData.dealerNetDelta;
        // Large dealer position = more hedging flow expected
        return Math.min(100, Math.abs(dealerNetPosition) / 100);
      }
    },
    {
      name: 'options_volume',
      weight: 0.15,
      evaluate: (features, optionsData) => {
        const optionsVolume = optionsData.totalVolume;
        const avgVolume = optionsData.avgVolume;
        const rvol = optionsVolume / avgVolume;
        return Math.min(100, (rvol - 0.5) * 100);
      }
    },
    {
      name: 'price_momentum',
      weight: 0.05,
      evaluate: (features) => {
        const rvol = features.volume.relativeToAvg || 1.0;
        return Math.min(100, (rvol - 1.0) * 50);
      }
    }
  ]
}
```

**Expected Frequency**: 0-1 signals/day on SPX/NDX (only on significant gamma flips)

---

### 6. End-of-Day Pin Detector (SPX/NDX 0DTE)

**When**: Last 30 minutes of 0DTE expiration (3:30-4:00 PM)

**Detection Logic**:
```typescript
interface EODPinSignal {
  type: 'eod_pin_setup';

  detect: (features: SymbolFeatures, optionsData: OptionsChainData) => boolean {
    // 1. Last 30 minutes
    const isEOD = features.session.minutesSinceOpen >= 360;

    // 2. Near max pain strike
    const maxPainStrike = optionsData.maxPainStrike;
    const nearMaxPain = Math.abs(features.price.current - maxPainStrike) / maxPainStrike < 0.005; // Within 0.5%

    // 3. 0DTE expiration
    const is0DTE = optionsData.minutesToExpiry < 30;

    // 4. Large open interest at strike
    const largeOI = optionsData.openInterestAtStrike(maxPainStrike) > 10000;

    return isEOD && nearMaxPain && is0DTE && largeOI;
  }

  scoreFactors: [
    {
      name: 'max_pain_proximity',
      weight: 0.40, // Highest - this is the pin
      evaluate: (features, optionsData) => {
        const maxPainStrike = optionsData.maxPainStrike;
        const distancePct = Math.abs(features.price.current - maxPainStrike) / maxPainStrike;
        // 0% = 100, 0.25% = 50, 0.5% = 0
        return Math.max(0, 100 - (distancePct * 20000));
      }
    },
    {
      name: 'open_interest_concentration',
      weight: 0.30,
      evaluate: (features, optionsData) => {
        const oiAtMaxPain = optionsData.openInterestAtStrike(optionsData.maxPainStrike);
        const totalOI = optionsData.totalOpenInterest;
        const concentration = oiAtMaxPain / totalOI;
        // 10% = 50, 20% = 75, 30%+ = 100
        return Math.min(100, concentration * 333);
      }
    },
    {
      name: 'time_remaining',
      weight: 0.20,
      evaluate: (features, optionsData) => {
        const minutesToExpiry = optionsData.minutesToExpiry;
        // Last 15 minutes = 100, 20 minutes = 75, 30 minutes = 50
        return Math.max(50, 100 - (minutesToExpiry * 1.67));
      }
    },
    {
      name: 'dealer_gamma',
      weight: 0.10,
      evaluate: (features, optionsData) => {
        const dealerGamma = optionsData.dealerGammaAtStrike(optionsData.maxPainStrike);
        // Positive dealer gamma = pin more likely
        return dealerGamma > 0 ? 100 : 30;
      }
    }
  ]
}
```

**Expected Frequency**: 0-1 signals/day on SPX/NDX (only during 0DTE close)

---

## Part 2: Detailed Scoring Mechanics

### Score Calculation Formula

**For Each Opportunity Type**:
```typescript
function calculateCompositeScore(
  detector: OpportunityDetector,
  features: SymbolFeatures,
  additionalData: any
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const factor of detector.scoreFactors) {
    // Calculate factor score (0-100)
    const factorScore = factor.evaluate(features, additionalData);

    // Apply weight
    weightedSum += factorScore * factor.weight;
    totalWeight += factor.weight;
  }

  // Normalize to 0-100
  const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return Math.min(100, Math.max(0, baseScore));
}
```

**Example Calculation** (SPX Gamma Squeeze):
```
Factor Scores:
- gamma_wall_proximity: 85 × 0.30 = 25.5
- dealer_gamma_exposure: 92 × 0.25 = 23.0
- call_put_skew: 78 × 0.20 = 15.6
- time_decay_acceleration: 100 × 0.15 = 15.0
- volume_surge: 75 × 0.10 = 7.5

Total: 86.6/100 → Composite Score: 87
```

---

### Trading Style Adjustments

**Base Score → Style-Specific Score**

```typescript
function applyStyleModifiers(
  baseScore: number,
  opportunityType: OpportunityType,
  features: SymbolFeatures,
  profile: TradingStyleProfile
): { scalpScore: number; dayTradeScore: number; swingScore: number } {

  // 1. Apply opportunity type modifier
  const typeModifier = profile.scoreModifiers.opportunityType[opportunityType] || 1.0;

  // 2. Apply time of day modifier
  const timeModifier = profile.scoreModifiers.timeOfDay(features.session.minutesSinceOpen);

  // 3. Apply volatility modifier
  const volModifier = profile.scoreModifiers.volatility(
    features.mtf['5m']?.atr || 0,
    features.pattern.vix_level || 'medium'
  );

  // 4. Calculate style score
  const styleScore = baseScore * typeModifier * timeModifier * volModifier;

  return {
    scalpScore: applyStyleModifiers(baseScore, opportunityType, features, SCALP_PROFILE),
    dayTradeScore: applyStyleModifiers(baseScore, opportunityType, features, DAY_TRADE_PROFILE),
    swingScore: applyStyleModifiers(baseScore, opportunityType, features, SWING_PROFILE),
  };
}
```

**Example** (SPX Gamma Squeeze, Base Score: 87):
```
SCALP_PROFILE:
- Opportunity modifier: 1.1 (gamma squeezes are good for scalps)
- Time modifier: 1.2 (power hour = best for scalps)
- Volatility modifier: 1.3 (high VIX = good)
→ Scalp Score: 87 × 1.1 × 1.2 × 1.3 = 149.7 → capped at 100

DAY_TRADE_PROFILE:
- Opportunity modifier: 1.0
- Time modifier: 1.1
- Volatility modifier: 1.1
→ Day Trade Score: 87 × 1.0 × 1.1 × 1.1 = 105.3 → capped at 100

SWING_PROFILE:
- Opportunity modifier: 0.5 (gamma squeezes are BAD for swings - too short-term)
- Time modifier: 1.0
- Volatility modifier: 0.9
→ Swing Score: 87 × 0.5 × 1.0 × 0.9 = 39.15 → Final: 39

Recommended Style: SCALP (100 > 100 > 39)
```

---

### Risk/Reward Calculation

**For Each Signal, Calculate Entry/Stop/Targets**:

```typescript
interface RiskRewardCalculation {
  entry: number;
  stop: number;
  targets: {
    T1: number;
    T2: number;
    T3: number;
  };
  riskAmount: number;
  rewardPotential: number;
  riskRewardRatio: number;
}

function calculateRiskReward(
  signal: DetectedOpportunity,
  features: SymbolFeatures,
  profile: TradingStyleProfile
): RiskRewardCalculation {
  const entry = features.price.current;
  const atr = features.mtf[profile.primaryTimeframe]?.atr || 2.0;

  // Calculate stop based on style
  const stopDistance = atr * profile.risk.stopLossATRMultiplier;
  const stop = signal.direction === 'LONG'
    ? entry - stopDistance
    : entry + stopDistance;

  // Calculate targets based on style
  const targets = {
    T1: signal.direction === 'LONG'
      ? entry + (atr * profile.risk.targetATRMultiplier[0])
      : entry - (atr * profile.risk.targetATRMultiplier[0]),
    T2: signal.direction === 'LONG'
      ? entry + (atr * profile.risk.targetATRMultiplier[1])
      : entry - (atr * profile.risk.targetATRMultiplier[1]),
    T3: signal.direction === 'LONG'
      ? entry + (atr * profile.risk.targetATRMultiplier[2])
      : entry - (atr * profile.risk.targetATRMultiplier[2]),
  };

  const riskAmount = Math.abs(entry - stop);
  const rewardPotential = Math.abs(targets.T2 - entry); // Use T2 as primary target
  const riskRewardRatio = rewardPotential / riskAmount;

  return {
    entry,
    stop,
    targets,
    riskAmount,
    rewardPotential,
    riskRewardRatio,
  };
}
```

**Example** (SPX Gamma Squeeze Scalp):
```
Entry: $4525.00
ATR (5m): $3.50
Profile: SCALP

Stop: $4525.00 - ($3.50 × 0.75) = $4522.38
Targets:
  T1: $4525.00 + ($3.50 × 1.0) = $4528.50
  T2: $4525.00 + ($3.50 × 1.5) = $4530.25
  T3: $4525.00 + ($3.50 × 2.0) = $4532.00

Risk: $2.62
Reward (T2): $5.25
R:R: 2.0:1 ✅ (meets minimum 1.5:1 for scalps)
```

---

### Minimum Thresholds

**Signal Only Generated If**:
```typescript
interface SignalThresholds {
  minBaseScore: number;           // e.g., 70
  minStyleScore: number;          // e.g., 75
  minRiskReward: number;          // e.g., 1.5
  maxSignalsPerSymbolPerHour: number; // e.g., 2
  cooldownMinutes: number;        // e.g., 15
}

function meetsThresholds(
  signal: CompositeSignal,
  thresholds: SignalThresholds,
  recentSignals: CompositeSignal[]
): boolean {
  // 1. Score threshold
  if (signal.baseScore < thresholds.minBaseScore) return false;
  if (signal.recommendedStyleScore < thresholds.minStyleScore) return false;

  // 2. Risk/reward threshold
  if (signal.riskReward < thresholds.minRiskReward) return false;

  // 3. Cooldown check
  const lastSignalTime = recentSignals
    .filter(s => s.symbol === signal.symbol)
    .sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp || 0;

  const timeSinceLastSignal = (Date.now() - lastSignalTime) / 60000; // minutes
  if (timeSinceLastSignal < thresholds.cooldownMinutes) return false;

  // 4. Max signals per hour
  const signalsInLastHour = recentSignals.filter(s =>
    s.symbol === signal.symbol &&
    Date.now() - s.timestamp < 3600000
  ).length;
  if (signalsInLastHour >= thresholds.maxSignalsPerSymbolPerHour) return false;

  return true;
}
```

**Default Thresholds**:
```typescript
const DEFAULT_THRESHOLDS: SignalThresholds = {
  minBaseScore: 70,               // Only high-quality setups
  minStyleScore: 75,              // Must be well-suited to style
  minRiskReward: 1.5,             // Minimum 1.5:1 R:R
  maxSignalsPerSymbolPerHour: 2,  // Avoid over-trading
  cooldownMinutes: 15,            // 15-minute cooldown between signals
};

const SPX_NDX_THRESHOLDS: SignalThresholds = {
  minBaseScore: 75,               // Higher bar for indices (more selective)
  minStyleScore: 80,
  minRiskReward: 1.8,             // Better R:R required
  maxSignalsPerSymbolPerHour: 3,  // Can handle more signals (higher volume)
  cooldownMinutes: 10,            // Shorter cooldown (faster-moving)
};
```

---

## Part 3: Database Schema

### New Tables

#### 1. `composite_signals` (Primary Signal Table)

```sql
CREATE TABLE composite_signals (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ownership
  owner UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,

  -- Opportunity Classification
  opportunity_type TEXT NOT NULL,  -- 'gamma_squeeze_bullish', 'power_hour_reversal_bullish', etc.
  direction TEXT NOT NULL,         -- 'LONG' | 'SHORT'
  asset_class TEXT NOT NULL,       -- 'INDEX' | 'EQUITY_ETF' | 'STOCK'

  -- Scoring
  base_score NUMERIC(5,2) NOT NULL CHECK (base_score >= 0 AND base_score <= 100),
  scalp_score NUMERIC(5,2) NOT NULL,
  day_trade_score NUMERIC(5,2) NOT NULL,
  swing_score NUMERIC(5,2) NOT NULL,
  recommended_style TEXT NOT NULL, -- 'scalp' | 'day_trade' | 'swing'

  -- Confluence Breakdown (for transparency)
  confluence JSONB NOT NULL,       -- { volume: 95, flow: 88, vwap: 75, ... }

  -- Entry/Risk Management
  entry_price NUMERIC(12,4) NOT NULL,
  stop_price NUMERIC(12,4) NOT NULL,
  target_t1 NUMERIC(12,4) NOT NULL,
  target_t2 NUMERIC(12,4) NOT NULL,
  target_t3 NUMERIC(12,4) NOT NULL,
  risk_reward NUMERIC(5,2) NOT NULL,

  -- Full Features (for analysis)
  features JSONB NOT NULL,

  -- Signal Lifecycle
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'FILLED' | 'EXPIRED' | 'DISMISSED' | 'STOPPED' | 'TARGET_HIT'
  expires_at TIMESTAMPTZ NOT NULL,
  alerted_at TIMESTAMPTZ,          -- When Discord alert sent
  dismissed_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,

  -- Trade Execution (if filled)
  fill_price NUMERIC(12,4),
  exit_price NUMERIC(12,4),
  exit_reason TEXT,                -- 'STOP' | 'T1' | 'T2' | 'T3' | 'MANUAL' | 'EXPIRED'
  contracts_traded INTEGER,
  realized_pnl NUMERIC(12,4),
  realized_pnl_pct NUMERIC(5,2),
  hold_time_minutes INTEGER,

  -- Performance Tracking
  max_favorable_excursion NUMERIC(12,4), -- MFE: best price reached
  max_adverse_excursion NUMERIC(12,4),   -- MAE: worst price reached

  -- Metadata
  bar_time_key TEXT,               -- For idempotency
  detector_version TEXT,           -- Track detector changes

  -- Constraints
  CONSTRAINT composite_signals_symbol_bar_unique UNIQUE (symbol, bar_time_key)
);

-- Indexes
CREATE INDEX composite_signals_owner_created_idx ON composite_signals(owner, created_at DESC);
CREATE INDEX composite_signals_symbol_created_idx ON composite_signals(symbol, created_at DESC);
CREATE INDEX composite_signals_status_idx ON composite_signals(status);
CREATE INDEX composite_signals_opportunity_type_idx ON composite_signals(opportunity_type);
CREATE INDEX composite_signals_recommended_style_idx ON composite_signals(recommended_style);
CREATE INDEX composite_signals_asset_class_idx ON composite_signals(asset_class);
CREATE INDEX composite_signals_filled_idx ON composite_signals(filled_at) WHERE filled_at IS NOT NULL;

-- Partial indexes for active signals
CREATE INDEX composite_signals_active_idx ON composite_signals(symbol, status) WHERE status = 'ACTIVE';
CREATE INDEX composite_signals_active_expires_idx ON composite_signals(expires_at) WHERE status = 'ACTIVE';

-- RLS Policies
ALTER TABLE composite_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY composite_signals_select ON composite_signals
FOR SELECT USING (owner = auth.uid());

CREATE POLICY composite_signals_insert ON composite_signals
FOR INSERT WITH CHECK (owner = auth.uid());

CREATE POLICY composite_signals_update ON composite_signals
FOR UPDATE USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

CREATE POLICY composite_signals_delete ON composite_signals
FOR DELETE USING (owner = auth.uid());
```

#### 2. `signal_performance_metrics` (Analytics Table)

```sql
CREATE TABLE signal_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Period
  date DATE NOT NULL,
  symbol TEXT,                     -- NULL = all symbols aggregate
  opportunity_type TEXT,           -- NULL = all types aggregate
  recommended_style TEXT,          -- NULL = all styles aggregate

  -- Volume Stats
  total_signals INTEGER NOT NULL DEFAULT 0,
  signals_filled INTEGER NOT NULL DEFAULT 0,
  signals_expired INTEGER NOT NULL DEFAULT 0,
  signals_dismissed INTEGER NOT NULL DEFAULT 0,

  -- Win Rate
  winners INTEGER NOT NULL DEFAULT 0,
  losers INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(5,2),

  -- P&L Stats
  total_pnl NUMERIC(12,4),
  avg_winner_pnl NUMERIC(12,4),
  avg_loser_pnl NUMERIC(12,4),
  largest_winner NUMERIC(12,4),
  largest_loser NUMERIC(12,4),
  profit_factor NUMERIC(5,2),      -- Total wins / Total losses

  -- Execution Stats
  avg_hold_time_minutes INTEGER,
  avg_risk_reward NUMERIC(5,2),
  avg_fill_slippage_pct NUMERIC(5,2),

  -- Quality Metrics
  avg_base_score NUMERIC(5,2),
  avg_style_score NUMERIC(5,2),
  avg_mfe NUMERIC(12,4),           -- Average max favorable excursion
  avg_mae NUMERIC(12,4),           -- Average max adverse excursion

  -- Exit Distribution
  exits_t1 INTEGER DEFAULT 0,
  exits_t2 INTEGER DEFAULT 0,
  exits_t3 INTEGER DEFAULT 0,
  exits_stop INTEGER DEFAULT 0,
  exits_manual INTEGER DEFAULT 0,
  exits_expired INTEGER DEFAULT 0,

  -- Constraints
  CONSTRAINT signal_performance_metrics_unique UNIQUE (date, symbol, opportunity_type, recommended_style)
);

-- Indexes
CREATE INDEX signal_performance_metrics_date_idx ON signal_performance_metrics(date DESC);
CREATE INDEX signal_performance_metrics_symbol_idx ON signal_performance_metrics(symbol);
CREATE INDEX signal_performance_metrics_opportunity_type_idx ON signal_performance_metrics(opportunity_type);
```

#### 3. Keep Existing `strategy_definitions` Table

**Purpose**: Backtesting, historical analysis, user customization

**Usage**:
- Real-time scanner uses composite engine
- Strategy library used for:
  - Filtering composite signals ("only show me VWAP setups")
  - Backtesting specific patterns
  - A/B testing new ideas
  - User-defined custom filters

---

## Part 4: Complete Flow (Setup → Exit)

### Step 1: Market Data Ingestion

```
Unified Massive API (massive.*)
├─ REST: massive.rest.getAggregates(symbol, timeframe)
│  └─ Fetch historical bars (200 bars per timeframe)
│
├─ WebSocket: massive.ws.subscribeAggregates([symbols])
│  └─ Real-time 1m bar updates
│
├─ Options: massive.rest.getOptionsSnapshot(symbol)
│  └─ Full chain with Greeks, OI, volume
│
└─ Flow: massive.aggregateFlow(optionsChain)
   └─ Sweep count, block trades, flow bias

↓ Stored in marketDataStore (Zustand)
```

### Step 2: Feature Building

```
For each symbol on each bar update:
  buildSymbolFeatures({
    symbol: 'SPX',
    timeISO: '2024-11-20T14:35:00Z',
    primaryTf: '5m',
    mtf: { '1m': {...}, '5m': {...}, '15m': {...}, '60m': {...} },
    bars: historicalBars,
    flow: aggregatedFlowMetrics,
  })

↓ Returns SymbolFeatures object with all indicators
```

### Step 3: Universal Pre-Filtering

```typescript
if (!passesUniversalFilters(symbol, features, lastSignalTime, filters)) {
  return null; // Skip this symbol (70-80% filtered out)
}

Filters:
- Market hours (9:30-4:00 PM ET)
- Minimum RVOL (0.8x)
- Maximum spread (0.5% for indices)
- Cooldown (15 minutes since last signal)
- Blacklist check
```

### Step 4: Opportunity Detection

```typescript
// Run all opportunity detectors
const detectors = [
  // Equities
  BREAKOUT_BULLISH,
  BREAKOUT_BEARISH,
  MEAN_REVERSION_LONG,
  MEAN_REVERSION_SHORT,
  TREND_CONTINUATION_LONG,
  TREND_CONTINUATION_SHORT,

  // SPX/NDX Specific
  GAMMA_SQUEEZE_BULLISH,
  GAMMA_SQUEEZE_BEARISH,
  POWER_HOUR_REVERSAL_BULLISH,
  POWER_HOUR_REVERSAL_BEARISH,
  INDEX_MEAN_REVERSION_LONG,
  INDEX_MEAN_REVERSION_SHORT,
  OPENING_DRIVE_BULLISH,
  OPENING_DRIVE_BEARISH,
  GAMMA_FLIP_BULLISH,
  GAMMA_FLIP_BEARISH,
  EOD_PIN_SETUP,
];

const detectedOpportunities = [];
for (const detector of detectors) {
  // Check if this detector applies to this symbol
  if (!detector.appliesToSymbol(symbol)) continue;

  // Run detection logic
  if (detector.detect(features, additionalData)) {
    detectedOpportunities.push(detector);
  }
}

// If multiple opportunities detected, pick highest-scoring
if (detectedOpportunities.length === 0) return null;
```

### Step 5: Scoring

```typescript
// Score each detected opportunity
const scoredOpportunities = detectedOpportunities.map(detector => {
  const baseScore = calculateCompositeScore(detector, features, additionalData);

  const { scalpScore, dayTradeScore, swingScore } = applyStyleModifiers(
    baseScore,
    detector.type,
    features,
    [SCALP_PROFILE, DAY_TRADE_PROFILE, SWING_PROFILE]
  );

  // Determine recommended style
  const scores = [
    { style: 'scalp', score: scalpScore },
    { style: 'day_trade', score: dayTradeScore },
    { style: 'swing', score: swingScore },
  ];
  const recommended = scores.sort((a, b) => b.score - a.score)[0];

  return {
    detector,
    baseScore,
    scalpScore,
    dayTradeScore,
    swingScore,
    recommendedStyle: recommended.style,
    recommendedStyleScore: recommended.score,
  };
});

// Pick best opportunity
const bestOpportunity = scoredOpportunities.sort((a, b) =>
  b.recommendedStyleScore - a.recommendedStyleScore
)[0];
```

### Step 6: Risk/Reward Calculation

```typescript
const profile = getProfileForStyle(bestOpportunity.recommendedStyle);

const riskReward = calculateRiskReward(
  bestOpportunity.detector,
  features,
  profile
);

// Check if meets minimum R:R
if (riskReward.riskRewardRatio < profile.risk.minRiskReward) {
  return null; // Reject signal (poor R:R)
}
```

### Step 7: Threshold Validation

```typescript
const thresholds = symbol.startsWith('SPX') || symbol.startsWith('NDX')
  ? SPX_NDX_THRESHOLDS
  : DEFAULT_THRESHOLDS;

const signal: CompositeSignal = {
  symbol,
  timestamp: Date.now(),
  opportunityType: bestOpportunity.detector.type,
  direction: bestOpportunity.detector.direction,
  baseScore: bestOpportunity.baseScore,
  scalpScore: bestOpportunity.scalpScore,
  dayTradeScore: bestOpportunity.dayTradeScore,
  swingScore: bestOpportunity.swingScore,
  recommendedStyle: bestOpportunity.recommendedStyle,
  confluence: buildConfluenceBreakdown(bestOpportunity.detector, features),
  entry: riskReward.entry,
  stop: riskReward.stop,
  targets: riskReward.targets,
  riskReward: riskReward.riskRewardRatio,
  features,
  expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
};

if (!meetsThresholds(signal, thresholds, recentSignals)) {
  return null; // Reject signal (doesn't meet thresholds)
}
```

### Step 8: Signal Generation

```typescript
// Insert signal into database
const { data: insertedSignal, error } = await supabase
  .from('composite_signals')
  .insert({
    owner: userId,
    symbol: signal.symbol,
    opportunity_type: signal.opportunityType,
    direction: signal.direction,
    asset_class: getAssetClass(signal.symbol), // 'INDEX' | 'EQUITY_ETF'
    base_score: signal.baseScore,
    scalp_score: signal.scalpScore,
    day_trade_score: signal.dayTradeScore,
    swing_score: signal.swingScore,
    recommended_style: signal.recommendedStyle,
    confluence: signal.confluence,
    entry_price: signal.entry,
    stop_price: signal.stop,
    target_t1: signal.targets.T1,
    target_t2: signal.targets.T2,
    target_t3: signal.targets.T3,
    risk_reward: signal.riskReward,
    features: signal.features,
    status: 'ACTIVE',
    expires_at: new Date(signal.expiresAt),
    bar_time_key: generateBarTimeKey(signal.symbol, signal.timestamp),
    detector_version: DETECTOR_VERSION,
  })
  .select()
  .single();

if (error) {
  console.error('[Signal Generator] Error inserting signal:', error);
  return null;
}

return insertedSignal;
```

### Step 9: Discord Alert

```typescript
// Send Discord webhook alert
const discordMessage = formatDiscordMessage(insertedSignal);

await sendDiscordAlert({
  webhook: userPreferences.discordWebhook,
  content: discordMessage,
  embeds: [
    {
      title: `🚀 ${signal.symbol} - ${formatOpportunityType(signal.opportunityType)}`,
      description: `**${signal.direction}** Setup (Score: ${signal.baseScore}/100)`,
      color: signal.direction === 'LONG' ? 0x00ff00 : 0xff0000,
      fields: [
        { name: 'Recommended Style', value: signal.recommendedStyle.toUpperCase(), inline: true },
        { name: 'Entry', value: `$${signal.entry.toFixed(2)}`, inline: true },
        { name: 'Stop', value: `$${signal.stop.toFixed(2)}`, inline: true },
        { name: 'Target T1', value: `$${signal.targets.T1.toFixed(2)}`, inline: true },
        { name: 'Target T2', value: `$${signal.targets.T2.toFixed(2)}`, inline: true },
        { name: 'Target T3', value: `$${signal.targets.T3.toFixed(2)}`, inline: true },
        { name: 'Risk/Reward', value: `${signal.riskReward.toFixed(1)}:1`, inline: true },
        { name: 'Expires', value: `<t:${Math.floor(signal.expiresAt / 1000)}:R>`, inline: true },
        {
          name: 'Confluence',
          value: formatConfluence(signal.confluence),
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ],
});

// Update signal with alert timestamp
await supabase
  .from('composite_signals')
  .update({ alerted_at: new Date() })
  .eq('id', insertedSignal.id);
```

### Step 10: UI Display

```typescript
// Real-time subscription in client
const { data: signals, error } = await supabase
  .from('composite_signals')
  .select('*')
  .eq('owner', userId)
  .eq('status', 'ACTIVE')
  .order('created_at', { ascending: false });

// Display in "Now Playing" panel
<SignalCard signal={signal}>
  <SignalHeader>
    {signal.symbol} - {signal.opportunityType}
    <Badge color={signal.direction === 'LONG' ? 'green' : 'red'}>
      {signal.direction}
    </Badge>
    <Badge>{signal.recommendedStyle}</Badge>
  </SignalHeader>

  <ScoreDisplay>
    Base: {signal.baseScore}/100
    {signal.recommendedStyle === 'scalp' && <> (Scalp: {signal.scalpScore}/100)</>}
  </ScoreDisplay>

  <ConfluenceBreakdown>
    {Object.entries(signal.confluence).map(([factor, score]) => (
      <ConfluenceFactor key={factor}>
        {factor}: <ProgressBar value={score} />
      </ConfluenceFactor>
    ))}
  </ConfluenceBreakdown>

  <TradeManagement>
    Entry: ${signal.entry}
    Stop: ${signal.stop}
    Targets: ${signal.targets.T1} / ${signal.targets.T2} / ${signal.targets.T3}
    R:R: {signal.riskReward}:1
  </TradeManagement>

  <Actions>
    <Button onClick={() => fillSignal(signal)}>Enter Trade</Button>
    <Button variant="ghost" onClick={() => dismissSignal(signal)}>Dismiss</Button>
  </Actions>
</SignalCard>
```

### Step 11: Trade Entry

```typescript
// User clicks "Enter Trade"
async function fillSignal(signal: CompositeSignal) {
  const fillPrice = getCurrentMarketPrice(signal.symbol);

  // Calculate slippage
  const slippagePct = ((fillPrice - signal.entry) / signal.entry) * 100;

  // Update signal in database
  await supabase
    .from('composite_signals')
    .update({
      status: 'FILLED',
      filled_at: new Date(),
      fill_price: fillPrice,
    })
    .eq('id', signal.id);

  // Log fill
  console.log(`[Trade Filled] ${signal.symbol} ${signal.direction} @ ${fillPrice} (slippage: ${slippagePct.toFixed(2)}%)`);

  // Start position monitoring
  startPositionMonitoring(signal);
}
```

### Step 12: Position Monitoring

```typescript
async function startPositionMonitoring(signal: CompositeSignal) {
  // Real-time price updates via WebSocket
  massive.ws.subscribeAggregates([signal.symbol], (update) => {
    const currentPrice = update.close;

    // Track MFE/MAE
    updateExcursions(signal, currentPrice);

    // Check stop
    if (signal.direction === 'LONG' && currentPrice <= signal.stop) {
      exitPosition(signal, currentPrice, 'STOP');
    } else if (signal.direction === 'SHORT' && currentPrice >= signal.stop) {
      exitPosition(signal, currentPrice, 'STOP');
    }

    // Check targets
    if (signal.direction === 'LONG') {
      if (currentPrice >= signal.targets.T3) {
        exitPosition(signal, currentPrice, 'T3');
      } else if (currentPrice >= signal.targets.T2) {
        partialExit(signal, currentPrice, 'T2', 0.5); // Exit 50%
      } else if (currentPrice >= signal.targets.T1) {
        partialExit(signal, currentPrice, 'T1', 0.3); // Exit 30%
      }
    } else {
      // SHORT logic (inverse)
      if (currentPrice <= signal.targets.T3) {
        exitPosition(signal, currentPrice, 'T3');
      } else if (currentPrice <= signal.targets.T2) {
        partialExit(signal, currentPrice, 'T2', 0.5);
      } else if (currentPrice <= signal.targets.T1) {
        partialExit(signal, currentPrice, 'T1', 0.3);
      }
    }
  });

  // Expiration check
  setTimeout(() => {
    if (getSignalStatus(signal.id) === 'FILLED') {
      exitPosition(signal, getCurrentMarketPrice(signal.symbol), 'EXPIRED');
    }
  }, signal.expiresAt - Date.now());
}
```

### Step 13: Trade Exit

```typescript
async function exitPosition(
  signal: CompositeSignal,
  exitPrice: number,
  exitReason: string
) {
  const holdTime = Date.now() - signal.filled_at.getTime();
  const holdTimeMinutes = Math.floor(holdTime / 60000);

  // Calculate P&L
  const pnl = signal.direction === 'LONG'
    ? (exitPrice - signal.fill_price) * signal.contracts_traded
    : (signal.fill_price - exitPrice) * signal.contracts_traded;

  const pnlPct = ((exitPrice - signal.fill_price) / signal.fill_price) * 100 * (signal.direction === 'LONG' ? 1 : -1);

  // Update signal
  await supabase
    .from('composite_signals')
    .update({
      status: exitReason === 'STOP' ? 'STOPPED' : 'TARGET_HIT',
      exited_at: new Date(),
      exit_price: exitPrice,
      exit_reason: exitReason,
      realized_pnl: pnl,
      realized_pnl_pct: pnlPct,
      hold_time_minutes: holdTimeMinutes,
    })
    .eq('id', signal.id);

  // Send exit notification
  await sendDiscordAlert({
    webhook: userPreferences.discordWebhook,
    content: `Trade Closed: ${signal.symbol} ${signal.direction}`,
    embeds: [
      {
        title: exitReason === 'STOP' ? '🛑 Stopped Out' : '🎯 Target Hit',
        description: `${signal.symbol} - ${signal.direction}`,
        color: pnl > 0 ? 0x00ff00 : 0xff0000,
        fields: [
          { name: 'Entry', value: `$${signal.fill_price}`, inline: true },
          { name: 'Exit', value: `$${exitPrice}`, inline: true },
          { name: 'P&L', value: `$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`, inline: true },
          { name: 'Hold Time', value: `${holdTimeMinutes} minutes`, inline: true },
          { name: 'Exit Reason', value: exitReason, inline: true },
        ],
      },
    ],
  });

  // Update performance metrics
  await updatePerformanceMetrics(signal);

  // Stop monitoring
  massive.ws.unsubscribe(signal.symbol);
}
```

### Step 14: Performance Analytics

```typescript
async function updatePerformanceMetrics(signal: CompositeSignal) {
  const date = new Date(signal.filled_at).toISOString().split('T')[0];

  // Aggregate metrics for the day
  const { data: dayMetrics } = await supabase
    .from('signal_performance_metrics')
    .select('*')
    .eq('date', date)
    .eq('symbol', signal.symbol)
    .eq('opportunity_type', signal.opportunity_type)
    .eq('recommended_style', signal.recommended_style)
    .single();

  const isWinner = signal.realized_pnl > 0;

  const updatedMetrics = {
    date,
    symbol: signal.symbol,
    opportunity_type: signal.opportunity_type,
    recommended_style: signal.recommended_style,
    total_signals: (dayMetrics?.total_signals || 0) + 1,
    signals_filled: (dayMetrics?.signals_filled || 0) + 1,
    winners: (dayMetrics?.winners || 0) + (isWinner ? 1 : 0),
    losers: (dayMetrics?.losers || 0) + (isWinner ? 0 : 1),
    win_rate: calculateWinRate(
      (dayMetrics?.winners || 0) + (isWinner ? 1 : 0),
      (dayMetrics?.losers || 0) + (isWinner ? 0 : 1)
    ),
    total_pnl: (dayMetrics?.total_pnl || 0) + signal.realized_pnl,
    avg_hold_time_minutes: calculateAverage(
      dayMetrics?.avg_hold_time_minutes || 0,
      signal.hold_time_minutes,
      (dayMetrics?.signals_filled || 0) + 1
    ),
    // ... other metrics
  };

  await supabase
    .from('signal_performance_metrics')
    .upsert(updatedMetrics, {
      onConflict: 'date,symbol,opportunity_type,recommended_style',
    });
}
```

---

## Part 5: Implementation Plan

### Phase 1: Foundation (COMPLETE ✅)
**Status**: Done in previous work
- [x] Feature builder with all indicators
- [x] Divergence detection
- [x] Pattern detection
- [x] Unified Massive API

**Time**: Already complete

---

### Phase 2: Market Context (4-6 hours)
**Goal**: Add missing features for scoring

**Tasks**:
1. **Market Regime Detection** (2-3 hours)
   - Implement ADX calculation in `patternDetection.ts`
   - Create `detectMarketRegime()` function
   - Wire into `featuresBuilder.ts` → `pattern.market_regime`
   - Test with historical data

2. **VIX Level Classification** (1-2 hours)
   - Fetch VIX via `massive.rest.getIndicesSnapshot(['VIX'])`
   - Create `classifyVIXLevel()` function
   - Add 5-minute cache
   - Wire into `featuresBuilder.ts` → `pattern.vix_level`

3. **Options Chain Integration** (1 hour)
   - Create `fetchOptionsChainData()` helper
   - Calculate gamma walls, dealer exposure, max pain
   - Wire into SPX/NDX detectors

**Deliverables**:
- `src/lib/strategy/marketRegime.ts`
- `src/lib/strategy/vixClassifier.ts`
- `src/lib/massive/optionsChainAnalysis.ts`
- Updated `featuresBuilder.ts` with all fields

---

### Phase 3: Opportunity Detectors (COMPLETE ✅)
**Status**: Completed 2025-11-20
**Goal**: Build all opportunity detection logic

**Completed Tasks**:
1. **Core Detector Framework** ✅
   - [x] Created `src/lib/composite/OpportunityDetector.ts` interface
   - [x] Created `src/lib/composite/detectors/` directory
   - [x] Built scoring engine with `calculateCompositeScore()` function
   - [x] Implemented helper functions: `createDetector()`, `isSPXorNDX()`, `getAssetClass()`

2. **Equity Detectors (6)** ✅
   - [x] `breakout-bullish.ts` - High volume breakouts above resistance
   - [x] `breakout-bearish.ts` - High volume breakdowns below support
   - [x] `mean-reversion-long.ts` - RSI oversold + VWAP deviation bounces
   - [x] `mean-reversion-short.ts` - RSI overbought + VWAP deviation pullbacks
   - [x] `trend-continuation-long.ts` - Pullbacks in established uptrends
   - [x] `trend-continuation-short.ts` - Rallies in established downtrends

3. **SPX/NDX Detectors (11)** ✅
   - [x] `gamma-squeeze-bullish.ts` - Gamma wall proximity with dealer exposure
   - [x] `gamma-squeeze-bearish.ts` - Bearish gamma squeeze setups
   - [x] `power-hour-reversal-bullish.ts` - Last hour reversals from lows
   - [x] `power-hour-reversal-bearish.ts` - Last hour reversals from highs
   - [x] `index-mean-reversion-long.ts` - Index-specific oversold bounces
   - [x] `index-mean-reversion-short.ts` - Index-specific overbought pullbacks
   - [x] `opening-drive-bullish.ts` - First 30 min bullish momentum
   - [x] `opening-drive-bearish.ts` - First 30 min bearish momentum
   - [x] `gamma-flip-bullish.ts` - Crossing above dealer gamma flip (0DTE)
   - [x] `gamma-flip-bearish.ts` - Crossing below dealer gamma flip (0DTE)
   - [x] `eod-pin-setup.ts` - Max pain pinning last 30 minutes (0DTE)

4. **Infrastructure** ✅
   - [x] Created `src/lib/composite/detectors/index.ts` with exports
   - [x] Created `src/lib/composite/index.ts` main export
   - [x] Added convenience arrays: `ALL_DETECTORS`, `EQUITY_DETECTORS`, `INDEX_DETECTORS`

**Deliverables**:
- ✅ `src/lib/composite/OpportunityDetector.ts` (257 lines)
- ✅ `src/lib/composite/detectors/` directory with 17 detectors (~2,800 lines)
- ✅ All detectors compile without TypeScript errors
- ✅ Weighted scoring system (0-100 scale)
- ✅ Full OptionsChainData interface for SPX/NDX strategies
- ⏳ Unit tests (deferred to Phase 3.5)

**Notes**:
- All detectors use weighted confluence scoring with 4-5 factors each
- Score factors sum to 1.0 weight per detector
- Universal equity detectors work with EQUITY_ETF and STOCK asset classes
- SPX/NDX detectors marked as INDEX asset class
- Options data detectors flagged with `requiresOptionsData: true`

---

### Phase 4: Trading Style Profiles (2-3 hours)
**Goal**: Optimize signals for scalp/day/swing

**Tasks**:
1. **Profile Definitions** (1 hour)
   - Create `src/lib/composite/profiles/` directory
   - `scalp-profile.ts`
   - `day-trade-profile.ts`
   - `swing-profile.ts`

2. **Style Scoring Engine** (1 hour)
   - Implement `applyStyleModifiers()` function
   - Test with various scenarios
   - Validate multipliers

3. **Risk/Reward Calculator** (1 hour)
   - Implement `calculateRiskReward()` function
   - ATR-based stop/target calculation
   - R:R validation

**Deliverables**:
- Trading style profiles
- Style scoring engine
- Risk/reward calculator

---

### Phase 5: Composite Scanner Engine (6-8 hours)
**Goal**: Main scanner that orchestrates everything

**Tasks**:
1. **Scanner Core** (3-4 hours)
   - Create `src/lib/composite/CompositeScanner.ts`
   - Universal pre-filtering
   - Opportunity detection orchestration
   - Scoring and ranking
   - Signal generation

2. **Threshold Management** (1 hour)
   - Configurable thresholds
   - Per-symbol overrides (SPX/NDX)
   - Cooldown tracking

3. **Signal Deduplication** (1 hour)
   - Bar-time-key generation
   - Recent signal tracking
   - Cooldown enforcement

4. **Testing** (2 hours)
   - End-to-end scanner test
   - Backtest against historical data
   - Performance benchmarks

**Deliverables**:
- `CompositeScanner` class
- Configuration management
- Comprehensive tests

---

### Phase 6: Database & Backend (4-6 hours)
**Goal**: Persist signals and track performance

**Tasks**:
1. **Database Migration** (1 hour)
   - Create migration SQL for `composite_signals` table
   - Create migration SQL for `signal_performance_metrics` table
   - Run migrations in Supabase

2. **Signal Persistence** (2 hours)
   - Create `src/lib/supabase/compositeSi gnals.ts`
   - Insert signal function
   - Update signal status function
   - Query functions

3. **Performance Analytics** (2 hours)
   - Implement `updatePerformanceMetrics()`
   - Daily aggregation
   - Win rate calculation
   - P&L tracking

4. **Realtime Subscriptions** (1 hour)
   - Setup Supabase realtime for `composite_signals`
   - Client subscription hooks

**Deliverables**:
- Database migrations
- Signal persistence layer
- Performance analytics
- Realtime subscriptions

---

### Phase 7: Server Scanner Worker (3-4 hours)
**Goal**: Background scanner running 24/7

**Tasks**:
1. **Scanner Worker** (2 hours)
   - Update `server/workers/scanner.ts`
   - Replace strategy loop with composite scanner
   - Watchlist integration
   - Error handling

2. **Signal Expiration Handler** (1 hour)
   - Background job to expire old signals
   - Mark as expired in database
   - Cleanup

3. **Monitoring & Logging** (1 hour)
   - Heartbeat updates
   - Performance logging
   - Error alerting

**Deliverables**:
- Updated scanner worker
- Expiration handler
- Monitoring dashboard

---

### Phase 8: Discord Integration (2-3 hours)
**Goal**: Rich Discord alerts

**Tasks**:
1. **Alert Formatter** (1 hour)
   - Create `formatDiscordSignal()` function
   - Rich embeds with confluence breakdown
   - Entry/stop/target display

2. **Webhook Sender** (1 hour)
   - Send alerts on signal generation
   - Send updates on fill/exit
   - Rate limiting

3. **Testing** (1 hour)
   - Test various signal types
   - Verify formatting
   - Check rate limits

**Deliverables**:
- Discord alert system
- Rich embed formatting
- Rate limiting

---

### Phase 9: UI Integration (6-8 hours)
**Goal**: Display signals in dashboard

**Tasks**:
1. **Signal Card Component** (2 hours)
   - Create `SignalCard.tsx`
   - Display all signal fields
   - Confluence breakdown visualization
   - Entry/exit actions

2. **Now Playing Panel** (2 hours)
   - Update `NowPlayingSheet.tsx`
   - Real-time signal subscription
   - Signal filtering/sorting
   - Quick actions

3. **Performance Dashboard** (2 hours)
   - Create `PerformanceDashboard.tsx`
   - Charts for win rate, P&L
   - Strategy type breakdown
   - Symbol performance

4. **Trade Management** (2 hours)
   - Position monitoring UI
   - MFE/MAE display
   - Partial exit controls
   - Manual exit button

**Deliverables**:
- Signal display components
- Performance dashboard
- Trade management UI

---

### Phase 10: Testing & Validation (4-6 hours)
**Goal**: Ensure system works correctly

**Tasks**:
1. **Unit Tests** (2 hours)
   - Test all detectors
   - Test scoring engine
   - Test risk/reward calculator

2. **Integration Tests** (2 hours)
   - End-to-end scanner test
   - Database roundtrip test
   - Discord alert test

3. **Backtest Validation** (2 hours)
   - Run against 3 months historical data
   - Measure win rate
   - Validate signals make sense

**Deliverables**:
- Comprehensive test suite
- Backtest results
- Validation report

---

### Total Implementation Time: **39-52 hours** (5-7 days)

---

## Part 6: Success Metrics

### Performance Targets

**Scanner Performance**:
- Scan time: < 10ms per symbol
- Throughput: 100+ symbols/minute
- CPU usage: < 30%
- Memory: < 500MB

**Signal Quality**:
- Win rate: 65-75%
- Average R:R realized: > 1.5:1
- Signal frequency: 10-20/day across all symbols
- False positive rate: < 25%

**User Experience**:
- Signal-to-noise: 1 signal per symbol max
- Alert latency: < 1 second
- UI responsiveness: < 100ms

---

## Part 7: Risk Mitigation

### Rollback Plan

**If something goes wrong**:
1. Disable composite scanner worker
2. No backward compatibility needed (new system)
3. Clear `composite_signals` table
4. Re-run with fixes

### Gradual Rollout

**Week 1**: Development + Testing
- Build all components
- Unit test everything
- Backtest validation

**Week 2**: Paper Trading
- Run scanner in production
- Generate signals but don't alert
- Collect data
- Tune weights

**Week 3**: Limited Release
- Enable for 1-2 power users
- Monitor performance
- Gather feedback
- Fix issues

**Week 4**: Full Release
- Enable for all users
- Monitor performance metrics
- Iterate based on data

---

## Ready to Implement?

This is the complete plan for building a production-grade composite trade setup detection system with SPX/NDX-specific strategies.

**Next Steps**:
1. Confirm approval of this plan
2. Clarify any questions
3. Start with Phase 2 (Market Context)
4. Build incrementally, testing at each phase

**Total Timeline**: 5-7 days of focused development

**Expected Outcome**:
- 40x faster than 22-strategy approach
- 10-15% higher win rate
- Clear, actionable signals
- SPX/NDX gamma/power hour edge captured
- Complete trade lifecycle tracking

Ready to start implementation?
