import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trade, Challenge, DiscordChannel, AlertType } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { formatDiscordAlert } from "../../../lib/discordFormatter";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  Edit2,
  Zap,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { HDCalculatorModal } from "../forms/HDCalculatorModal";
import { HDTradeShareCard } from "../cards/HDTradeShareCard";
import { useSymbolData } from "../../../stores/marketDataStore";

// Persistence key prefix for toggle settings
const TOGGLE_STORAGE_PREFIX = "hd.alertComposer.toggles";

// Toggle field names for persistence
interface ToggleSettings {
  showEntry: boolean;
  showCurrent: boolean;
  showTarget: boolean;
  showStopLoss: boolean;
  showPnL: boolean;
  showConfluence: boolean;
  showDTE: boolean;
  showRiskReward: boolean;
  showGreeks: boolean;
  showUnderlying: boolean;
  showSetupType: boolean;
  showGainsImage: boolean;
}

// Get the storage key for a specific alert type (including updateKind for updates)
function getToggleStorageKey(alertType: AlertType, updateKind?: string): string {
  if (alertType === "update" && updateKind) {
    return `${TOGGLE_STORAGE_PREFIX}.${alertType}.${updateKind}`;
  }
  return `${TOGGLE_STORAGE_PREFIX}.${alertType}`;
}

// Load toggle settings from localStorage
function loadToggleSettings(key: string): Partial<ToggleSettings> | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn(`[AlertComposer] Failed to load toggle settings from ${key}:`, e);
  }
  return null;
}

// Save toggle settings to localStorage
function saveToggleSettings(key: string, settings: Partial<ToggleSettings>): void {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn(`[AlertComposer] Failed to save toggle settings to ${key}:`, e);
  }
}

// Price overrides that can be passed from the alert composer to the alert handlers
export interface PriceOverrides {
  entryPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  // Underlying price context for Format C display
  targetUnderlyingPrice?: number;
  stopUnderlyingPrice?: number;
  // For exit alerts - include gains image with Discord message
  includeGainsImage?: boolean;
}

interface HDAlertComposerProps {
  trade: Trade;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" | "take-profit" };
  availableChannels: DiscordChannel[];
  challenges: Challenge[];
  onSend: (
    channels: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onEnterAndAlert?: (
    channels: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onCancel?: () => void; // Cancel without removing trade (mobile only)
  onUnload?: () => void; // Unload trade from loaded list
  className?: string;
  underlyingPrice?: number;
  underlyingChange?: number;
}

export function HDAlertComposer({
  trade,
  alertType,
  alertOptions,
  availableChannels,
  challenges,
  onSend,
  onEnterAndAlert,
  onCancel,
  onUnload,
  className,
  underlyingPrice,
  underlyingChange,
}: HDAlertComposerProps) {
  console.log("📝 HDAlertComposer rendered:", { alertType, alertOptions, trade: trade.ticker });

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  // Field toggles for alert customization
  const [showEntry, setShowEntry] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [showStopLoss, setShowStopLoss] = useState(false);
  const [showPnL, setShowPnL] = useState(false);
  const [showConfluence, setShowConfluence] = useState(false);
  const [showGainsImage, setShowGainsImage] = useState(false); // For exit alerts only
  // New enhanced toggles
  const [showDTE, setShowDTE] = useState(true); // DTE is critical for options
  const [showRiskReward, setShowRiskReward] = useState(false);
  const [showGreeks, setShowGreeks] = useState(false);
  const [showUnderlying, setShowUnderlying] = useState(false);
  const [showSetupType, setShowSetupType] = useState(false);

  // Editable prices
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice || trade.contract.mid);
  const [currentPrice, setCurrentPrice] = useState(trade.currentPrice || trade.contract.mid);
  const [targetPrice, setTargetPrice] = useState(trade.targetPrice || trade.contract.mid * 1.5);
  const [stopLoss, setStopLoss] = useState(trade.stopLoss || trade.contract.mid * 0.5);

  // Calculator modal state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [editingField, setEditingField] = useState<"entry" | "current" | "target" | "stop" | null>(
    null
  );

  // Quick action buttons state for stop loss updates
  const [slQuickAction, setSlQuickAction] = useState<"custom" | "trail" | "breakeven">("custom");

  // Inline editing state for price strip
  const [editingPriceField, setEditingPriceField] = useState<
    "entry" | "current" | "target" | "stop" | null
  >(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingPriceField && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingPriceField]);

  // Handle inline price edit start
  const startInlineEdit = (field: "entry" | "current" | "target" | "stop") => {
    setEditingPriceField(field);
    const value =
      field === "entry"
        ? entryPrice
        : field === "current"
          ? currentPrice
          : field === "target"
            ? targetPrice
            : stopLoss;
    setTempPriceValue(value?.toFixed(2) || "0.00");
  };

  // Handle inline price edit save
  const saveInlineEdit = () => {
    if (!editingPriceField) return;
    const value = parseFloat(tempPriceValue);
    if (!isNaN(value) && value >= 0) {
      if (editingPriceField === "entry") setEntryPrice(value);
      else if (editingPriceField === "current") setCurrentPrice(value);
      else if (editingPriceField === "target") setTargetPrice(value);
      else if (editingPriceField === "stop") setStopLoss(value);
    }
    setEditingPriceField(null);
    setTempPriceValue("");
  };

  // Handle inline price edit cancel
  const cancelInlineEdit = () => {
    setEditingPriceField(null);
    setTempPriceValue("");
  };

  // Handle increment/decrement for inline price editing
  const adjustPrice = (field: "entry" | "current" | "target" | "stop", delta: number) => {
    const step = 0.05; // 5 cent increments
    if (field === "entry") setEntryPrice(Math.max(0, (entryPrice || 0) + delta * step));
    else if (field === "current") setCurrentPrice(Math.max(0, (currentPrice || 0) + delta * step));
    else if (field === "target") setTargetPrice(Math.max(0, (targetPrice || 0) + delta * step));
    else if (field === "stop") setStopLoss(Math.max(0, (stopLoss || 0) + delta * step));
  };

  // Initialize channels and challenges when trade changes or alert opens
  useEffect(() => {
    // Ensure we always work with arrays to prevent .includes() crashes
    const tradeChannels = Array.isArray(trade.discordChannels) ? trade.discordChannels : [];
    const tradeChallenges = Array.isArray(trade.challenges) ? trade.challenges : [];

    // Log warnings if arrays were malformed (helps debug data issues)
    if (trade.id && !trade.id.startsWith("preview-")) {
      if (trade.discordChannels && !Array.isArray(trade.discordChannels)) {
        console.warn(
          `[AlertComposer] Trade ${trade.id} has malformed discordChannels (expected array, got ${typeof trade.discordChannels})`
        );
      }
      if (trade.challenges && !Array.isArray(trade.challenges)) {
        console.warn(
          `[AlertComposer] Trade ${trade.id} has malformed challenges (expected array, got ${typeof trade.challenges})`
        );
      }
    }

    // Channel selection priority:
    // 1. Trade's saved channels (for existing trades)
    // 2. Last used channels from localStorage
    // 3. Global default channel
    let channelsToUse: string[] = tradeChannels;

    if (channelsToUse.length === 0) {
      // Try to get last used channels from localStorage
      try {
        const lastUsedKey = `discord_last_channels_${alertType}`;
        const lastUsed = localStorage.getItem(lastUsedKey);
        if (lastUsed) {
          const parsed = JSON.parse(lastUsed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Validate that channels still exist
            const validChannels = parsed.filter((id: string) =>
              availableChannels.some((ch) => ch.id === id)
            );
            if (validChannels.length > 0) {
              channelsToUse = validChannels;
            }
          }
        }
      } catch (e) {
        console.warn("[AlertComposer] Failed to load last used channels:", e);
      }
    }

    if (channelsToUse.length === 0) {
      // Fall back to global default channel
      const defaultChannel = availableChannels.find((ch) => ch.isGlobalDefault);
      if (defaultChannel) {
        channelsToUse = [defaultChannel.id];
      }
    }

    setSelectedChannels(channelsToUse);
    setSelectedChallenges(tradeChallenges);
  }, [trade.id, trade.discordChannels, trade.challenges, alertType, availableChannels]); // Re-run when channels/challenges change

  // Get default toggle values for a given alert type (used as baseline before applying persisted)
  const getDefaultToggles = useCallback((type: AlertType, updateKind?: string): ToggleSettings => {
    // Base defaults - conservative
    const base: ToggleSettings = {
      showEntry: false,
      showCurrent: false,
      showTarget: false,
      showStopLoss: false,
      showPnL: false,
      showConfluence: false,
      showDTE: true, // DTE is always relevant for options
      showRiskReward: false,
      showGreeks: false,
      showUnderlying: false,
      showSetupType: false,
      showGainsImage: false,
    };

    if (type === "enter") {
      return {
        ...base,
        showEntry: true,
        showCurrent: true,
        showTarget: true,
        showStopLoss: true,
        showRiskReward: true,
        showGreeks: true,
        showUnderlying: true,
        showSetupType: true,
      };
    } else if (type === "update" && updateKind === "trim") {
      return { ...base, showCurrent: true, showPnL: true };
    } else if (type === "update" && updateKind === "sl") {
      return { ...base, showCurrent: true, showStopLoss: true, showPnL: true };
    } else if (type === "update" && updateKind === "generic") {
      return { ...base, showCurrent: true, showPnL: true };
    } else if (type === "update" && updateKind === "take-profit") {
      return { ...base, showCurrent: true, showTarget: true, showPnL: true };
    } else if (type === "trail-stop") {
      return { ...base, showStopLoss: true };
    } else if (type === "add") {
      return { ...base, showCurrent: true, showPnL: true };
    } else if (type === "exit") {
      return { ...base, showEntry: true, showCurrent: true, showPnL: true, showGainsImage: true };
    } else if (type === "load") {
      return {
        ...base,
        showCurrent: true,
        showTarget: true,
        showStopLoss: true,
        showRiskReward: true,
        showGreeks: true,
        showUnderlying: true,
        showSetupType: true,
      };
    }
    return base;
  }, []);

  // Initialize defaults based on alertType - with localStorage persistence support
  useEffect(() => {
    // Initialize prices
    setEntryPrice(trade.entryPrice || trade.contract.mid);
    setCurrentPrice(trade.currentPrice || trade.contract.mid);
    setTargetPrice(trade.targetPrice || trade.contract.mid * 1.5);
    setStopLoss(trade.stopLoss || trade.contract.mid * 0.5);

    // Set default comment with auto-populated info or voice context
    let defaultComment = "";

    // If voice context exists, use it as the default comment
    if (trade.voiceContext) {
      defaultComment = trade.voiceContext;
    } else if (alertType === "load") {
      defaultComment = `Watching this ${trade.tradeType} setup. Entry around $${formatPrice(trade.contract.mid)}${underlyingPrice ? ` (${trade.ticker} @ $${formatPrice(underlyingPrice)})` : ""}.`;
    } else if (alertType === "enter") {
      defaultComment = `Entering at $${formatPrice(trade.entryPrice || trade.contract.mid)}${underlyingPrice ? ` (${trade.ticker} @ $${formatPrice(underlyingPrice)})` : ""}. Targeting $${formatPrice(trade.targetPrice || trade.contract.mid * 1.5)} with stop at $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)}.`;
    } else if (alertType === "update" && alertOptions?.updateKind === "trim") {
      defaultComment = `Trimming here at $${formatPrice(trade.currentPrice || trade.contract.mid)} to lock in profit. ${trade.movePercent ? `Up ${trade.movePercent > 0 ? "+" : ""}${trade.movePercent.toFixed(1)}%.` : ""}`;
    } else if (alertType === "update" && alertOptions?.updateKind === "sl") {
      defaultComment = `Moving stop loss to $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)} to protect gains. Currently at $${formatPrice(trade.currentPrice || trade.contract.mid)} (${trade.movePercent ? (trade.movePercent > 0 ? "+" : "") + trade.movePercent.toFixed(1) : "0.0"}%).`;
    } else if (alertType === "update" && alertOptions?.updateKind === "generic") {
      defaultComment = `Update: Currently at $${formatPrice(trade.currentPrice || trade.contract.mid)}. ${trade.movePercent ? `P&L: ${trade.movePercent > 0 ? "+" : ""}${trade.movePercent.toFixed(1)}%.` : ""}`;
    } else if (alertType === "update" && alertOptions?.updateKind === "take-profit") {
      defaultComment = `Taking profit at target! Exiting partial position at $${formatPrice(trade.currentPrice || trade.targetPrice || trade.contract.mid)}. ${trade.movePercent ? `Locking in ${trade.movePercent > 0 ? "+" : ""}${trade.movePercent.toFixed(1)}%.` : ""}`;
    } else if (alertType === "trail-stop") {
      defaultComment = `Enabling trailing stop at $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)}. Letting winners run.`;
    } else if (alertType === "add") {
      defaultComment = `Adding to position at $${formatPrice(trade.currentPrice || trade.contract.mid)}. ${trade.movePercent ? `Currently ${trade.movePercent > 0 ? "+" : ""}${trade.movePercent.toFixed(1)}%.` : ""}`;
    } else if (alertType === "exit") {
      defaultComment = `Exiting position at $${formatPrice(trade.currentPrice || trade.contract.mid)}. ${trade.movePercent ? `Final P&L: ${trade.movePercent > 0 ? "+" : ""}${trade.movePercent.toFixed(1)}%.` : ""}`;
    }
    setComment(defaultComment);

    // Get default toggles for this alert type
    const defaults = getDefaultToggles(alertType, alertOptions?.updateKind);

    // Try to load persisted toggles from localStorage
    const storageKey = getToggleStorageKey(alertType, alertOptions?.updateKind);
    const persisted = loadToggleSettings(storageKey);

    // Merge persisted with defaults (persisted values override defaults)
    const toggles = persisted ? { ...defaults, ...persisted } : defaults;

    // Apply toggles to state
    setShowEntry(toggles.showEntry);
    setShowCurrent(toggles.showCurrent);
    setShowTarget(toggles.showTarget);
    setShowStopLoss(toggles.showStopLoss);
    setShowPnL(toggles.showPnL);
    setShowConfluence(toggles.showConfluence);
    setShowDTE(toggles.showDTE);
    setShowRiskReward(toggles.showRiskReward);
    setShowGreeks(toggles.showGreeks);
    setShowUnderlying(toggles.showUnderlying);
    setShowSetupType(toggles.showSetupType);
    setShowGainsImage(toggles.showGainsImage);

    console.log(
      `[AlertComposer] Initialized toggles for ${alertType}${alertOptions?.updateKind ? `.${alertOptions.updateKind}` : ""} - persisted: ${!!persisted}`,
      toggles
    );
  }, [trade, alertType, alertOptions, getDefaultToggles, underlyingPrice]);

  // Persist toggle changes to localStorage when they change (debounced to avoid excessive writes)
  useEffect(() => {
    // Skip on initial mount - only persist user changes
    const storageKey = getToggleStorageKey(alertType, alertOptions?.updateKind);

    // Debounce persistence to avoid too many writes
    const timeoutId = setTimeout(() => {
      const currentToggles: ToggleSettings = {
        showEntry,
        showCurrent,
        showTarget,
        showStopLoss,
        showPnL,
        showConfluence,
        showDTE,
        showRiskReward,
        showGreeks,
        showUnderlying,
        showSetupType,
        showGainsImage,
      };
      saveToggleSettings(storageKey, currentToggles);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    alertType,
    alertOptions?.updateKind,
    showEntry,
    showCurrent,
    showTarget,
    showStopLoss,
    showPnL,
    showConfluence,
    showDTE,
    showRiskReward,
    showGreeks,
    showUnderlying,
    showSetupType,
    showGainsImage,
  ]);

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challengeId) ? prev.filter((c) => c !== challengeId) : [...prev, challengeId]
    );
  };

  // Persist selected channels to localStorage for future alerts
  const persistChannelSelection = () => {
    if (selectedChannels.length > 0) {
      try {
        const key = `discord_last_channels_${alertType}`;
        localStorage.setItem(key, JSON.stringify(selectedChannels));
      } catch (e) {
        console.warn("[AlertComposer] Failed to persist channel selection:", e);
      }
    }
  };

  const getAlertTitle = () => {
    if (alertType === "load") return "Load Alert";
    if (alertType === "enter") return "Entry Alert";
    if (alertType === "exit") return "Exit Alert";
    if (alertType === "add") return "Add Alert";
    if (alertType === "trail-stop") return "Trail Stop Alert";
    if (alertType === "update" && alertOptions?.updateKind === "trim") return "Trim Alert";
    if (alertType === "update" && alertOptions?.updateKind === "sl") return "Update Stop Loss";
    if (alertType === "update" && alertOptions?.updateKind === "generic") return "Update Alert";
    if (alertType === "update" && alertOptions?.updateKind === "take-profit")
      return "Take Profit Alert";
    return "Alert";
  };

  const getPreviewMessage = () => {
    // Use effectiveTrade (with user's price overrides) for preview - CRITICAL FIX
    // This ensures preview matches what will actually be sent
    return formatDiscordAlert(effectiveTrade, alertType, {
      updateKind: alertOptions?.updateKind,
      includeEntry: showEntry,
      includeCurrent: showCurrent,
      includeTarget: showTarget,
      includeStopLoss: showStopLoss,
      includePnL: showPnL,
      includeConfluence: showConfluence,
      comment: comment,
      // Pass comprehensive confluence data from live sources
      confluenceData: showConfluence ? confluenceForDiscord : undefined,
      // New enhanced fields
      includeDTE: showDTE,
      includeRiskReward: showRiskReward,
      includeGreeks: showGreeks,
      includeUnderlying: showUnderlying,
      includeSetupType: showSetupType,
      // Data for new fields
      dte: tradeTypeDisplay?.dte,
      riskReward: riskRewardRatio,
      greeks: showGreeks ? greeksData : undefined,
      underlyingPrice: showUnderlying ? underlyingPrice : undefined,
      setupType: showSetupType ? effectiveTrade.setupType : undefined,
    });
  };

  const openCalculator = (field: "entry" | "current" | "target" | "stop") => {
    setEditingField(field);
    setCalculatorOpen(true);
  };

  const handlePriceUpdate = (value: number) => {
    if (editingField === "entry") {
      setEntryPrice(value);
    } else if (editingField === "current") {
      setCurrentPrice(value);
    } else if (editingField === "target") {
      setTargetPrice(value);
    } else if (editingField === "stop") {
      setStopLoss(value);
    }
  };

  const getCalculatorTitle = () => {
    if (editingField === "entry") return "Entry Price";
    if (editingField === "current") return "Current Price";
    if (editingField === "target") return "Target Price";
    if (editingField === "stop") return "Stop Loss Price";
    return "Price";
  };

  const getCalculatorValue = () => {
    if (editingField === "entry") return entryPrice;
    if (editingField === "current") return currentPrice;
    if (editingField === "target") return targetPrice;
    if (editingField === "stop") return stopLoss;
    return 0;
  };

  const tradeTypeDisplay = useMemo(() => {
    if (!trade.contract?.expiration) return null;

    const expiration = new Date(trade.contract.expiration);
    const now = new Date();
    const diffMs = expiration.getTime() - now.getTime();
    const dte = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

    let type = "DAY";
    if (dte <= 2) type = "0DTE/SCALP";
    else if (dte <= 14) type = "DAY";
    else if (dte <= 60) type = "SWING";
    else type = "LEAP";

    return { type, dte };
  }, [trade.contract?.expiration]);

  // Calculate Risk/Reward ratio
  const riskRewardRatio = useMemo(() => {
    const entry = entryPrice || trade.contract.mid;
    const target = targetPrice;
    const stop = stopLoss;

    if (!entry || !target || !stop || entry === stop) return null;

    const reward = Math.abs(target - entry);
    const risk = Math.abs(entry - stop);

    if (risk === 0) return null;
    return reward / risk;
  }, [entryPrice, targetPrice, stopLoss, trade.contract.mid]);

  // Get Greeks from contract
  const greeksData = useMemo(() => {
    const contract = trade.contract;
    return {
      delta: contract.delta,
      iv: contract.iv,
      theta: contract.theta,
      gamma: contract.gamma,
    };
  }, [trade.contract]);

  // Get live confluence data from marketDataStore
  const symbolData = useSymbolData(trade.ticker);

  // Create "effectiveTrade" - applies user's price overrides to trade for preview/send
  // This is the SINGLE SOURCE OF TRUTH for what will be sent
  const effectiveTrade = useMemo((): Trade => {
    // Compute movePercent based on current prices
    const effectiveEntry = entryPrice || trade.entryPrice || trade.contract.mid;
    const effectiveCurrent = currentPrice || trade.currentPrice || trade.contract.mid;
    const computedMovePercent =
      effectiveEntry > 0
        ? ((effectiveCurrent - effectiveEntry) / effectiveEntry) * 100
        : trade.movePercent || 0;

    return {
      ...trade,
      entryPrice: entryPrice || trade.entryPrice,
      currentPrice: currentPrice || trade.currentPrice || trade.contract.mid,
      targetPrice: targetPrice || trade.targetPrice,
      stopLoss: stopLoss || trade.stopLoss,
      movePercent: computedMovePercent,
    };
  }, [trade, entryPrice, currentPrice, targetPrice, stopLoss]);

  // Build comprehensive confluence data for Discord from best available source
  const confluenceForDiscord = useMemo(() => {
    // Priority 1: Live symbolData confluence from marketDataStore (most complete)
    const liveConf = symbolData?.confluence;
    // Priority 2: Trade's stored confluence (may be stale)
    const tradeConf = trade.confluence;

    if (!liveConf && !tradeConf) return undefined;

    // Use live data if available, fall back to trade confluence
    const overallScore = liveConf?.overall ?? tradeConf?.score;

    // Build subscores from live data
    const subscores = liveConf
      ? {
          trend: liveConf.trend,
          momentum: liveConf.momentum,
          volatility: liveConf.volatility,
          volume: liveConf.volume,
          technical: liveConf.technical,
        }
      : undefined;

    // Build components checklist from live data
    const components = liveConf?.components
      ? {
          trendAlignment: liveConf.components.trendAlignment,
          aboveVWAP: liveConf.components.aboveVWAP,
          rsiConfirm: liveConf.components.rsiConfirm,
          volumeConfirm: liveConf.components.volumeConfirm,
          supportResistance: liveConf.components.supportResistance,
        }
      : undefined;

    // Build highlights from trade confluence factors
    const highlights: string[] = [];
    if (tradeConf?.factors) {
      if (tradeConf.factors.ivPercentile?.value !== undefined) {
        highlights.push(`IVP ${tradeConf.factors.ivPercentile.value}%`);
      }
      if (tradeConf.factors.flowPressure?.value !== undefined) {
        const flow = tradeConf.factors.flowPressure.value;
        highlights.push(`Flow ${flow >= 0 ? "+" : ""}${flow}`);
      }
      if (tradeConf.factors.volumeProfile?.value !== undefined) {
        highlights.push(`RVOL ${tradeConf.factors.volumeProfile.value.toFixed(1)}x`);
      }
    }

    // Legacy RSI/MACD support (for backwards compatibility)
    const indicators = symbolData?.indicators;
    const rsi = indicators?.rsi14 ? Math.round(indicators.rsi14) : undefined;

    return {
      overallScore,
      subscores,
      components,
      highlights: highlights.length > 0 ? highlights : undefined,
      // Legacy fields for backwards compatibility
      rsi,
      macdSignal: undefined as "bullish" | "bearish" | "neutral" | undefined,
      volumeChange: undefined as number | undefined,
      ivPercentile: tradeConf?.factors?.ivPercentile?.value,
    };
  }, [symbolData, trade.confluence]);

  // Validation for alert data - prevents invalid sends
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    // Check for required channel selection
    if (selectedChannels.length === 0) {
      errors.push("Select at least one Discord channel");
    }

    // Check price validity for alerts that need it
    const priceFieldsToCheck: { field: string; value: number | undefined; showToggle: boolean }[] =
      [
        { field: "Entry price", value: entryPrice, showToggle: showEntry },
        { field: "Current price", value: currentPrice, showToggle: showCurrent },
        { field: "Target price", value: targetPrice, showToggle: showTarget },
        { field: "Stop loss", value: stopLoss, showToggle: showStopLoss },
      ];

    // For entry/load alerts, validate all price fields that are shown
    for (const { field, value, showToggle } of priceFieldsToCheck) {
      if (showToggle && (value === undefined || isNaN(value) || value <= 0)) {
        errors.push(`${field} must be a positive number`);
      }
    }

    // Note: Stop loss and target position validation removed per user request
    // Users can set any stop/target values they prefer

    return errors;
  }, [
    selectedChannels,
    entryPrice,
    currentPrice,
    targetPrice,
    stopLoss,
    showEntry,
    showCurrent,
    showTarget,
    showStopLoss,
    alertType,
    trade,
  ]);

  // Can send if no validation errors (channel check is redundant but explicit)
  const canSend =
    validationErrors.length === 0 ||
    (validationErrors.length === 1 && validationErrors[0].includes("Discord channel"));

  return (
    <div className="h-full flex flex-col bg-[var(--surface-2)] overflow-hidden">
      {/* Header */}
      <div className="px-4 lg:px-6 py-4 border-b border-[var(--border-hairline)] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[var(--text-high)] font-semibold">{getAlertTitle()}</h2>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              Configure alert details and channels
            </p>
          </div>
          {tradeTypeDisplay && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs px-2 py-1 rounded-[var(--radius)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-medium uppercase tracking-wide">
                {tradeTypeDisplay.type}
              </span>
              <span className="text-[var(--text-muted)] text-xs">{tradeTypeDisplay.dte} DTE</span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Middle Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-3 space-y-3">
        {/* 1-CLICK PRESET BUTTONS - Quick config for common scenarios */}
        {(alertType === "load" || alertType === "enter") && (
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                // Full send: all fields enabled
                setShowEntry(true);
                setShowCurrent(true);
                setShowTarget(true);
                setShowStopLoss(true);
                setShowRiskReward(true);
                setShowDTE(true);
                setShowGreeks(true);
                setShowConfluence(true);
              }}
              className="flex-1 px-2 py-1.5 rounded-[var(--radius)] text-[10px] font-medium bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-colors flex items-center justify-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Full
            </button>
            <button
              onClick={() => {
                // Minimal: just entry, target, stop
                setShowEntry(true);
                setShowCurrent(false);
                setShowTarget(true);
                setShowStopLoss(true);
                setShowRiskReward(false);
                setShowDTE(true);
                setShowGreeks(false);
                setShowConfluence(false);
              }}
              className="flex-1 px-2 py-1.5 rounded-[var(--radius)] text-[10px] font-medium bg-[var(--surface-1)] text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors flex items-center justify-center gap-1"
            >
              <Target className="w-3 h-3" />
              Minimal
            </button>
            <button
              onClick={() => {
                // Scalp: quick trade, tight stops
                setShowEntry(true);
                setShowCurrent(true);
                setShowTarget(true);
                setShowStopLoss(true);
                setShowRiskReward(true);
                setShowDTE(true);
                setShowGreeks(false);
                setShowConfluence(false);
              }}
              className="flex-1 px-2 py-1.5 rounded-[var(--radius)] text-[10px] font-medium bg-[var(--surface-1)] text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors flex items-center justify-center gap-1"
            >
              <TrendingUp className="w-3 h-3" />
              Scalp
            </button>
          </div>
        )}

        {/* ENHANCED PRICE STRIP - Inline editing with +/- buttons */}
        <div className="p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
          <div className="grid grid-cols-2 gap-2">
            {/* Entry Price */}
            <div
              className={cn(
                "p-2 rounded-[var(--radius)] transition-colors",
                showEntry ? "bg-[var(--surface-2)]" : "opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--text-muted)] uppercase">Entry</span>
                <Checkbox
                  id="toggle-entry-strip"
                  checked={showEntry}
                  onCheckedChange={(checked) => setShowEntry(checked as boolean)}
                  className="w-3 h-3"
                />
              </div>
              {editingPriceField === "entry" ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={priceInputRef}
                    type="text"
                    value={tempPriceValue}
                    onChange={(e) => setTempPriceValue(e.target.value)}
                    onBlur={saveInlineEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveInlineEdit();
                      if (e.key === "Escape") cancelInlineEdit();
                    }}
                    className="w-full text-sm font-mono bg-transparent border-b border-[var(--brand-primary)] text-[var(--text-high)] text-center outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => adjustPrice("entry", -1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)]"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => startInlineEdit("entry")}
                    className="text-sm font-mono text-[var(--text-high)] hover:text-[var(--brand-primary)]"
                  >
                    ${formatPrice(entryPrice)}
                  </button>
                  <button
                    onClick={() => adjustPrice("entry", 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Current Price */}
            <div
              className={cn(
                "p-2 rounded-[var(--radius)] transition-colors",
                showCurrent ? "bg-[var(--surface-2)]" : "opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--text-muted)] uppercase">Current</span>
                <Checkbox
                  id="toggle-current-strip"
                  checked={showCurrent}
                  onCheckedChange={(checked) => setShowCurrent(checked as boolean)}
                  className="w-3 h-3"
                />
              </div>
              {editingPriceField === "current" ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={editingPriceField === "current" ? priceInputRef : undefined}
                    type="text"
                    value={tempPriceValue}
                    onChange={(e) => setTempPriceValue(e.target.value)}
                    onBlur={saveInlineEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveInlineEdit();
                      if (e.key === "Escape") cancelInlineEdit();
                    }}
                    className="w-full text-sm font-mono bg-transparent border-b border-[var(--brand-primary)] text-[var(--text-high)] text-center outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => adjustPrice("current", -1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)]"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => startInlineEdit("current")}
                    className="text-sm font-mono text-[var(--text-high)] hover:text-[var(--brand-primary)]"
                  >
                    ${formatPrice(currentPrice)}
                  </button>
                  <button
                    onClick={() => adjustPrice("current", 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Target Price */}
            <div
              className={cn(
                "p-2 rounded-[var(--radius)] transition-colors",
                showTarget ? "bg-[var(--accent-positive)]/10" : "opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--accent-positive)] uppercase">Target</span>
                <Checkbox
                  id="toggle-target-strip"
                  checked={showTarget}
                  onCheckedChange={(checked) => setShowTarget(checked as boolean)}
                  className="w-3 h-3"
                />
              </div>
              {editingPriceField === "target" ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={editingPriceField === "target" ? priceInputRef : undefined}
                    type="text"
                    value={tempPriceValue}
                    onChange={(e) => setTempPriceValue(e.target.value)}
                    onBlur={saveInlineEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveInlineEdit();
                      if (e.key === "Escape") cancelInlineEdit();
                    }}
                    className="w-full text-sm font-mono bg-transparent border-b border-[var(--accent-positive)] text-[var(--accent-positive)] text-center outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => adjustPrice("target", -1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-positive)] hover:bg-[var(--accent-positive)]/10"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => startInlineEdit("target")}
                    className="text-sm font-mono text-[var(--accent-positive)] hover:text-[var(--accent-positive)]/80"
                  >
                    ${formatPrice(targetPrice)}
                  </button>
                  <button
                    onClick={() => adjustPrice("target", 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-positive)] hover:bg-[var(--accent-positive)]/10"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Stop Loss */}
            <div
              className={cn(
                "p-2 rounded-[var(--radius)] transition-colors",
                showStopLoss ? "bg-[var(--accent-negative)]/10" : "opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--accent-negative)] uppercase">Stop</span>
                <Checkbox
                  id="toggle-stop-strip"
                  checked={showStopLoss}
                  onCheckedChange={(checked) => setShowStopLoss(checked as boolean)}
                  className="w-3 h-3"
                />
              </div>
              {editingPriceField === "stop" ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={editingPriceField === "stop" ? priceInputRef : undefined}
                    type="text"
                    value={tempPriceValue}
                    onChange={(e) => setTempPriceValue(e.target.value)}
                    onBlur={saveInlineEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveInlineEdit();
                      if (e.key === "Escape") cancelInlineEdit();
                    }}
                    className="w-full text-sm font-mono bg-transparent border-b border-[var(--accent-negative)] text-[var(--accent-negative)] text-center outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => adjustPrice("stop", -1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/10"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => startInlineEdit("stop")}
                    className="text-sm font-mono text-[var(--accent-negative)] hover:text-[var(--accent-negative)]/80"
                  >
                    ${formatPrice(stopLoss)}
                  </button>
                  <button
                    onClick={() => adjustPrice("stop", 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/10"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* P&L + R:R indicator row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center gap-3">
              {effectiveTrade.movePercent !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">P&L</span>
                  <span
                    className={cn(
                      "text-xs tabular-nums font-medium",
                      effectiveTrade.movePercent >= 0
                        ? "text-[var(--accent-positive)]"
                        : "text-[var(--accent-negative)]"
                    )}
                  >
                    {effectiveTrade.movePercent >= 0 ? "+" : ""}
                    {effectiveTrade.movePercent.toFixed(1)}%
                  </span>
                </div>
              )}
              {riskRewardRatio && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">R:R</span>
                  <span
                    className={cn(
                      "text-xs tabular-nums font-medium",
                      riskRewardRatio >= 2
                        ? "text-[var(--accent-positive)]"
                        : riskRewardRatio >= 1
                          ? "text-[var(--brand-primary)]"
                          : "text-[var(--text-muted)]"
                    )}
                  >
                    {riskRewardRatio.toFixed(1)}:1
                  </span>
                </div>
              )}
            </div>
            {tradeTypeDisplay && (
              <span
                className={cn(
                  "text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded",
                  tradeTypeDisplay.dte === 0
                    ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                    : tradeTypeDisplay.dte && tradeTypeDisplay.dte <= 2
                      ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                )}
              >
                {tradeTypeDisplay.dte}DTE
              </span>
            )}
          </div>
        </div>

        {/* Stop Loss Quick Actions - Compact row for SL updates */}
        {alertType === "update" && alertOptions?.updateKind === "sl" && trade.entryPrice && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                const breakeven = trade.entryPrice || trade.contract.mid;
                setStopLoss(breakeven);
                setComment(
                  `Moving stop to breakeven at $${formatPrice(breakeven)} to lock in risk-free trade.`
                );
              }}
              className="flex-1 px-3 py-2 rounded-[var(--radius)] text-xs bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
            >
              Breakeven
            </button>
            <button
              onClick={() => {
                setComment(
                  `Trailing stop activated at $${formatPrice(stopLoss)}. Letting winners run.`
                );
              }}
              className="flex-1 px-3 py-2 rounded-[var(--radius)] text-xs bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
            >
              Trail Stop
            </button>
          </div>
        )}

        {/* Field Checkboxes - Collapsible */}
        <div>
          <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-2 block">
            Include in Alert
          </Label>
          <details className="group">
            <summary className="cursor-pointer flex items-center justify-between p-2 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors mb-1.5">
              <span className="text-xs text-[var(--text-high)]">
                {
                  [
                    showEntry,
                    showCurrent,
                    showTarget,
                    showStopLoss,
                    showPnL,
                    showConfluence,
                    showDTE,
                    showRiskReward,
                    showGreeks,
                    showUnderlying,
                    showSetupType,
                  ].filter(Boolean).length
                }{" "}
                field
                {[
                  showEntry,
                  showCurrent,
                  showTarget,
                  showStopLoss,
                  showPnL,
                  showConfluence,
                  showDTE,
                  showRiskReward,
                  showGreeks,
                  showUnderlying,
                  showSetupType,
                ].filter(Boolean).length !== 1
                  ? "s"
                  : ""}{" "}
                selected
              </span>
              <svg
                className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 mt-1.5">
              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-entry"
                    checked={showEntry}
                    onCheckedChange={(checked) => setShowEntry(checked as boolean)}
                  />
                  <label
                    htmlFor="field-entry"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    Entry
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-med)] text-xs tabular-nums">
                    ${formatPrice(entryPrice)}
                  </span>
                  <button
                    onClick={() => openCalculator("entry")}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-current"
                    checked={showCurrent}
                    onCheckedChange={(checked) => setShowCurrent(checked as boolean)}
                  />
                  <label
                    htmlFor="field-current"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    Current
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-med)] text-xs tabular-nums">
                    ${formatPrice(currentPrice)}
                  </span>
                  <button
                    onClick={() => openCalculator("current")}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-target"
                    checked={showTarget}
                    onCheckedChange={(checked) => setShowTarget(checked as boolean)}
                  />
                  <label
                    htmlFor="field-target"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    Target {/* Add TP1/TP2 labels if multiple */}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-positive)] text-xs tabular-nums">
                    ${formatPrice(targetPrice)}
                  </span>
                  <button
                    onClick={() => openCalculator("target")}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-stop"
                    checked={showStopLoss}
                    onCheckedChange={(checked) => setShowStopLoss(checked as boolean)}
                  />
                  <label
                    htmlFor="field-stop"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    Stop Loss
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-negative)] text-xs tabular-nums">
                    ${formatPrice(stopLoss)}
                  </span>
                  <button
                    onClick={() => openCalculator("stop")}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {trade.movePercent !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="field-pnl"
                      checked={showPnL}
                      onCheckedChange={(checked) => setShowPnL(checked as boolean)}
                    />
                    <label
                      htmlFor="field-pnl"
                      className="text-sm text-[var(--text-high)] cursor-pointer"
                    >
                      P&L
                    </label>
                  </div>
                  <div
                    className={cn(
                      "text-sm tabular-nums",
                      trade.movePercent >= 0
                        ? "text-[var(--accent-positive)]"
                        : "text-[var(--accent-negative)]"
                    )}
                  >
                    {trade.movePercent >= 0 ? "+" : ""}
                    {trade.movePercent.toFixed(1)}%
                  </div>
                </div>
              )}

              {/* Gains Image - Only for Exit alerts - Collapsible with preview */}
              {alertType === "exit" && (
                <details className="group" open={showGainsImage}>
                  <summary className="cursor-pointer flex items-center justify-between p-2 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors list-none">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="field-gains-image"
                        checked={showGainsImage}
                        onCheckedChange={(checked) => setShowGainsImage(checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label
                        htmlFor="field-gains-image"
                        className="text-xs text-[var(--text-high)] cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Include Gains Image
                      </label>
                    </div>
                    <svg
                      className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </summary>
                  <div className="mt-2 p-2 rounded-[var(--radius)] bg-[var(--bg-base)] border border-[var(--border-hairline)]">
                    <HDTradeShareCard trade={trade} includeWatermark={true} />
                  </div>
                </details>
              )}

              {/* Confluence Metrics - Optional */}
              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-confluence"
                    checked={showConfluence}
                    onCheckedChange={(checked) => setShowConfluence(checked as boolean)}
                  />
                  <label
                    htmlFor="field-confluence"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    Confluence Metrics
                  </label>
                </div>
                <div className="text-[var(--text-muted)] text-xs">Optional</div>
              </div>

              {/* NEW ENHANCED TOGGLES */}
              {/* DTE - Days to Expiration */}
              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-dte"
                    checked={showDTE}
                    onCheckedChange={(checked) => setShowDTE(checked as boolean)}
                  />
                  <label
                    htmlFor="field-dte"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    DTE
                  </label>
                </div>
                <div
                  className={cn(
                    "text-xs tabular-nums",
                    tradeTypeDisplay?.dte === 0
                      ? "text-[var(--accent-negative)]"
                      : tradeTypeDisplay?.dte && tradeTypeDisplay.dte <= 2
                        ? "text-[var(--brand-primary)]"
                        : "text-[var(--text-muted)]"
                  )}
                >
                  {tradeTypeDisplay?.dte ?? "-"} days
                </div>
              </div>

              {/* Risk/Reward Ratio */}
              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-rr"
                    checked={showRiskReward}
                    onCheckedChange={(checked) => setShowRiskReward(checked as boolean)}
                  />
                  <label
                    htmlFor="field-rr"
                    className="text-xs text-[var(--text-high)] cursor-pointer"
                  >
                    Risk/Reward
                  </label>
                </div>
                <div
                  className={cn(
                    "text-xs tabular-nums",
                    riskRewardRatio && riskRewardRatio >= 2
                      ? "text-[var(--accent-positive)]"
                      : riskRewardRatio && riskRewardRatio >= 1
                        ? "text-[var(--brand-primary)]"
                        : "text-[var(--text-muted)]"
                  )}
                >
                  {riskRewardRatio ? `${riskRewardRatio.toFixed(1)}:1` : "-"}
                </div>
              </div>

              {/* Greeks (Delta, IV) */}
              {(trade.contract.delta !== undefined || trade.contract.iv !== undefined) && (
                <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="field-greeks"
                      checked={showGreeks}
                      onCheckedChange={(checked) => setShowGreeks(checked as boolean)}
                    />
                    <label
                      htmlFor="field-greeks"
                      className="text-xs text-[var(--text-high)] cursor-pointer"
                    >
                      Greeks
                    </label>
                  </div>
                  <div className="text-[var(--text-muted)] text-xs flex gap-2">
                    {greeksData.delta !== undefined && (
                      <span>Δ {(greeksData.delta * 100).toFixed(0)}</span>
                    )}
                    {greeksData.iv !== undefined && (
                      <span>IV {(greeksData.iv * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              )}

              {/* Underlying Price */}
              {underlyingPrice !== undefined && (
                <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="field-underlying"
                      checked={showUnderlying}
                      onCheckedChange={(checked) => setShowUnderlying(checked as boolean)}
                    />
                    <label
                      htmlFor="field-underlying"
                      className="text-xs text-[var(--text-high)] cursor-pointer"
                    >
                      Underlying
                    </label>
                  </div>
                  <div className="text-[var(--text-muted)] text-xs tabular-nums">
                    {trade.ticker} @ ${formatPrice(underlyingPrice)}
                  </div>
                </div>
              )}

              {/* Setup Type */}
              {trade.setupType && (
                <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="field-setup"
                      checked={showSetupType}
                      onCheckedChange={(checked) => setShowSetupType(checked as boolean)}
                    />
                    <label
                      htmlFor="field-setup"
                      className="text-xs text-[var(--text-high)] cursor-pointer"
                    >
                      Setup Type
                    </label>
                  </div>
                  <div className="text-[var(--brand-primary)] text-xs uppercase tracking-wide">
                    {trade.setupType}
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Comment */}
        <div>
          <Label
            htmlFor="alert-comment"
            className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-2 block"
          >
            Comment
          </Label>
          <Textarea
            id="alert-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add context or reasoning..."
            className="min-h-[100px] bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)] resize-none"
          />
        </div>

        {/* Channels - Always collapsible when channels are selected */}
        <div>
          <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-3 block">
            Discord Channels{" "}
            {selectedChannels.length === 0 && (
              <span className="text-[var(--accent-negative)] normal-case">(required)</span>
            )}
          </Label>
          {selectedChannels.length > 0 ? (
            // Collapsed by default when channels are already selected
            <details className="group">
              <summary className="cursor-pointer flex items-center justify-between p-2 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors">
                <span className="text-xs text-[var(--text-high)]">
                  {selectedChannels.length} channel{selectedChannels.length !== 1 ? "s" : ""}{" "}
                  selected
                </span>
                <svg
                  className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center space-x-2 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors"
                  >
                    <Checkbox
                      id={`channel-${channel.id}`}
                      checked={selectedChannels.includes(channel.id)}
                      onCheckedChange={() => toggleChannel(channel.id)}
                    />
                    <label
                      htmlFor={`channel-${channel.id}`}
                      className="text-sm text-[var(--text-high)] cursor-pointer flex-1"
                    >
                      #{channel.name}
                    </label>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            // Expanded by default when no channels selected
            <div className="grid grid-cols-2 gap-2">
              {availableChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center space-x-2 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors"
                >
                  <Checkbox
                    id={`channel-${channel.id}`}
                    checked={selectedChannels.includes(channel.id)}
                    onCheckedChange={() => toggleChannel(channel.id)}
                  />
                  <label
                    htmlFor={`channel-${channel.id}`}
                    className="text-sm text-[var(--text-high)] cursor-pointer flex-1"
                  >
                    #{channel.name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Challenges - Always collapsible */}
        {challenges.length > 0 && (
          <div>
            <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-3 block">
              Challenges (Optional)
            </Label>
            {/* Always show as collapsible summary */}
            <details className="group">
              <summary className="cursor-pointer flex items-center justify-between p-2 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors">
                <span className="text-xs text-[var(--text-high)]">
                  {selectedChallenges.length > 0
                    ? `${selectedChallenges.length} challenge${selectedChallenges.length !== 1 ? "s" : ""} selected`
                    : "No challenges selected"}
                </span>
                <svg
                  className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="space-y-2 mt-2">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="flex items-center space-x-3 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors"
                  >
                    <Checkbox
                      id={`challenge-${challenge.id}`}
                      checked={selectedChallenges.includes(challenge.id)}
                      onCheckedChange={() => toggleChallenge(challenge.id)}
                    />
                    <label
                      htmlFor={`challenge-${challenge.id}`}
                      className="text-sm text-[var(--text-high)] cursor-pointer flex items-center gap-2 flex-1"
                    >
                      {challenge.name}
                      {challenge.scope === "honeydrip-wide" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide">
                          HD
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Discord Preview - Collapsible */}
        <div>
          <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-2 block">
            Discord Message Preview
          </Label>
          <details className="group">
            <summary className="cursor-pointer flex items-center justify-between p-2 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors">
              <span className="text-xs text-[var(--text-high)]">Click to preview message</span>
              <svg
                className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="mt-2 p-4 rounded-[var(--radius)] bg-[var(--bg-base)] border border-[var(--border-hairline)] font-mono text-xs leading-relaxed">
              <pre className="text-[var(--text-high)] whitespace-pre-wrap overflow-x-auto">
                {getPreviewMessage()}
              </pre>
            </div>
          </details>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 lg:p-6 border-t border-[var(--border-hairline)] space-y-2 flex-shrink-0">
        {/* Validation Errors Display */}
        {validationErrors.length > 0 &&
          !validationErrors.every((e) => e.includes("Discord channel")) && (
            <div className="p-3 rounded-[var(--radius)] bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/30 text-sm">
              <p className="text-[var(--accent-negative)] font-medium mb-1">
                Please fix the following:
              </p>
              <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                {validationErrors
                  .filter((e) => !e.includes("Discord channel"))
                  .map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
              </ul>
            </div>
          )}

        {/* For 'enter' alerts: Show Enter Trade (green), Unload (yellow), Cancel (red) */}
        {alertType === "enter" ? (
          <>
            {/* Enter Trade button - green (positive), calls onEnterAndAlert */}
            {onEnterAndAlert && (
              <button
                onClick={() => {
                  console.log("🔴 ENTER TRADE BUTTON CLICKED!");
                  console.log("📋 Selected channels:", selectedChannels);
                  console.log("📋 Selected challenges:", selectedChallenges);
                  console.log("📋 Comment:", comment);
                  console.log("📋 Price overrides:", {
                    entryPrice,
                    currentPrice,
                    targetPrice,
                    stopLoss,
                  });
                  persistChannelSelection();
                  onEnterAndAlert(
                    selectedChannels,
                    selectedChallenges,
                    comment.trim() || undefined,
                    { entryPrice, currentPrice, targetPrice, stopLoss }
                  );
                }}
                disabled={!canSend || selectedChannels.length === 0}
                className="w-full py-3 rounded-[var(--radius)] bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
              >
                Enter Trade
              </button>
            )}
            {/* Unload button - yellow (brand primary), removes trade from loaded list */}
            {onUnload && (
              <button
                onClick={onUnload}
                className="w-full py-3 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90 transition-colors font-medium flex items-center justify-center"
              >
                Unload Trade
              </button>
            )}
            {/* Cancel button - red (negative), goes back to Watch tab */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-[var(--radius)] bg-[var(--accent-negative)] text-white hover:bg-[var(--accent-negative)]/90 transition-colors font-medium flex items-center justify-center"
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <>
            {/* Default Send Alert button for other alert types */}
            <button
              onClick={() => {
                console.log("📤 SEND ALERT BUTTON CLICKED!");
                console.log("📋 Price overrides:", {
                  entryPrice,
                  currentPrice,
                  targetPrice,
                  stopLoss,
                  includeGainsImage: showGainsImage,
                });
                persistChannelSelection();
                onSend(selectedChannels, selectedChallenges, comment.trim() || undefined, {
                  entryPrice,
                  currentPrice,
                  targetPrice,
                  stopLoss,
                  includeGainsImage: alertType === "exit" ? showGainsImage : undefined,
                });
              }}
              disabled={!canSend || selectedChannels.length === 0}
              className="w-full py-3 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
            >
              {alertType === "load" ? "Load and Alert" : "Send Alert"}
            </button>
            {/* Show "Enter and Alert" only for load alerts */}
            {alertType === "load" && onEnterAndAlert && (
              <button
                onClick={() => {
                  console.log("🔴 ENTER AND ALERT BUTTON CLICKED!");
                  console.log("📋 Selected channels:", selectedChannels);
                  console.log("📋 Selected challenges:", selectedChallenges);
                  console.log("📋 Comment:", comment);
                  console.log("📋 Price overrides:", {
                    entryPrice,
                    currentPrice,
                    targetPrice,
                    stopLoss,
                  });
                  persistChannelSelection();
                  onEnterAndAlert(
                    selectedChannels,
                    selectedChallenges,
                    comment.trim() || undefined,
                    { entryPrice, currentPrice, targetPrice, stopLoss }
                  );
                  console.log("✅ onEnterAndAlert() called");
                }}
                disabled={!canSend || selectedChannels.length === 0}
                className="w-full py-3 rounded-[var(--radius)] bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
              >
                Enter and Alert
              </button>
            )}
            {/* For other alert types: Show Discard if onCancel exists */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium flex items-center justify-center"
              >
                Discard
              </button>
            )}
          </>
        )}
      </div>

      {/* Calculator Modal */}
      <HDCalculatorModal
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        onConfirm={handlePriceUpdate}
        initialValue={getCalculatorValue()}
        title={getCalculatorTitle()}
        label="Price"
      />
    </div>
  );
}
