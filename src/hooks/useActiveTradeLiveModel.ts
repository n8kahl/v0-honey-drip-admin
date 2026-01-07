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

  // Underlying (null when unavailable - show "N/A" instead of $0.00)
  underlyingPrice: number | null;
  underlyingChange: number;
  underlyingChangePercent: number;
  underlyingIsUnavailable: boolean;

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

  // Contract status (NEW - for expired contract handling)
  isExpired: boolean; // True if contract has passed expiration date
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

  // FIX 11: Use database price (most recent) instead of entry snapshot
  // Priority: last_option_price (from polling) → exitPrice → contract snapshot
  const expiredPrice =
    trade.last_option_price || // From ActiveTradePollingService (most recent before expiry)
    trade.exitPrice || // If trade was manually exited
    contract.mid || // Entry snapshot (last resort)
    contract.last ||
    0;

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
    underlyingPrice: null,
    underlyingChange: 0,
    underlyingChangePercent: 0,
    underlyingIsUnavailable: true,

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

    // Price metadata for expired contracts
    priceSource: "snapshot",
    priceAsOf: contract.asOf || Date.now(),
    priceAge: contract.asOf ? Date.now() - contract.asOf : 0,
    priceIsStale: false, // Expired = final, not stale
    priceLabel: "Expired",

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
  // IMPORTANT: All hooks must be called unconditionally (React Rules of Hooks)
  // We handle null trade by using safe defaults and returning null at the end

  // Handle missing contract gracefully - create a minimal contract from trade data
  // This ensures P&L can still be calculated using database-stored prices
  const contract = trade?.contract || {
    id: null,
    ticker: trade?.ticker || "",
    strike: 0,
    expiry: null,
    type: "C" as const,
    bid: trade?.entry_bid || 0,
    ask: trade?.entry_ask || 0,
    mid: trade?.entry_mid || trade?.entryPrice || 0,
    delta: 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    iv: 0,
  };

  // Check if contract has expired
  const expiryDate = contract.expiry ? new Date(contract.expiry) : null;
  const isExpired = expiryDate ? expiryDate < new Date() : false;

  // NOTE: Don't return early for expired contracts!
  // We still want to fetch underlying price (it's still live even if contract expired)
  // The useMemo below handles expired-specific logic

  const contractId = normalizeOptionTicker(
    contract.id || contract.ticker || contract.symbol || null
  );
  const entryPrice =
    trade?.entryPrice || getEntryPriceFromUpdates(trade?.updates || []) || contract.mid || 0;
  const quantity = trade?.quantity || 1;

  // Get live option price via existing hook (always called, even if trade is null)
  const {
    currentPrice: optionPrice,
    bid: optionBid,
    ask: optionAsk,
    pnlPercent: netPnlPercent,
    pnlDollars,
    asOf: optionAsOf,
    source: optionSource,
    isStale: optionIsStale,
  } = useActiveTradePnL(trade?.id || null, contractId, entryPrice, quantity);

  // Get live Greeks (always called)
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

  // Get underlying price via Tradier (always called - useQuotes handles empty arrays)
  const ticker = trade?.ticker || "";
  const { quotes: underlyingQuotes } = useQuotes(ticker ? [ticker] : []);
  const underlyingQuote = ticker ? underlyingQuotes?.get(ticker) : undefined;

  // Diagnostic logging for missing underlying quotes
  useEffect(() => {
    if (!ticker) return; // Skip logging if no trade
    if (!underlyingQuote && underlyingQuotes.size > 0) {
      console.warn(
        `[useActiveTradeLiveModel] No underlying quote for ${ticker}. Available quotes:`,
        Array.from(underlyingQuotes.keys())
      );
    } else if (!underlyingQuote) {
      console.warn(
        `[useActiveTradeLiveModel] No underlying quote for ${ticker} and quotes map is empty`
      );
    } else {
      const asOfDate = new Date(underlyingQuote.asOf);
      const asOfStr = isNaN(asOfDate.getTime()) ? "invalid" : asOfDate.toISOString();
      console.log(`[useActiveTradeLiveModel] Underlying quote for ${ticker}:`, {
        last: underlyingQuote.last,
        asOf: asOfStr,
      });
    }
  }, [ticker, underlyingQuote, underlyingQuotes]);

  // Time tracking
  const [timeState, setTimeState] = useState({
    timeToCloseMinutes: 0,
    holdTimeMinutes: 0,
    marketOpen: false,
  });

  // Update time every minute
  const tradeEntryTime = trade?.entryTime;
  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      const closeTime = getMarketCloseTime();
      const timeToClose = Math.max(0, (closeTime.getTime() - now) / 60000);

      const entryTime = tradeEntryTime ? new Date(tradeEntryTime).getTime() : now;
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
  }, [tradeEntryTime]);

  // Fetch market close price when needed (NEW - for P&L accuracy)
  const updateTrade = useTradeStore((state) => state.updateTrade);
  const tradeId = trade?.id;
  const tradeLastOptionPriceAt = trade?.last_option_price_at;
  useEffect(() => {
    // Skip if no trade
    if (!trade || !tradeId) return;

    const shouldFetchClosing =
      !timeState.marketOpen &&
      (!optionBid || optionBid === 0) &&
      (!optionAsk || optionAsk === 0) &&
      !isExpired &&
      (!tradeLastOptionPriceAt ||
        Date.now() - new Date(tradeLastOptionPriceAt).getTime() > 10 * 60 * 1000);

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

          await updateTrade(tradeId, {
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
    trade,
    tradeId,
    timeState.marketOpen,
    optionBid,
    optionAsk,
    isExpired,
    contractId,
    tradeLastOptionPriceAt,
    updateTrade,
  ]);

  // Build the live model
  return useMemo(() => {
    // Return null if no trade (hooks must be called unconditionally, but useMemo can return null)
    if (!trade) {
      return null;
    }

    // FIXED: Priority cascade for price - NEVER fall back to stale contract.bid/ask
    // For expired contracts: use last_option_price (contract no longer trades)
    // For active contracts:
    // 1. Live streaming (optionBid/Ask from WebSocket/REST)
    // 2. Database last_option_price (most recent known)
    // 3. Last resort: entry_price (shows 0% P&L but at least correct)

    let bid = 0;
    let ask = 0;
    let effectiveMid = 0;
    let priceSource: "websocket" | "rest" | "closing" | "snapshot" = optionSource;
    let priceAsOf = optionAsOf;

    // For EXPIRED contracts: use last known price (contract no longer trades)
    if (isExpired) {
      effectiveMid =
        trade.last_option_price || trade.exitPrice || contract.mid || contract.last || 0;
      priceSource = "snapshot";
      priceAsOf = trade.last_option_price_at
        ? new Date(trade.last_option_price_at).getTime()
        : Date.now();
      bid = 0; // No active market for expired contract
      ask = 0;
    }
    // Step 1: Try live streaming data (highest priority)
    else if (optionBid > 0 && optionAsk > 0) {
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
      priceAsOf = trade.last_option_price_at
        ? new Date(trade.last_option_price_at).getTime()
        : Date.now();
      bid = trade.entry_bid || 0; // Use entry snapshot for spread display
      ask = trade.entry_ask || 0;
    }
    // Step 3: Last resort - use entry price (shows 0% P&L)
    else {
      effectiveMid = entryPrice;
      priceSource = "snapshot";
      priceAsOf = trade.entry_timestamp ? new Date(trade.entry_timestamp).getTime() : Date.now();
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

    // Target progress - calculate where price is between SL (0%) and TP (100%)
    const targetPrice = trade.targetPrice || entryPrice * 1.2; // Default 20% if not set
    let progressToTarget = 0;

    // Calculate progress using the full SL-to-TP range
    // SL = 0%, Entry = somewhere in middle, TP = 100%
    if (stopLoss > 0 && targetPrice > stopLoss) {
      const range = targetPrice - stopLoss;
      progressToTarget = Math.min(100, Math.max(0, ((effectiveMid - stopLoss) / range) * 100));
    } else if (entryPrice > 0 && targetPrice > entryPrice) {
      // Fallback to entry-based calculation if no stop loss
      progressToTarget = Math.min(
        100,
        Math.max(0, ((effectiveMid - entryPrice) / (targetPrice - entryPrice)) * 100)
      );
    }

    // Underlying data with fallback:
    // 1. Live quote (best) - shows current price
    // 2. null - shows "N/A" instead of $0.00
    const underlyingPrice = underlyingQuote?.last || null;
    const underlyingChange = underlyingQuote?.change || 0;
    const underlyingChangePercent = underlyingQuote?.changePercent || 0;
    const underlyingAsOf = underlyingQuote?.asOf || 0;
    // Only mark as stale if we HAVE data but it's old
    // If we have NO data (underlyingAsOf === 0), it's "unavailable" not "stale"
    const underlyingIsStale =
      underlyingAsOf > 0 ? Date.now() - underlyingAsOf > UNDERLYING_STALE_MS : false; // No data = not stale, just unavailable
    const underlyingIsUnavailable = !underlyingQuote?.last;

    // Overall health assessment
    // Focus on price data freshness - Greeks being static is acceptable since they don't change rapidly
    // IMPORTANT: "unavailable" data should NOT penalize health - only "stale" (old) data does
    let overallHealth: "healthy" | "degraded" | "stale" = "healthy";
    if (optionIsStale && underlyingIsStale) {
      overallHealth = "stale";
    } else if (optionIsStale) {
      // Option price is critical for P&L - mark as degraded
      overallHealth = "degraded";
    } else if (underlyingIsStale && !underlyingIsUnavailable) {
      // Only penalize if underlying IS stale (has old data), not if it's just unavailable
      overallHealth = "degraded";
    }
    // Note: Greeks being "static" is NOT penalized since:
    // 1. Greeks don't change as rapidly as prices
    // 2. Contract snapshot Greeks are sufficient for display
    // 3. This prevents false "DELAYED" badge when prices are streaming fine
    // Note: Unavailable underlying (after hours) is NOT penalized - we just show "N/A"

    // DEBUG: Log the final P&L calculation
    console.warn(`📊 [LIVE MODEL] ${trade.ticker}:`, {
      effectiveMid,
      entryPrice,
      pnlPercent: roundPrice(netPnlPercent).toFixed(2) + "%",
      priceSource,
      priceAsOf: new Date(priceAsOf).toISOString(),
      priceLabel: getPriceLabel(priceSource, priceAsOf, timeState.marketOpen),
      optionBid,
      optionAsk,
      storeLastPrice: trade.last_option_price,
      storeLastPriceAt: trade.last_option_price_at,
    });

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
      underlyingPrice: underlyingPrice !== null ? roundPrice(underlyingPrice) : null,
      underlyingChange: roundPrice(underlyingChange),
      underlyingChangePercent: roundPrice(underlyingChangePercent),
      underlyingIsUnavailable,

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
      priceIsStale: isExpired ? false : Date.now() - priceAsOf > 30000, // Expired = final, not stale
      priceLabel: isExpired
        ? "Expired"
        : getPriceLabel(priceSource, priceAsOf, timeState.marketOpen),

      // For display
      entryPrice: roundPrice(entryPrice),
      targetPrice: roundPrice(targetPrice),
      stopLoss: roundPrice(stopLoss),
      progressToTarget: roundPrice(progressToTarget),

      // Contract status
      isExpired,
    };
  }, [
    trade,
    contract,
    isExpired,
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
