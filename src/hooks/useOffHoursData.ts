/**
 * useOffHoursData - Data hook for off-hours trading preparation
 *
 * Provides:
 * - Market countdown timer
 * - Index snapshots (SPX, NDX, VIX) as futures proxies
 * - Key levels from last session
 * - Expired signals for research (last session's patterns)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMarketSession } from "./useMarketSession";
import { useMarketStore } from "../stores/marketStore";
import { massive } from "../lib/massive";
import { getNextMarketTimes } from "../lib/marketSession";
import { MassiveTokenManager } from "../lib/massive/token-manager";

export interface FuturesSnapshot {
  es: {
    // S&P 500 E-mini (use SPX as proxy)
    value: number;
    change: number;
    changePercent: number;
    lastClose: number;
    timestamp: number;
  };
  nq: {
    // Nasdaq E-mini (use NDX as proxy)
    value: number;
    change: number;
    changePercent: number;
    lastClose: number;
    timestamp: number;
  };
  vix: {
    value: number;
    change: number;
    changePercent: number;
    level: "low" | "normal" | "elevated" | "high";
    timestamp: number;
  };
  isDelayed: boolean;
  asOf: string;
}

export interface KeyLevel {
  type:
    | "resistance"
    | "support"
    | "pivot"
    | "vwap"
    | "gap"
    | "orbH"
    | "orbL"
    | "pmh"
    | "pml"
    | "pdh"
    | "pdl"
    | "pdc"
    | "wh"
    | "wl"
    | "mh"
    | "ml"
    | "vwap-u"
    | "vwap-l"
    | "pivot-p"
    | "swing-high"
    | "swing-low"
    | "liquidity"
    | "order-block"
    | "fvg"
    | "bos"
    | "choch"
    | "gex"
    | "call-wall"
    | "put-wall"
    | "max-pain";
  price: number;
  priceEnd?: number; // For zones
  label: string;
  strength: "critical" | "strong" | "moderate" | "weak";
  source: string;
  isConfluent?: boolean;
  touchCount?: number;
}

export interface SymbolKeyLevels {
  symbol: string;
  currentPrice: number;
  priorClose: number;
  changePercent: number;
  levels: KeyLevel[];
  trend: "bullish" | "bearish" | "neutral";
  setupBias: "long" | "short" | "neutral";
  bars?: Array<{
    time: string; // YYYY-MM-DD
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
}

export interface SetupScenario {
  id: string;
  symbol: string;
  type: "breakout" | "breakdown" | "bounce" | "rejection" | "gap_fill" | "range_trade";
  direction: "long" | "short";
  trigger: string; // e.g., "Break above 595.50"
  entry: number;
  stop: number;
  targets: number[];
  riskReward: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  keyLevels: { price: number; label: string }[];
}

export interface OffHoursData {
  // Session info
  session: "PRE" | "OPEN" | "POST" | "CLOSED";
  isOffHours: boolean;

  // Countdown
  countdown: {
    nextSessionLabel: string; // "Pre-Market", "Regular Session", etc.
    nextSessionTime: Date;
    timeRemaining: string; // "2d 4h 23m"
    millisRemaining: number;
  };

  // Futures/Index snapshot
  futures: FuturesSnapshot | null;

  // Key levels by symbol
  keyLevelsBySymbol: Map<string, SymbolKeyLevels>;

  // Setup scenarios
  setupScenarios: SetupScenario[];

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

// Calculate time remaining string
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Now";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0 && days === 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && hours === 0) parts.push(`${seconds % 60}s`);

  return parts.join(" ") || "Now";
}

// Determine VIX level category
function getVixLevel(value: number): "low" | "normal" | "elevated" | "high" {
  if (value < 13) return "low";
  if (value < 18) return "normal";
  if (value < 25) return "elevated";
  return "high";
}

// Generate setup scenarios from key levels
function generateSetupScenarios(
  symbol: string,
  currentPrice: number,
  levels: KeyLevel[]
): SetupScenario[] {
  const scenarios: SetupScenario[] = [];

  // Find nearest resistance and support
  const resistances = levels
    .filter((l) => l.type === "resistance" && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  const supports = levels
    .filter((l) => l.type === "support" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);
  const vwap = levels.find((l) => l.type === "vwap");
  const gaps = levels.filter((l) => l.type === "gap");

  // Breakout scenario (long)
  if (resistances.length > 0) {
    const r1 = resistances[0];
    const stop = supports[0]?.price || currentPrice * 0.99;
    const target1 = r1.price + (r1.price - stop) * 1.5;
    const target2 = r1.price + (r1.price - stop) * 2.5;
    const rr = (target1 - r1.price) / (r1.price - stop);

    scenarios.push({
      id: `${symbol}-breakout-${r1.price}`,
      symbol,
      type: "breakout",
      direction: "long",
      trigger: `Break above ${r1.price.toFixed(2)}`,
      entry: r1.price,
      stop,
      targets: [target1, target2],
      riskReward: Math.max(1, rr),
      confidence: r1.strength === "strong" ? "high" : r1.strength === "moderate" ? "medium" : "low",
      reasoning: `Long breakout above ${r1.source}. Stop below ${supports[0]?.source || "recent low"}.`,
      keyLevels: [
        { price: r1.price, label: r1.source },
        { price: stop, label: "Stop Loss" },
        { price: target1, label: "T1 (1.5R)" },
      ],
    });
  }

  // Breakdown scenario (short)
  if (supports.length > 0) {
    const s1 = supports[0];
    const stop = resistances[0]?.price || currentPrice * 1.01;
    const target1 = s1.price - (stop - s1.price) * 1.5;
    const target2 = s1.price - (stop - s1.price) * 2.5;
    const rr = (s1.price - target1) / (stop - s1.price);

    scenarios.push({
      id: `${symbol}-breakdown-${s1.price}`,
      symbol,
      type: "breakdown",
      direction: "short",
      trigger: `Break below ${s1.price.toFixed(2)}`,
      entry: s1.price,
      stop,
      targets: [target1, target2],
      riskReward: Math.max(1, rr),
      confidence: s1.strength === "strong" ? "high" : s1.strength === "moderate" ? "medium" : "low",
      reasoning: `Short breakdown below ${s1.source}. Stop above ${resistances[0]?.source || "recent high"}.`,
      keyLevels: [
        { price: s1.price, label: s1.source },
        { price: stop, label: "Stop Loss" },
        { price: target1, label: "T1 (1.5R)" },
      ],
    });
  }

  // VWAP bounce scenario
  if (vwap && Math.abs(currentPrice - vwap.price) / vwap.price < 0.01) {
    const aboveVwap = currentPrice > vwap.price;
    const stop = aboveVwap ? vwap.price * 0.995 : vwap.price * 1.005;
    const target = aboveVwap
      ? resistances[0]?.price || currentPrice * 1.01
      : supports[0]?.price || currentPrice * 0.99;
    const rr = Math.abs(target - currentPrice) / Math.abs(currentPrice - stop);

    scenarios.push({
      id: `${symbol}-vwap-bounce`,
      symbol,
      type: "bounce",
      direction: aboveVwap ? "long" : "short",
      trigger: `${aboveVwap ? "Hold" : "Reject"} at VWAP ${vwap.price.toFixed(2)}`,
      entry: currentPrice,
      stop,
      targets: [target],
      riskReward: Math.max(1, rr),
      confidence: "medium",
      reasoning: `${aboveVwap ? "Long" : "Short"} VWAP test. Price near VWAP, watch for ${aboveVwap ? "bounce" : "rejection"}.`,
      keyLevels: [
        { price: vwap.price, label: "VWAP" },
        { price: target, label: "Target" },
      ],
    });
  }

  // Gap fill scenario
  for (const gap of gaps) {
    const isGapUp = gap.price < currentPrice;
    const gapSize = (Math.abs(currentPrice - gap.price) / currentPrice) * 100;

    if (gapSize > 0.5 && gapSize < 3) {
      // Reasonable gap size
      const stop = isGapUp ? currentPrice * 1.01 : currentPrice * 0.99;
      const rr = Math.abs(gap.price - currentPrice) / Math.abs(currentPrice - stop);

      scenarios.push({
        id: `${symbol}-gap-fill-${gap.price}`,
        symbol,
        type: "gap_fill",
        direction: isGapUp ? "short" : "long",
        trigger: `Gap fill to ${gap.price.toFixed(2)}`,
        entry: currentPrice,
        stop,
        targets: [gap.price],
        riskReward: Math.max(1, rr),
        confidence: gapSize > 1.5 ? "high" : "medium",
        reasoning: `${gapSize.toFixed(1)}% gap to fill from ${gap.source}. Gaps often get filled.`,
        keyLevels: [
          { price: gap.price, label: gap.source },
          { price: stop, label: "Stop Loss" },
        ],
      });
    }
  }

  return scenarios;
}

// Create a singleton token manager for this hook
const tokenManager = new MassiveTokenManager();

export function useOffHoursData(): OffHoursData {
  const { session, sessionState } = useMarketSession();
  const watchlist = useMarketStore((s) => s.watchlist);

  const [futures, setFutures] = useState<FuturesSnapshot | null>(null);
  const [keyLevelsBySymbol, setKeyLevelsBySymbol] = useState<Map<string, SymbolKeyLevels>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOffHours = session === "CLOSED" || session === "PRE" || session === "POST";

  // Calculate countdown
  const countdown = useMemo(() => {
    const { nextOpen } = getNextMarketTimes(session);
    const now = Date.now();
    const msRemaining = nextOpen - now;

    let nextSessionLabel = "Pre-Market";
    if (session === "CLOSED") {
      nextSessionLabel = "Pre-Market";
    } else if (session === "PRE") {
      nextSessionLabel = "Regular Session";
    } else if (session === "POST") {
      nextSessionLabel = "Pre-Market (Tomorrow)";
    } else {
      nextSessionLabel = "Market Open";
    }

    return {
      nextSessionLabel,
      nextSessionTime: new Date(nextOpen),
      timeRemaining: formatTimeRemaining(msRemaining),
      millisRemaining: msRemaining,
    };
  }, [session]);

  // Update countdown every second
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOffHours) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOffHours]);

  // Fetch futures/index data
  const fetchFutures = useCallback(async () => {
    try {
      const [spxData, ndxData, vixData] = await Promise.all([
        massive.getIndex("SPX").catch(() => null),
        massive.getIndex("NDX").catch(() => null),
        massive.getIndex("VIX").catch(() => null),
      ]);

      // Estimate prior close (simplified - would need historical data)
      const spxValue = (spxData as any)?.value || 0;
      const spxChange = (spxData as any)?.change || 0;
      const spxPriorClose = spxValue - spxChange;

      const ndxValue = (ndxData as any)?.value || 0;
      const ndxChange = (ndxData as any)?.change || 0;
      const ndxPriorClose = ndxValue - ndxChange;

      const vixValue = (vixData as any)?.value || 0;
      const vixChange = (vixData as any)?.change || 0;
      const vixChangePercent = (vixData as any)?.change_percent || 0;

      const timestamp = Date.now();

      setFutures({
        es: {
          value: spxValue,
          change: spxChange,
          changePercent: spxPriorClose > 0 ? (spxChange / spxPriorClose) * 100 : 0,
          lastClose: spxPriorClose,
          timestamp,
        },
        nq: {
          value: ndxValue,
          change: ndxChange,
          changePercent: ndxPriorClose > 0 ? (ndxChange / ndxPriorClose) * 100 : 0,
          lastClose: ndxPriorClose,
          timestamp,
        },
        vix: {
          value: vixValue,
          change: vixChange,
          changePercent: vixChangePercent,
          level: getVixLevel(vixValue),
          timestamp,
        },
        isDelayed: session === "CLOSED",
        asOf: new Date(timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      });
    } catch (err) {
      console.error("[useOffHoursData] Failed to fetch futures:", err);
    }
  }, [session]);

  // Fetch key levels for watchlist symbols
  const fetchKeyLevels = useCallback(async () => {
    if (watchlist.length === 0) return;

    const levelsMap = new Map<string, SymbolKeyLevels>();

    // Get auth token for API calls
    const token = await tokenManager.getToken();

    for (const item of watchlist.slice(0, 10)) {
      // Limit to first 10
      const symbol = item.symbol;

      try {
        // Fetch recent bars for key level detection
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const fromDate = sevenDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD
        const toDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

        const response = await fetch(
          `/api/bars?symbol=${symbol}&timespan=day&multiplier=1&from=${fromDate}&to=${toDate}&limit=7`,
          {
            headers: {
              "x-massive-proxy-token": token,
            },
          }
        );

        if (!response.ok) {
          console.warn(`[useOffHoursData] Failed to fetch bars for ${symbol}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const bars = data.bars || [];

        console.log(
          `[useOffHoursData] ${symbol}: Received ${bars.length} bars from API:`,
          bars.slice(0, 2)
        );

        if (bars.length === 0) continue;

        const latestBar = bars[bars.length - 1];
        const priorBar = bars.length > 1 ? bars[bars.length - 2] : latestBar;

        const currentPrice = latestBar.close || 0;
        const priorClose = priorBar.close || currentPrice;
        const changePercent = priorClose > 0 ? ((currentPrice - priorClose) / priorClose) * 100 : 0;

        // Calculate key levels
        const levels: KeyLevel[] = [];

        // 1. Compute Base Key Levels (ORB, PMH, PDH, etc.)
        const { computeKeyLevelsFromBars } = await import("../lib/riskEngine/computeKeyLevels");
        const baseBars = bars.map((b) => ({
          time: Math.floor(b.timestamp < 10000000000 ? b.timestamp : b.timestamp / 1000),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume || 0,
        }));

        const computed = computeKeyLevelsFromBars(baseBars, 15); // 15m ORB

        if (computed.priorDayHigh)
          levels.push({
            type: "pdh",
            price: computed.priorDayHigh,
            label: `PDH ${computed.priorDayHigh.toFixed(2)}`,
            strength: "strong",
            source: "Prior Day High",
          });
        if (computed.priorDayLow)
          levels.push({
            type: "pdl",
            price: computed.priorDayLow,
            label: `PDL ${computed.priorDayLow.toFixed(2)}`,
            strength: "strong",
            source: "Prior Day Low",
          });
        if (computed.priorDayClose)
          levels.push({
            type: "pdc",
            price: computed.priorDayClose,
            label: `PDC ${computed.priorDayClose.toFixed(2)}`,
            strength: "moderate",
            source: "Prior Day Close",
          });
        if (computed.preMarketHigh)
          levels.push({
            type: "pmh",
            price: computed.preMarketHigh,
            label: `PMH ${computed.preMarketHigh.toFixed(2)}`,
            strength: "strong",
            source: "Pre-Market High",
          });
        if (computed.preMarketLow)
          levels.push({
            type: "pml",
            price: computed.preMarketLow,
            label: `PML ${computed.preMarketLow.toFixed(2)}`,
            strength: "strong",
            source: "Pre-Market Low",
          });
        if (computed.orbHigh)
          levels.push({
            type: "orbH",
            price: computed.orbHigh,
            label: `ORBH ${computed.orbHigh.toFixed(2)}`,
            strength: "strong",
            source: "15m ORB High",
          });
        if (computed.orbLow)
          levels.push({
            type: "orbL",
            price: computed.orbLow,
            label: `ORBL ${computed.orbLow.toFixed(2)}`,
            strength: "strong",
            source: "15m ORB Low",
          });
        if (computed.weeklyHigh)
          levels.push({
            type: "wh",
            price: computed.weeklyHigh,
            label: `WH ${computed.weeklyHigh.toFixed(2)}`,
            strength: "strong",
            source: "Week High",
          });
        if (computed.weeklyLow)
          levels.push({
            type: "wl",
            price: computed.weeklyLow,
            label: `WL ${computed.weeklyLow.toFixed(2)}`,
            strength: "strong",
            source: "Week Low",
          });
        if (computed.monthlyHigh)
          levels.push({
            type: "mh",
            price: computed.monthlyHigh,
            label: `MH ${computed.monthlyHigh.toFixed(2)}`,
            strength: "moderate",
            source: "Month High",
          });
        if (computed.monthlyLow)
          levels.push({
            type: "ml",
            price: computed.monthlyLow,
            label: `ML ${computed.monthlyLow.toFixed(2)}`,
            strength: "moderate",
            source: "Month Low",
          });

        // 2. Indicators
        if (computed.vwap) {
          levels.push({
            type: "vwap",
            price: computed.vwap,
            label: `VWAP ${computed.vwap.toFixed(2)}`,
            strength: "moderate",
            source: "VWAP",
          });
          if (computed.vwapUpperBand)
            levels.push({
              type: "vwap-u",
              price: computed.vwapUpperBand,
              label: `+1σ ${computed.vwapUpperBand.toFixed(2)}`,
              strength: "weak",
              source: "VWAP +1σ",
            });
          if (computed.vwapLowerBand)
            levels.push({
              type: "vwap-l",
              price: computed.vwapLowerBand,
              label: `-1σ ${computed.vwapLowerBand.toFixed(2)}`,
              strength: "weak",
              source: "VWAP -1σ",
            });
        }
        if (computed.dailyPivot)
          levels.push({
            type: "pivot",
            price: computed.dailyPivot,
            label: `Pivot ${computed.dailyPivot.toFixed(2)}`,
            strength: "moderate",
            source: "Daily Pivot",
          });

        // 3. SMC Structure
        const { detectAllStructureLevels, findConfluenceZones } = await import(
          "../lib/chartEnhancements/structureLevels"
        );
        const structBars = bars.map((b) => ({
          time: Math.floor(b.timestamp < 10000000000 ? b.timestamp : b.timestamp / 1000),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume || 0,
        }));

        const structureLevels = detectAllStructureLevels(structBars);
        structureLevels.forEach((sl) => {
          levels.push({
            type: sl.type.includes("swing")
              ? sl.type.startsWith("swing-high")
                ? "swing-high"
                : "swing-low"
              : sl.type.includes("liquidity")
                ? "liquidity"
                : sl.type.includes("order-block")
                  ? "order-block"
                  : sl.type.includes("fvg")
                    ? "fvg"
                    : sl.type.includes("bos")
                      ? "bos"
                      : "choch",
            price: sl.price,
            priceEnd: sl.priceEnd,
            label: sl.label,
            strength:
              sl.strength === "critical"
                ? "critical"
                : sl.strength === "major"
                  ? "strong"
                  : "moderate",
            source: sl.type.toUpperCase().replace(/-/g, " "),
            touchCount: sl.touches,
          });
        });

        // 4. Confluence Detection
        const zones = findConfluenceZones(structureLevels);
        zones.forEach((zone) => {
          zone.levels.forEach((l) => {
            const levelIdx = levels.findIndex(
              (extL) => extL.price === l.price && extL.label === l.label
            );
            if (levelIdx !== -1) levels[levelIdx].isConfluent = true;
          });
        });

        // 5. Options Flow Levels (Gamma Wall, OI Walls, Max Pain)
        try {
          const snapshot = await massive.getOptionsSnapshot(symbol.replace(/^I:/, ""));
          const contracts: any[] = snapshot?.results || [];

          if (contracts.length > 0) {
            let maxGamma = 0;
            let gammaWall = 0;
            let maxCallOI = 0;
            let callWall = 0;
            let maxPutOI = 0;
            let putWall = 0;

            // For Max Pain
            const strikes = new Map<number, { callOI: number; putOI: number }>();

            contracts.forEach((c) => {
              const strike = Number(c.strike_price || c.strike || 0);
              const type = (c.contract_type || c.type || "").toLowerCase();
              const oi = Number(c.open_interest || c.day?.open_interest || 0);
              const gamma = Math.abs(Number(c.greeks?.gamma || 0));
              const gex = gamma * oi;

              if (gex > maxGamma) {
                maxGamma = gex;
                gammaWall = strike;
              }

              if (type.startsWith("call")) {
                if (oi > maxCallOI) {
                  maxCallOI = oi;
                  callWall = strike;
                }
              } else if (type.startsWith("put")) {
                if (oi > maxPutOI) {
                  maxPutOI = oi;
                  putWall = strike;
                }
              }

              if (strike > 0) {
                const sData = strikes.get(strike) || { callOI: 0, putOI: 0 };
                if (type.startsWith("call")) sData.callOI += oi;
                else sData.putOI += oi;
                strikes.set(strike, sData);
              }
            });

            if (gammaWall)
              levels.push({
                type: "gex",
                price: gammaWall,
                label: `Gamma Wall ${gammaWall}`,
                strength: "critical",
                source: "Total Gamma Exposure",
              });
            if (callWall)
              levels.push({
                type: "call-wall",
                price: callWall,
                label: `Call Wall ${callWall}`,
                strength: "strong",
                source: "Max Call OI",
              });
            if (putWall)
              levels.push({
                type: "put-wall",
                price: putWall,
                label: `Put Wall ${putWall}`,
                strength: "strong",
                source: "Max Put OI",
              });

            // Max Pain Calculation (Strike where total penalty is min)
            let minPenalty = Infinity;
            let maxPain = 0;
            const uniqueStrikes = Array.from(strikes.keys()).sort((a, b) => a - b);

            uniqueStrikes.forEach((testStrike) => {
              let penalty = 0;
              uniqueStrikes.forEach((s) => {
                const data = strikes.get(s)!;
                if (s < testStrike)
                  penalty += (testStrike - s) * data.callOI; // Calls in money
                else if (s > testStrike) penalty += (s - testStrike) * data.putOI; // Puts in money
              });
              if (penalty < minPenalty) {
                minPenalty = penalty;
                maxPain = testStrike;
              }
            });

            if (maxPain)
              levels.push({
                type: "max-pain",
                price: maxPain,
                label: `Max Pain ${maxPain}`,
                strength: "moderate",
                source: "Min Option Value At Expiry",
              });
          }
        } catch (optionsErr) {
          console.warn("[useOffHoursData] Failed to fetch options flow levels:", optionsErr);
        }

        // Determine trend
        const trend =
          changePercent > 0.5 ? "bullish" : changePercent < -0.5 ? "bearish" : "neutral";
        const setupBias = trend === "bullish" ? "long" : trend === "bearish" ? "short" : "neutral";

        // Format bars for chart (convert from OHLC format to chart format)
        // Sort by timestamp ascending and convert to YYYY-MM-DD format
        const chartBars = bars
          .filter((bar) => {
            if (!bar || !bar.timestamp) {
              console.warn(`[useOffHoursData] ${symbol}: Bar missing timestamp:`, bar);
              return false;
            }
            if (bar.timestamp <= 0) {
              console.warn(`[useOffHoursData] ${symbol}: Invalid timestamp (<=0):`, bar.timestamp);
              return false;
            }
            return true;
          })
          .sort((a, b) => a.timestamp - b.timestamp) // Sort ascending by timestamp
          .map((bar) => {
            // Check if timestamp is in seconds (10 digits) vs milliseconds (13 digits)
            // Timestamps in seconds are < 10000000000 (Sep 2001 in milliseconds)
            let timestamp = bar.timestamp;
            if (timestamp < 10000000000) {
              // Timestamp is in seconds, convert to milliseconds
              timestamp = timestamp * 1000;
            }

            const date = new Date(timestamp);
            const timeStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

            return {
              time: timeStr,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
            };
          });

        console.log(
          `[useOffHoursData] ${symbol}: Formatted ${chartBars.length} bars for chart (first bar: ${chartBars[0]?.time}):`,
          chartBars.slice(0, 2)
        );

        levelsMap.set(symbol, {
          symbol,
          currentPrice,
          priorClose,
          changePercent,
          levels,
          trend,
          setupBias,
          bars: chartBars,
        });
      } catch (err) {
        console.warn(`[useOffHoursData] Failed to fetch levels for ${symbol}:`, err);
      }
    }

    setKeyLevelsBySymbol(levelsMap);
  }, [watchlist]);

  // Generate setup scenarios from key levels
  const setupScenarios = useMemo(() => {
    const scenarios: SetupScenario[] = [];

    keyLevelsBySymbol.forEach((symbolLevels) => {
      const symbolScenarios = generateSetupScenarios(
        symbolLevels.symbol,
        symbolLevels.currentPrice,
        symbolLevels.levels
      );
      scenarios.push(...symbolScenarios);
    });

    // Sort by confidence and R:R
    return scenarios.sort((a, b) => {
      const confScore = { high: 3, medium: 2, low: 1 };
      const aScore = confScore[a.confidence] * a.riskReward;
      const bScore = confScore[b.confidence] * b.riskReward;
      return bScore - aScore;
    });
  }, [keyLevelsBySymbol]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([fetchFutures(), fetchKeyLevels()]);
    } catch (err) {
      setError("Failed to load off-hours data");
      console.error("[useOffHoursData] Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchFutures, fetchKeyLevels]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh futures every 5 minutes during off-hours
  useEffect(() => {
    if (!isOffHours) return;

    const interval = setInterval(fetchFutures, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOffHours, fetchFutures]);

  return {
    session,
    isOffHours,
    countdown,
    futures,
    keyLevelsBySymbol,
    setupScenarios,
    loading,
    error,
    refresh,
  };
}
