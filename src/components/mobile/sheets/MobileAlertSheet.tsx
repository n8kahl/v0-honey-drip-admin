import { useState, useEffect, useMemo } from "react";
import { Drawer } from "vaul";
import { Trade, AlertType, DiscordChannel, Challenge } from "../../../types";
import { cn } from "../../../lib/utils";
import { Check, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { formatDiscordAlert } from "../../../lib/discordFormatter";

interface MobileAlertSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" };
  channels: DiscordChannel[];
  challenges: Challenge[];
  onSend: (
    channels: string[],
    challenges: string[],
    comment?: string,
    priceOverrides?: {
      entryPrice?: number;
      currentPrice?: number;
      targetPrice?: number;
      stopLoss?: number;
    }
  ) => void;
}

export function MobileAlertSheet({
  open,
  onOpenChange,
  trade,
  alertType,
  alertOptions,
  channels,
  challenges,
  onSend,
}: MobileAlertSheetProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [showChannels, setShowChannels] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);

  // Field toggles for alert customization (matching desktop)
  const [showEntry, setShowEntry] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [showStopLoss, setShowStopLoss] = useState(false);
  const [showPnL, setShowPnL] = useState(false);

  // Price overrides (matching desktop pattern)
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<number>(0);

  // Inline price editing
  const [editingField, setEditingField] = useState<"entry" | "current" | "target" | "stop" | null>(
    null
  );
  const [tempValue, setTempValue] = useState("");

  const formatPrice = (price: number) => price.toFixed(2);

  const startEdit = (field: "entry" | "current" | "target" | "stop") => {
    setEditingField(field);
    const value =
      field === "entry"
        ? entryPrice
        : field === "current"
          ? currentPrice
          : field === "target"
            ? targetPrice
            : stopLoss;
    setTempValue(value.toFixed(2));
  };

  const saveEdit = () => {
    const value = parseFloat(tempValue);
    if (!isNaN(value) && value >= 0) {
      if (editingField === "entry") setEntryPrice(value);
      else if (editingField === "current") setCurrentPrice(value);
      else if (editingField === "target") setTargetPrice(value);
      else if (editingField === "stop") setStopLoss(value);
    }
    setEditingField(null);
  };

  const adjustPrice = (field: "entry" | "current" | "target" | "stop", delta: number) => {
    const step = 0.05;
    if (field === "entry") setEntryPrice(Math.max(0, entryPrice + delta * step));
    else if (field === "current") setCurrentPrice(Math.max(0, currentPrice + delta * step));
    else if (field === "target") setTargetPrice(Math.max(0, targetPrice + delta * step));
    else if (field === "stop") setStopLoss(Math.max(0, stopLoss + delta * step));
  };

  // Get alert title with emoji (matching desktop)
  const getAlertTitle = () => {
    switch (alertType) {
      case "load":
        return "LOADED";
      case "enter":
        return "ENTERED";
      case "add":
        return "ADDED";
      case "exit":
        return "EXITED";
      case "update":
        if (alertOptions?.updateKind === "trim") return "TRIM";
        if (alertOptions?.updateKind === "sl") return "STOP LOSS UPDATE";
        return "UPDATE";
      case "trail_stop":
        return "TRAIL STOP";
      default:
        return "ALERT";
    }
  };

  const getAlertEmoji = () => {
    switch (alertType) {
      case "load":
        return "\u{1F4CB}"; // clipboard
      case "enter":
        return "\u{1F3AF}"; // target
      case "add":
        return "\u{2795}"; // plus
      case "exit":
        return "\u{1F3C1}"; // checkered flag
      case "update":
        return "\u{1F4CA}"; // chart
      case "trail_stop":
        return "\u{1F3C3}"; // runner
      default:
        return "\u{1F514}"; // bell
    }
  };

  // Initialize state when sheet opens (matching desktop defaults)
  useEffect(() => {
    if (open && trade) {
      // Initialize price overrides from trade
      setEntryPrice(trade.entryPrice || trade.contract?.mid || 0);
      setCurrentPrice(trade.currentPrice || trade.contract?.mid || 0);
      setTargetPrice(trade.targetPrice || trade.contract?.mid * 1.5 || 0);
      setStopLoss(trade.stopLoss || trade.contract?.mid * 0.5 || 0);

      // Initialize channels from trade or defaults
      const tradeChannels = Array.isArray(trade.discordChannels) ? trade.discordChannels : [];
      if (tradeChannels.length > 0) {
        setSelectedChannels(tradeChannels);
      } else {
        const defaultChannel = channels.find((c) => c.isGlobalDefault);
        setSelectedChannels(defaultChannel ? [defaultChannel.id] : []);
      }

      // Initialize challenges from trade
      const tradeChallenges = Array.isArray(trade.challenges) ? trade.challenges : [];
      setSelectedChallenges(tradeChallenges);

      // Set default comment based on alert type (matching desktop)
      let defaultComment = "";
      if (alertType === "update" && alertOptions?.updateKind === "trim") {
        defaultComment = "Trimming here to lock profit.";
      } else if (alertType === "update" && alertOptions?.updateKind === "sl") {
        defaultComment = "Updating stop loss.";
      } else if (alertType === "update" && alertOptions?.updateKind === "generic") {
        defaultComment = "Quick update on this position.";
      } else if (alertType === "trail_stop") {
        defaultComment = "Enabling trailing stop on this position.";
      } else if (alertType === "add") {
        defaultComment = "Adding to position here.";
      } else if (alertType === "exit") {
        defaultComment = "Exiting position here.";
      }
      setComment(defaultComment);

      // Set default field visibility based on alert type (matching desktop exactly)
      if (alertType === "enter") {
        setShowEntry(true);
        setShowCurrent(true);
        setShowTarget(true);
        setShowStopLoss(true);
        setShowPnL(false);
      } else if (alertType === "update" && alertOptions?.updateKind === "trim") {
        setShowEntry(false);
        setShowCurrent(true);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(true);
      } else if (alertType === "update" && alertOptions?.updateKind === "sl") {
        setShowEntry(false);
        setShowCurrent(false);
        setShowTarget(false);
        setShowStopLoss(true);
        setShowPnL(false);
      } else if (alertType === "update" && alertOptions?.updateKind === "generic") {
        setShowEntry(false);
        setShowCurrent(true);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(false);
      } else if (alertType === "trail_stop") {
        setShowEntry(false);
        setShowCurrent(false);
        setShowTarget(false);
        setShowStopLoss(true);
        setShowPnL(false);
      } else if (alertType === "add") {
        setShowEntry(false);
        setShowCurrent(true);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(true);
      } else if (alertType === "exit") {
        setShowEntry(false);
        setShowCurrent(true);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(true);
      } else if (alertType === "load") {
        setShowEntry(false);
        setShowCurrent(false);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(false);
      }
    }
  }, [open, trade, channels, alertType, alertOptions]);

  // Generate alert message using canonical formatter (desktop pattern)
  const getAlertMessage = useMemo(() => {
    if (!trade) return "";

    // Build trade object with price overrides for preview
    const previewTrade =
      alertType === "load" || alertType === "enter"
        ? {
            ...trade,
            entryPrice,
            currentPrice,
            targetPrice,
            stopLoss,
          }
        : trade;

    // Build options object from toggle state
    return formatDiscordAlert(previewTrade, alertType, {
      updateKind: alertOptions?.updateKind,
      includeEntry: showEntry,
      includeCurrent: showCurrent,
      includeTarget: showTarget,
      includeStopLoss: showStopLoss,
      includePnL: showPnL,
      comment: comment.trim() || undefined,
      includeDTE: true, // Desktop includes DTE
      dte: trade.contract?.daysToExpiry,
      includeSetupType: !!trade.setupType,
      setupType: trade.setupType,
      // Include confluence if available
      includeConfluence: !!trade.confluence,
      confluenceData: trade.confluence
        ? {
            overallScore: trade.confluence.overall,
            subscores: trade.confluence.subscores,
            components: trade.confluence.components,
            highlights: trade.confluence.highlights,
          }
        : undefined,
    });
  }, [
    trade,
    alertType,
    alertOptions,
    comment,
    showEntry,
    showCurrent,
    showTarget,
    showStopLoss,
    showPnL,
    entryPrice,
    currentPrice,
    targetPrice,
    stopLoss,
  ]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challengeId) ? prev.filter((id) => id !== challengeId) : [...prev, challengeId]
    );
  };

  const handleSend = () => {
    // For load/enter alerts, pass price overrides
    const priceOverrides =
      alertType === "load" || alertType === "enter"
        ? {
            entryPrice,
            currentPrice,
            targetPrice,
            stopLoss,
          }
        : undefined;
    onSend(selectedChannels, selectedChallenges, comment.trim() || undefined, priceOverrides);
  };

  if (!trade) return null;

  const buttonLabel = alertType === "load" ? "Load and Alert" : "Send Alert";

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-base)] rounded-t-2xl max-h-[90vh]">
          <div className="mx-auto w-12 h-1.5 bg-[var(--border-hairline)] rounded-full my-3" />

          <div className="px-4 pb-safe overflow-y-auto max-h-[calc(90vh-24px)]">
            {/* Header */}
            <div className="border-b border-[var(--border-hairline)] pb-3 mb-4">
              <h2 className="text-[var(--text-high)] text-xs uppercase tracking-wide text-center">
                Alert Preview
              </h2>
            </div>

            {/* Editable Price Strip (for enter/load alerts) */}
            {(alertType === "load" || alertType === "enter") && (
              <div className="mb-4">
                <label className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-2">
                  Prices (Tap to Edit)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Entry Price */}
                  <div className="p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--text-muted)] uppercase mb-1">Entry</div>
                    {editingField === "entry" ? (
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingField(null);
                        }}
                        autoFocus
                        className="w-full text-sm font-mono bg-transparent border-b border-[var(--brand-primary)] text-[var(--text-high)] text-center outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => adjustPrice("entry", -1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => startEdit("entry")}
                          className="text-sm font-mono text-[var(--text-high)]"
                        >
                          ${formatPrice(entryPrice)}
                        </button>
                        <button
                          onClick={() => adjustPrice("entry", 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Current Price */}
                  <div className="p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--text-muted)] uppercase mb-1">
                      Current
                    </div>
                    {editingField === "current" ? (
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingField(null);
                        }}
                        autoFocus
                        className="w-full text-sm font-mono bg-transparent border-b border-[var(--brand-primary)] text-[var(--text-high)] text-center outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => adjustPrice("current", -1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => startEdit("current")}
                          className="text-sm font-mono text-[var(--text-high)]"
                        >
                          ${formatPrice(currentPrice)}
                        </button>
                        <button
                          onClick={() => adjustPrice("current", 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-high)]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Target Price */}
                  <div className="p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--accent-positive)] uppercase mb-1">
                      Target
                    </div>
                    {editingField === "target" ? (
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingField(null);
                        }}
                        autoFocus
                        className="w-full text-sm font-mono bg-transparent border-b border-[var(--accent-positive)] text-[var(--accent-positive)] text-center outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => adjustPrice("target", -1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-positive)]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => startEdit("target")}
                          className="text-sm font-mono text-[var(--accent-positive)]"
                        >
                          ${formatPrice(targetPrice)}
                        </button>
                        <button
                          onClick={() => adjustPrice("target", 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-positive)]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stop Loss */}
                  <div className="p-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--accent-negative)] uppercase mb-1">
                      Stop
                    </div>
                    {editingField === "stop" ? (
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingField(null);
                        }}
                        autoFocus
                        className="w-full text-sm font-mono bg-transparent border-b border-[var(--accent-negative)] text-[var(--accent-negative)] text-center outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => adjustPrice("stop", -1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-negative)]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => startEdit("stop")}
                          className="text-sm font-mono text-[var(--accent-negative)]"
                        >
                          ${formatPrice(stopLoss)}
                        </button>
                        <button
                          onClick={() => adjustPrice("stop", 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-negative)]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alert Preview Box (matching desktop) */}
            <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4 mb-4">
              <div className="text-[var(--brand-primary)] text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span>{getAlertEmoji()}</span>
                <span>{getAlertTitle()}</span>
              </div>
              <div className="text-[var(--text-high)] text-sm whitespace-pre-line font-mono">
                {getAlertMessage}
              </div>
            </div>

            {/* Field Toggles (only show for non-load alerts) */}
            {alertType !== "load" && (
              <div className="mb-4">
                <label className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-2">
                  Include Fields
                </label>
                <div className="flex flex-wrap gap-2">
                  {(alertType === "enter" || alertType === "add") && (
                    <button
                      onClick={() => setShowEntry(!showEntry)}
                      className={cn(
                        "px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors",
                        showEntry
                          ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
                          : "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-muted)]"
                      )}
                    >
                      Entry
                    </button>
                  )}
                  <button
                    onClick={() => setShowCurrent(!showCurrent)}
                    className={cn(
                      "px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors",
                      showCurrent
                        ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
                        : "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-muted)]"
                    )}
                  >
                    Current
                  </button>
                  {(alertType === "enter" || alertType === "add") && (
                    <button
                      onClick={() => setShowTarget(!showTarget)}
                      className={cn(
                        "px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors",
                        showTarget
                          ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
                          : "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-muted)]"
                      )}
                    >
                      Target
                    </button>
                  )}
                  <button
                    onClick={() => setShowStopLoss(!showStopLoss)}
                    className={cn(
                      "px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors",
                      showStopLoss
                        ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
                        : "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-muted)]"
                    )}
                  >
                    Stop Loss
                  </button>
                  <button
                    onClick={() => setShowPnL(!showPnL)}
                    className={cn(
                      "px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors",
                      showPnL
                        ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
                        : "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-muted)]"
                    )}
                  >
                    P&L
                  </button>
                </div>
              </div>
            )}

            {/* Discord Channels */}
            <div className="mb-4">
              <button
                onClick={() => setShowChannels(!showChannels)}
                className="w-full flex items-center justify-between py-2"
              >
                <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">
                  Discord Channels
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-med)] text-xs">
                    {selectedChannels.length > 0 ? `${selectedChannels.length} selected` : "None"}
                  </span>
                  {showChannels ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </div>
              </button>

              {showChannels && (
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                  {channels.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-sm p-3">No channels configured</p>
                  ) : (
                    channels.map((channel) => (
                      <button
                        key={channel.id}
                        data-testid="channel-chip"
                        data-selected={selectedChannels.includes(channel.id)}
                        onClick={() => toggleChannel(channel.id)}
                        className="w-full flex items-center justify-between p-3"
                      >
                        <span className="text-sm text-[var(--text-high)]">#{channel.name}</span>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-[var(--radius)] border flex items-center justify-center transition-colors",
                            selectedChannels.includes(channel.id)
                              ? "bg-[var(--brand-primary)] border-[var(--brand-primary)]"
                              : "bg-transparent border-[var(--border-hairline)]"
                          )}
                        >
                          {selectedChannels.includes(channel.id) && (
                            <Check className="w-3 h-3 text-black" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Challenges */}
            <div className="mb-4">
              <button
                onClick={() => setShowChallenges(!showChallenges)}
                className="w-full flex items-center justify-between py-2"
              >
                <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">
                  Challenges
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-med)] text-xs">
                    {selectedChallenges.length > 0
                      ? `${selectedChallenges.length} selected`
                      : "None"}
                  </span>
                  {showChallenges ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </div>
              </button>

              {showChallenges && (
                <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                  {challenges.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-sm p-3">No active challenges</p>
                  ) : (
                    challenges.map((challenge) => (
                      <button
                        key={challenge.id}
                        onClick={() => toggleChallenge(challenge.id)}
                        className="w-full flex items-center justify-between p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[var(--text-high)]">{challenge.name}</span>
                          {challenge.scope === "honeydrip-wide" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-[var(--radius)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide font-medium">
                              HD
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-[var(--radius)] border flex items-center justify-center transition-colors",
                            selectedChallenges.includes(challenge.id)
                              ? "bg-[var(--brand-primary)] border-[var(--brand-primary)]"
                              : "bg-transparent border-[var(--border-hairline)]"
                          )}
                        >
                          {selectedChallenges.includes(challenge.id) && (
                            <Check className="w-3 h-3 text-black" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wide block mb-2">
                Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add additional context..."
                className="w-full px-3 py-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm resize-none min-h-[80px] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/50"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pb-4">
              <button
                onClick={handleSend}
                disabled={selectedChannels.length === 0}
                className={cn(
                  "w-full py-3.5 rounded-[var(--radius)] font-medium text-sm transition-colors min-h-[48px]",
                  selectedChannels.length > 0
                    ? "bg-[var(--brand-primary)] text-black"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                {buttonLabel}
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="w-full py-3 text-[var(--text-muted)] text-sm"
              >
                Cancel
              </button>
            </div>

            <div className="h-4" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
