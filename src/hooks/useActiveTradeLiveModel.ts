/**
 * useActiveTradeLiveModel - Canonical Live Trade Data Hook
 *
 * This is the SINGLE SOURCE OF TRUTH for all live trade metrics.
 * All components displaying live trade data should use this hook.
 *
 * Data Sources:
 * - Options: Massive.com (WebSocket preferred, REST 3s poll fallback)
 * - Underlying: Tradier REST (fast polling)
 * - Greeks: Massive.com options snapshot (30s poll)
 *
 * Features:
 * - Canonical effectiveMid = bid + (ask - bid) / 2 (always)
 * - P&L calculation with net (after commission/slippage)
 * - R-multiple = (effectiveMid - entry) / (entry - stop)
 * - Time to market close in ET timezone
 * - Data freshness tracking with source indicators
 */

import { useMemo, useState, useEffect } from "react";
import type { Trade } from "../types";
import { useActiveTradePnL, useQuotes } from "./useMassiveData";
import { useLiveGreeks } from "./useOptionsAdvanced";
import { roundPrice } from "../lib/utils";
import { getEntryPriceFromUpdates } from "../lib/tradePnl";
import { normalizeOptionTicker } from "../lib/optionsSymbol";
import { massive } from "../lib/massive";
import { useTradeStore } from "../stores/tradeStore";

// ============================================================================
// Types
// ============================================================================

export interface LiveTradeModel {
  // Core pricing
  effectiveMid: number;
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number;

  // P&L
  pnlPercent: number;
  pnlDollars: number;
  pnlGross: number; // Before commissions

  // R-Multiple
  rMultiple: number | null; // null if no stop loss set

  // Greeks
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;

  // Underlying
  underlyingPrice: number;
  underlyingChange: number;
  underlyingChangePercent: number;

  // Time
  timeToCloseMinutes: number;
  timeToCloseFormatted: string;
  marketOpen: boolean;
  holdTimeMinutes: number;
  holdTimeFormatted: string;

  // Data health
  optionSource: "websocket" | "rest";
  optionAsOf: number;
  optionIsStale: boolean;
  greeksSource: "live" | "static";
  underlyingSource: "websocket" | "rest" | "none";
  underlyingAsOf: number;
  underlyingIsStale: boolean;
  overallHealth: "healthy" | "degraded" | "stale";

  // Price metadata (NEW - for P&L accuracy)
  priceSource: "websocket" | "rest" | "closing" | "snapshot";
  priceAsOf: number; // Timestamp of price
  priceAge: number; // Milliseconds since price updated
  priceIsStale: boolean; // True if >30s old
  priceLabel: string; // "Live", "Closing (4:00 PM)", "Cached (5m ago)"

  // For display
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  progressToTarget: number; // 0-100%
}

// Staleness thresholds
const OPTION_STALE_MS = 10_000; // 10 seconds
const UNDERLYING_STALE_MS = 5_000; // 5 seconds

// ============================================================================
// Price Label Helper (NEW - for P&L accuracy)
// ============================================================================

function getPriceLabel(
  source: "websocket" | "rest" | "closing" | "snapshot",
  timestamp: number,
  marketOpen: boolean
): string {
  const ageMs = Date.now() - timestamp;
  const ageMinutes = Math.floor(ageMs / 60000);

  if (source === "websocket") return ageMs < 5000 ? "Live" : `Live (${ageMinutes}m ago)`;
  if (source === "closing") return "Closing (4:00 PM ET)";
  if (source === "rest") return ageMs < 10000 ? "Current" : `Current (${ageMinutes}m ago)`;
  return `Entry Price`;
}

// ============================================================================
// Market Close Time Calculation (ET Timezone)
// ============================================================================

function getMarketCloseTime(): Date {
  // Market closes at 4:00 PM ET
  const now = new Date();

  // Get current time in ET
  const etOptions: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const etFormatter = new Intl.DateTimeFormat("en-US", etOptions);
  const etParts = etFormatter.formatToParts(now);

  const etYear = parseInt(etParts.find((p) => p.type === "year")?.value || "2025");
  const etMonth = parseInt(etParts.find((p) => p.type === "month")?.value || "1") - 1;
  const etDay = parseInt(etParts.find((p) => p.type === "day")?.value || "1");

  // Create 4:00 PM ET close time
  // Using Date.UTC and adjusting for ET offset
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  const isEDT = isDaylightSavingTime(now);
  const etOffset = isEDT ? 4 : 5;

  const closeHourUTC = 16 + etOffset; // 4 PM ET in UTC
  const closeTime = new Date(Date.UTC(etYear, etMonth, etDay, closeHourUTC, 0, 0));

  return closeTime;
}

function isDaylightSavingTime(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return date.getTimezoneOffset() < stdTimezoneOffset;
}

function isMarketOpen(): boolean {
  const now = new Date();

  // Get current time in ET
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const etTime = etFormatter.format(now);
  const [hours, minutes] = etTime.split(":").map(Number);
  const currentMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM - 4:00 PM ET = 570 - 960 minutes
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  // Check day of week (0 = Sunday, 6 = Saturday)
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}

function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return "Closed";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatHoldTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// ============================================================================
// Expired Contract Handler
// ============================================================================

function buildExpiredTradeModel(trade: Trade, contract: any): LiveTradeModel {
  const entryPrice =
    trade.entryPrice || getEntryPriceFromUpdates(trade.updates || []) || contract.mid || 0;
  const expiredPrice = contract.mid || contract.last || 0; // Last known price

  const pnlGross = entryPrice > 0 ? ((expiredPrice - entryPrice) / entryPrice) * 100 : 0;
  const quantity = trade.quantity || 1;
  const pnlDollars = (expiredPrice - entryPrice) * 100 * quantity;

  return {
    // Core pricing
    effectiveMid: roundPrice(expiredPrice),
    bid: contract.bid || 0,
    ask: contract.ask || 0,
    spread: roundPrice((contract.ask || 0) - (contract.bid || 0)),
    spreadPercent: 0,

    // P&L
    pnlPercent: roundPrice(pnlGross),
    pnlDollars: roundPrice(pnlDollars),
    pnlGross: roundPrice(pnlGross),

    // R-Multiple
    rMultiple: null, // Not relevant for expired

    // Greeks
    delta: contract.delta || 0,
    gamma: contract.gamma || 0,
    theta: contract.theta || 0,
    vega: contract.vega || 0,
    iv: contract.iv || 0,

    // Underlying
    underlyingPrice: 0,
    underlyingChange: 0,
    underlyingChangePercent: 0,

    // Time
    timeToCloseMinutes: 0,
    timeToCloseFormatted: "Expired",
    marketOpen: false,
    holdTimeMinutes: 0,
    holdTimeFormatted: "0m",

    // Data health - mark as healthy because this is FINAL, not stale
    optionSource: "rest",
    optionAsOf: contract.asOf || Date.now(),
    optionIsStale: false, // Not stale - it's FINAL
    greeksSource: "static",
    underlyingSource: "none",
    underlyingAsOf: 0,
    underlyingIsStale: false,
    overallHealth: "healthy", // Change from "stale" to "healthy" for expired

    // For display
    entryPrice: roundPrice(entryPrice),
    targetPrice: roundPrice(trade.targetPrice || 0),
    stopLoss: roundPrice(trade.stopLoss || 0),
    progressToTarget: 100, // Expired = journey complete
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useActiveTradeLiveModel(trade: Trade | null): LiveTradeModel | null {
  // Early return if no trade
  if (!trade || !trade.contract) {
    return null;
  }

  const contract = trade.contract;

  // Check if contract has expired
  const expiryDate = contract.expiry ? new Date(contract.expiry) : null;
  const isExpired = expiryDate ? expiryDate < new Date() : false;

  // If expired, return static model with contract snapshot prices
  if (isExpired) {
    return buildExpiredTradeModel(trade, contract);
  }
  const contractId = normalizeOptionTicker(
    contract.id || contract.ticker || contract.symbol || null
  );
  const entryPrice =
    trade.entryPrice || getEntryPriceFromUpdates(trade.updates || []) || contract.mid || 0;
  const quantity = trade.quantity || 1;

  // Get live option price via existing hook
  const {
    currentPrice: optionPrice,
    bid: optionBid,
    ask: optionAsk,
    pnlPercent: netPnlPercent,
    pnlDollars,
    asOf: optionAsOf,
    source: optionSource,
    isStale: optionIsStale,
  } = useActiveTradePnL(trade.id, contractId, entryPrice, quantity);

  // Get live Greeks
  const liveGreeks = useLiveGreeks(
    contractId,
    {
      delta: contract.delta,
      gamma: contract.gamma,
      theta: contract.theta,
      vega: contract.vega,
      iv: contract.iv,
    },
    30000 // 30 second poll
  );

  // Get underlying price via Tradier (useQuotes)
  const { quotes: underlyingQuotes } = useQuotes([trade.ticker]);
  const underlyingQuote = underlyingQuotes?.get(trade.ticker);

  // Diagnostic logging for missing underlying quotes
  useEffect(() => {
    if (!underlyingQuote && underlyingQuotes.size > 0) {
      console.warn(
        `[useActiveTradeLiveModel] No underlying quote for ${trade.ticker}. Available quotes:`,
        Array.from(underlyingQuotes.keys())
      );
    } else if (!underlyingQuote) {
      console.warn(
        `[useActiveTradeLiveModel] No underlying quote for ${trade.ticker} and quotes map is empty`
      );
    } else {
      console.log(`[useActiveTradeLiveModel] Underlying quote for ${trade.ticker}:`, {
        last: underlyingQuote.last,
        asOf: new Date(underlyingQuote.asOf).toISOString(),
      });
    }
  }, [trade.ticker, underlyingQuote, underlyingQuotes]);

  // Time tracking
  const [timeState, setTimeState] = useState({
    timeToCloseMinutes: 0,
    holdTimeMinutes: 0,
    marketOpen: false,
  });

  // Update time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      const closeTime = getMarketCloseTime();
      const timeToClose = Math.max(0, (closeTime.getTime() - now) / 60000);

      const entryTime = trade.entryTime ? new Date(trade.entryTime).getTime() : now;
      const holdTime = (now - entryTime) / 60000;

      setTimeState({
        timeToCloseMinutes: timeToClose,
        holdTimeMinutes: holdTime,
        marketOpen: isMarketOpen(),
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [trade.entryTime]);

  // Fetch market close price when needed (NEW - for P&L accuracy)
  const updateTrade = useTradeStore((state) => state.updateTrade);
  useEffect(() => {
    const shouldFetchClosing =
      !timeState.marketOpen &&
      (!optionBid || optionBid === 0) &&
      (!optionAsk || optionAsk === 0) &&
      !isExpired &&
      (!trade.last_option_price_at ||
        Date.now() - new Date(trade.last_option_price_at).getTime() > 10 * 60 * 1000);

    if (!shouldFetchClosing || !contractId) return;

    let cancelled = false;

    const fetchClosingPrice = async () => {
      try {
        const underlying = contractId.replace(/^O:/, "").match(/^([A-Z]+)/)?.[1];
        if (!underlying) return;

        const snapshot = await massive.getOptionsSnapshot(underlying);
        const contractData = snapshot?.results?.find(
          (c: any) => c.details?.ticker === contractId || c.ticker === contractId
        );

        if (cancelled || !contractData) return;

        const closingBid = contractData.last_quote?.bid ?? contractData.last_quote?.bp ?? 0;
        const closingAsk = contractData.last_quote?.ask ?? contractData.last_quote?.ap ?? 0;
        const closingMid =
          closingBid > 0 && closingAsk > 0
            ? (closingBid + closingAsk) / 2
            : (contractData.last_trade?.price ?? 0);

        if (closingMid > 0) {
          console.log(
            `[useActiveTradeLiveModel] Fetched closing price for ${contractId}: $${closingMid.toFixed(2)}`
          );

          await updateTrade(trade.id, {
            last_option_price: closingMid,
            last_option_price_at: new Date(),
            price_data_source: "closing",
          });
        }
      } catch (error) {
        console.error("[useActiveTradeLiveModel] Failed to fetch closing price:", error);
      }
    };

    const timer = setTimeout(fetchClosingPrice, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    trade.id,
    timeState.marketOpen,
    optionBid,
    optionAsk,
    isExpired,
    contractId,
    trade.last_option_price_at,
    updateTrade,
  ]);

  // Build the live model
  return useMemo(() => {
    // FIXED: Priority cascade for price - NEVER fall back to stale contract.bid/ask
    // 1. Live streaming (optionBid/Ask from WebSocket/REST)
    // 2. Database last_option_price (most recent known)
    // 3. Last resort: entry_price (shows 0% P&L but at least correct)

    let bid = 0;
    let ask = 0;
    let effectiveMid = 0;
    let priceSource: "websocket" | "rest" | "closing" | "snapshot" = optionSource;
    let priceAsOf = optionAsOf;

    // Step 1: Try live streaming data (highest priority)
    if (optionBid > 0 && optionAsk > 0) {
      bid = optionBid;
      ask = optionAsk;
      effectiveMid = roundPrice(bid + (ask - bid) / 2);
      priceSource = optionSource; // 'websocket' or 'rest'
      priceAsOf = optionAsOf;
    }
    // Step 2: Try database last_option_price (most recent known)
    else if (trade.last_option_price && trade.last_option_price > 0) {
      effectiveMid = trade.last_option_price;
      priceSource = (trade.price_data_source as any) || "snapshot";
      priceAsOf = trade.last_option_price_at ? trade.last_option_price_at.getTime() : Date.now();
      bid = trade.entry_bid || 0; // Use entry snapshot for spread display
      ask = trade.entry_ask || 0;
    }
    // Step 3: Last resort - use entry price (shows 0% P&L)
    else {
      effectiveMid = entryPrice;
      priceSource = "snapshot";
      priceAsOf = trade.entry_timestamp ? trade.entry_timestamp.getTime() : Date.now();
      bid = trade.entry_bid || 0;
      ask = trade.entry_ask || 0;
    }

    const spread = ask - bid;
    const spreadPercent = effectiveMid > 0 ? (spread / effectiveMid) * 100 : 0;

    // P&L calculations
    const pnlGross = entryPrice > 0 ? ((effectiveMid - entryPrice) / entryPrice) * 100 : 0;

    // R-Multiple calculation
    const stopLoss = trade.stopLoss || 0;
    const rMultiple =
      stopLoss > 0 && entryPrice > stopLoss
        ? (effectiveMid - entryPrice) / (entryPrice - stopLoss)
        : null;

    // Target progress
    const targetPrice = trade.targetPrice || entryPrice * 1.2; // Default 20% if not set
    const progressToTarget =
      entryPrice > 0 && targetPrice > entryPrice
        ? Math.min(
            100,
            Math.max(0, ((effectiveMid - entryPrice) / (targetPrice - entryPrice)) * 100)
          )
        : 0;

    // Underlying data
    const underlyingPrice = underlyingQuote?.last || 0;
    const underlyingChange = underlyingQuote?.change || 0;
    const underlyingChangePercent = underlyingQuote?.changePercent || 0;
    const underlyingAsOf = underlyingQuote?.asOf || 0;
    const underlyingIsStale = underlyingAsOf
      ? Date.now() - underlyingAsOf > UNDERLYING_STALE_MS
      : true;

    // Overall health assessment
    // Focus on price data freshness - Greeks being static is acceptable since they don't change rapidly
    let overallHealth: "healthy" | "degraded" | "stale" = "healthy";
    if (optionIsStale && underlyingIsStale) {
      overallHealth = "stale";
    } else if (optionIsStale) {
      // Option price is critical for P&L - mark as degraded
      overallHealth = "degraded";
    } else if (underlyingIsStale) {
      // Underlying is secondary - still degraded but less severe
      overallHealth = "degraded";
    }
    // Note: Greeks being "static" is NOT penalized since:
    // 1. Greeks don't change as rapidly as prices
    // 2. Contract snapshot Greeks are sufficient for display
    // 3. This prevents false "DELAYED" badge when prices are streaming fine

    return {
      // Core pricing
      effectiveMid,
      bid,
      ask,
      spread: roundPrice(spread),
      spreadPercent: roundPrice(spreadPercent),

      // P&L
      pnlPercent: roundPrice(netPnlPercent),
      pnlDollars: roundPrice(pnlDollars),
      pnlGross: roundPrice(pnlGross),

      // R-Multiple
      rMultiple: rMultiple !== null ? roundPrice(rMultiple) : null,

      // Greeks
      delta: liveGreeks.delta ?? contract.delta ?? 0,
      gamma: liveGreeks.gamma ?? contract.gamma ?? 0,
      theta: liveGreeks.theta ?? contract.theta ?? 0,
      vega: liveGreeks.vega ?? contract.vega ?? 0,
      iv: liveGreeks.iv ?? contract.iv ?? 0,

      // Underlying
      underlyingPrice: roundPrice(underlyingPrice),
      underlyingChange: roundPrice(underlyingChange),
      underlyingChangePercent: roundPrice(underlyingChangePercent),

      // Time
      timeToCloseMinutes: timeState.timeToCloseMinutes,
      timeToCloseFormatted: formatTimeRemaining(timeState.timeToCloseMinutes),
      marketOpen: timeState.marketOpen,
      holdTimeMinutes: timeState.holdTimeMinutes,
      holdTimeFormatted: formatHoldTime(timeState.holdTimeMinutes),

      // Data health
      optionSource,
      optionAsOf,
      optionIsStale,
      greeksSource: liveGreeks.source,
      underlyingSource: underlyingQuote?.source ?? "none",
      underlyingAsOf,
      underlyingIsStale,
      overallHealth,

      // Price metadata (NEW - for P&L accuracy)
      priceSource,
      priceAsOf,
      priceAge: Date.now() - priceAsOf,
      priceIsStale: Date.now() - priceAsOf > 30000,
      priceLabel: getPriceLabel(priceSource, priceAsOf, timeState.marketOpen),

      // For display
      entryPrice: roundPrice(entryPrice),
      targetPrice: roundPrice(targetPrice),
      stopLoss: roundPrice(stopLoss),
      progressToTarget: roundPrice(progressToTarget),
    };
  }, [
    trade,
    contract,
    optionPrice,
    optionBid,
    optionAsk,
    timeState.marketOpen,
    netPnlPercent,
    pnlDollars,
    optionAsOf,
    optionSource,
    optionIsStale,
    liveGreeks,
    underlyingQuote,
    timeState,
    entryPrice,
    quantity,
  ]);
}

export default useActiveTradeLiveModel;
