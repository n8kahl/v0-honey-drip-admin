import { useState } from "react";
import { Trade, DiscordChannel, Challenge } from "../types";
import { HDInput } from "./hd/common/HDInput";
import { cn } from "../lib/utils";
import { getShareText, getSummaryText } from "../lib/utils/discord";
import { Search, Download, ChevronDown, History, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { HDTradeRowExpanded } from "./hd/cards/HDTradeRowExpanded";
import { EmptyState } from "./ui/EmptyState";
import { useAppToast } from "../hooks/useAppToast";
import { useDiscord } from "../hooks/useDiscord";
import { useAuth } from "../contexts/AuthContext";
import { useTradeStore } from "../stores";
import { updateTradeApi, linkChallengesApi, unlinkChallengeApi } from "../lib/api/tradeApi";
import { MobileWatermark } from "./MobileWatermark";

interface DesktopHistoryProps {
  trades: Trade[];
  channels?: DiscordChannel[];
  challenges?: Challenge[];
}

type DateRangeFilter = "all" | "today" | "7d" | "30d";

export function DesktopHistory({ trades, channels = [], challenges = [] }: DesktopHistoryProps) {
  const toast = useAppToast();
  const discord = useDiscord();
  const { user } = useAuth();
  const { updateTrade } = useTradeStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tickerFilter, setTickerFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("all"); // Default to all time to show all exited trades
  const [challengeFilter, setChallengeFilter] = useState<string>("all");
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(false); // Collapsed by default

  // For export/share dialog
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMode, setAlertMode] = useState<"export" | "share">("export");
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // For expandable rows
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  // Handler for editing trade entry/exit price with P&L recalculation
  const handleEditTradePrice = async (
    tradeId: string,
    field: "entryPrice" | "exitPrice",
    newPrice: number
  ) => {
    if (!user?.id) {
      toast.error("Not authenticated");
      throw new Error("Not authenticated");
    }

    // Find the trade to get current prices
    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) {
      toast.error("Trade not found");
      throw new Error("Trade not found");
    }

    // Calculate new entry/exit prices
    const entryPrice = field === "entryPrice" ? newPrice : trade.entryPrice || 0;
    const exitPrice = field === "exitPrice" ? newPrice : trade.exitPrice || 0;

    // Recalculate P&L
    const movePercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;

    try {
      // Update via API
      await updateTradeApi(user.id, tradeId, {
        entry_price: entryPrice,
        exit_price: exitPrice,
        move_percent: movePercent,
      });

      // Update local store
      await updateTrade(tradeId, {
        entryPrice,
        exitPrice,
        movePercent,
      });

      toast.success(`${field === "entryPrice" ? "Entry" : "Exit"} price updated`);
    } catch (error) {
      console.error("[DesktopHistory] Failed to update trade price:", error);
      toast.error("Failed to update price");
      throw error;
    }
  };

  // Handler for linking a challenge to a trade
  const handleLinkChallenge = async (tradeId: string, challengeId: string) => {
    if (!user?.id) {
      toast.error("Not authenticated");
      throw new Error("Not authenticated");
    }

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) {
      toast.error("Trade not found");
      throw new Error("Trade not found");
    }

    try {
      // Link via API
      await linkChallengesApi(user.id, tradeId, [challengeId]);

      // Update local store
      await updateTrade(tradeId, {
        challenges: [...trade.challenges, challengeId],
      });

      toast.success("Challenge linked");
    } catch (error) {
      console.error("[DesktopHistory] Failed to link challenge:", error);
      toast.error("Failed to link challenge");
      throw error;
    }
  };

  // Handler for unlinking a challenge from a trade
  const handleUnlinkChallenge = async (tradeId: string, challengeId: string) => {
    if (!user?.id) {
      toast.error("Not authenticated");
      throw new Error("Not authenticated");
    }

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) {
      toast.error("Trade not found");
      throw new Error("Trade not found");
    }

    try {
      // Unlink via API
      await unlinkChallengeApi(user.id, tradeId, challengeId);

      // Update local store
      await updateTrade(tradeId, {
        challenges: trade.challenges.filter((c) => c !== challengeId),
      });

      toast.success("Challenge unlinked");
    } catch (error) {
      console.error("[DesktopHistory] Failed to unlink challenge:", error);
      toast.error("Failed to unlink challenge");
      throw error;
    }
  };

  // Filter logic
  const filtered = trades
    .filter((trade) => {
      // Search term
      const matchesSearch = trade.ticker.toLowerCase().includes(searchTerm.toLowerCase());

      // Type filter
      const matchesType = typeFilter === "all" || trade.tradeType === typeFilter;

      // Ticker filter
      const matchesTicker =
        !tickerFilter.trim() || trade.ticker.toUpperCase() === tickerFilter.trim().toUpperCase();

      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter !== "all" && trade.exitTime) {
        const now = new Date();
        const exitDate = new Date(trade.exitTime);
        const daysDiff = Math.floor((now.getTime() - exitDate.getTime()) / (1000 * 60 * 60 * 24));

        if (dateRangeFilter === "today") {
          matchesDateRange = exitDate.toDateString() === now.toDateString();
        } else if (dateRangeFilter === "7d") {
          matchesDateRange = daysDiff <= 7;
        } else if (dateRangeFilter === "30d") {
          matchesDateRange = daysDiff <= 30;
        }
      }

      // Challenge filter
      const matchesChallenge =
        challengeFilter === "all" || trade.challenges.includes(challengeFilter);

      return matchesSearch && matchesType && matchesTicker && matchesDateRange && matchesChallenge;
    })
    .sort((a, b) => {
      // Sort by exitTime descending (most recent first)
      const timeA = a.exitTime ? new Date(a.exitTime).getTime() : 0;
      const timeB = b.exitTime ? new Date(b.exitTime).getTime() : 0;
      return timeB - timeA;
    });

  // Calculate summary text for export using shared utility
  const getFormattedSummary = () => {
    const challengeName =
      challengeFilter === "all"
        ? "All Challenges"
        : challenges.find((c) => c.id === challengeFilter)?.name || "Challenge";

    const dateRangeLabel = {
      all: "All Time",
      today: "Today",
      "7d": "Last 7 Days",
      "30d": "Last 30 Days",
    }[dateRangeFilter];

    const tickerLabel = tickerFilter.trim() ? tickerFilter.toUpperCase() : "All Tickers";

    return getSummaryText(filtered, {
      challengeName,
      dateRangeLabel,
      tickerLabel,
    });
  };

  const handleExportClick = () => {
    setAlertMode("export");
    setSelectedTrade(null);
    setShowAlertDialog(true);
  };

  const handleShareClick = (trade: Trade) => {
    setAlertMode("share");
    setSelectedTrade(trade);
    setShowAlertDialog(true);
  };

  const handleSendAlert = async (
    channelIds: string[],
    challengeIds: string[],
    comment?: string
  ) => {
    const selectedChannels = channels.filter((c) => channelIds.includes(c.id));

    if (selectedChannels.length === 0) {
      toast.error("Please select at least one Discord channel");
      return;
    }

    try {
      if (alertMode === "share" && selectedTrade) {
        // Send individual trade share
        const results = await discord.sendExitAlert(selectedChannels, selectedTrade, comment);
        if (results.failed === 0) {
          toast.success(`Shared to ${results.success} channel${results.success > 1 ? "s" : ""}`);
        } else {
          toast.error(`Sent to ${results.success}, failed ${results.failed}`);
        }
      } else {
        // Send summary export
        const summaryText = getFormattedSummary();
        const title = "Trade Summary";
        const results = await discord.sendSummaryAlert(
          selectedChannels,
          title,
          summaryText,
          comment
        );
        if (results.failed === 0) {
          toast.success(
            `Summary sent to ${results.success} channel${results.success > 1 ? "s" : ""}`
          );
        } else {
          toast.error(`Sent to ${results.success}, failed ${results.failed}`);
        }
      }
      setShowAlertDialog(false);
    } catch (error) {
      console.error("[DesktopHistory] Failed to send Discord alert:", error);
      toast.error("Failed to send Discord alert");
    }
  };

  // Create a mock trade for export summary
  const getMockTradeForExport = (): Trade => {
    return {
      id: "summary-export",
      ticker: "SUMMARY",
      contract: {
        id: "summary",
        strike: 0,
        expiry: "",
        expiryDate: new Date(),
        daysToExpiry: 0,
        type: "C",
        mid: 0,
        bid: 0,
        ask: 0,
        volume: 0,
        openInterest: 0,
      },
      tradeType: "Day",
      state: "EXITED",
      updates: [],
      discordChannels: [],
      challenges: challengeFilter !== "all" ? [challengeFilter] : [],
    };
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4 lg:p-6 overflow-y-auto bg-[var(--bg-base)] relative">
      {/* Watermark - visible on all screens */}
      <MobileWatermark />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Title Row with Export */}
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h1 className="text-[var(--text-high)]">Trade History</h1>

          {/* Export Icon Button */}
          <button
            onClick={handleExportClick}
            disabled={filtered.length === 0}
            className={cn(
              "w-9 h-9 rounded-[var(--radius)] flex items-center justify-center transition-colors",
              filtered.length === 0
                ? "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)] cursor-not-allowed"
                : "bg-[var(--brand-primary)] text-[var(--bg-base)] hover:opacity-90"
            )}
            title="Export to Discord"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Top Controls Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <HDInput
              placeholder="Search by ticker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Additional Filters Toggle */}
          <button
            onClick={() => setShowAdditionalFilters(!showAdditionalFilters)}
            className={cn(
              "px-4 h-9 rounded-[var(--radius)] text-sm transition-colors flex items-center gap-2 whitespace-nowrap",
              "bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]"
            )}
          >
            Additional Filters
            <ChevronDown
              className={cn("w-4 h-4 transition-transform", showAdditionalFilters && "rotate-180")}
            />
          </button>
        </div>

        {/* Collapsible Additional Filters */}
        {showAdditionalFilters && (
          <div className="space-y-4 mb-6 p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
            {/* Type Filter Chips */}
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-2">Trade Type</label>
              <div className="flex gap-2 flex-wrap">
                {["all", "Scalp", "Day", "Swing", "LEAP"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      "px-4 h-9 rounded-[var(--radius)] text-sm transition-colors whitespace-nowrap",
                      typeFilter === type
                        ? "bg-[var(--brand-primary)] text-[var(--bg-base)]"
                        : "bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--border-hairline)] hover:text-[var(--text-high)]"
                    )}
                  >
                    {type === "all" ? "All Types" : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range and Challenge in a row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date range filter */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-2">Date Range</label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
                  className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>

              {/* Challenge filter */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-2">Challenge</label>
                <select
                  value={challengeFilter}
                  onChange={(e) => setChallengeFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                >
                  <option value="all">All Challenges</option>
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] overflow-hidden">
          {/* Horizontal scroll wrapper for mobile */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-[auto_1fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] text-xs text-[var(--text-muted)] uppercase tracking-wide">
                <div></div>
                <div>Ticker</div>
                <div>Contract</div>
                <div>Type</div>
                <div>Entry</div>
                <div>Exit</div>
                <div>P&L %</div>
                <div>Date</div>
                <div>Time</div>
              </div>

              {/* Rows */}
              <div>
                {filtered.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={History}
                      title="No trades found"
                      description="Your closed trades will appear here once you complete your first trade."
                      minHeight="min-h-64"
                    />
                  </div>
                ) : (
                  filtered.map((trade) => (
                    <HDTradeRowExpanded
                      key={trade.id}
                      trade={trade}
                      challenges={challenges}
                      isExpanded={expandedTradeId === trade.id}
                      onToggleExpand={() =>
                        setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)
                      }
                      onShare={handleShareClick}
                      onEditTradePrice={handleEditTradePrice}
                      onLinkChallenge={handleLinkChallenge}
                      onUnlinkChallenge={handleUnlinkChallenge}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-[var(--surface-1)] border-[var(--border-hairline)] border-t-2 border-t-[var(--brand-primary)] max-h-[90vh] !flex flex-col">
          <DialogTitle className="sr-only">
            {alertMode === "export" ? "Export Trade Summary" : "Share Trade"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {alertMode === "export"
              ? "Export your trade summary to Discord channels"
              : "Share this trade result to Discord channels"}
          </DialogDescription>
          {/* TODO: Replace with new HDAlertComposerPopover or custom export panel */}
          <div className="flex-1 min-h-0 flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-high)]">
                {alertMode === "export" ? "Export Summary" : "Share Trade"}
              </h3>
              <button
                onClick={() => setShowAlertDialog(false)}
                className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
                <p className="text-sm font-mono whitespace-pre-wrap text-[var(--text-high)]">
                  {alertMode === "export"
                    ? getFormattedSummary()
                    : selectedTrade
                      ? getShareText(selectedTrade)
                      : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  const text =
                    alertMode === "export"
                      ? getFormattedSummary()
                      : selectedTrade
                        ? getShareText(selectedTrade)
                        : "";
                  navigator.clipboard.writeText(text);
                  toast.success("Copied to clipboard");
                }}
                className="flex-1 py-2 px-4 rounded-lg bg-[var(--surface-3)] text-[var(--text-high)] hover:bg-[var(--surface-3)]/80 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowAlertDialog(false)}
                className="py-2 px-4 rounded-lg bg-[var(--brand-primary)] text-black hover:opacity-90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
