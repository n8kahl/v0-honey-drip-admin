/**
 * Member Dashboard Page
 *
 * Shows members:
 * - Open trade threads they can subscribe to ("I Took This Trade")
 * - Their active trades with live P/L
 * - Completed trades (journal)
 */

import { useEffect, useState } from "react";
import { useTradeThreadStore } from "../stores/tradeThreadStore";
import { ITookThisSheet } from "../components/member/ITookThisSheet";
import { MemberExitSheet } from "../components/member/MemberExitSheet";
import { TradeTimeline } from "../components/member/TradeTimeline";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertTriangle,
  BookOpen,
  Zap,
  RefreshCw,
} from "lucide-react";
import type { TradeThread, MemberTrade } from "../types/tradeThreads";
import { calculatePnlPercent } from "../types/tradeThreads";

export function MemberDashboard() {
  const {
    openThreads,
    myTrades,
    journalTrades,
    isLoading,
    loadOpenThreads,
    loadMyTrades,
    loadJournalTrades,
    startPolling,
    stopPolling,
  } = useTradeThreadStore();

  const [selectedThread, setSelectedThread] = useState<TradeThread | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<MemberTrade | null>(null);
  const [showSubscribeSheet, setShowSubscribeSheet] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [showTimelineSheet, setShowTimelineSheet] = useState(false);
  const [activeTab, setActiveTab] = useState("available");

  // Load data on mount and start polling
  useEffect(() => {
    loadOpenThreads();
    loadMyTrades();
    loadJournalTrades();
    startPolling(30000); // Poll every 30 seconds

    return () => {
      stopPolling();
    };
  }, [loadOpenThreads, loadMyTrades, loadJournalTrades, startPolling, stopPolling]);

  // Filter threads the user hasn't subscribed to yet
  const availableThreads = openThreads.filter(
    (thread) => !myTrades.some((mt) => mt.tradeThreadId === thread.id)
  );

  // Active trades (subscribed and not exited)
  const activeTrades = myTrades.filter((mt) => mt.status === "active");

  const handleSubscribe = (thread: TradeThread) => {
    setSelectedThread(thread);
    setShowSubscribeSheet(true);
  };

  const handleExit = (trade: MemberTrade) => {
    setSelectedTrade(trade);
    setShowExitSheet(true);
  };

  const handleViewTimeline = (trade: MemberTrade) => {
    // Find the associated thread
    const thread = openThreads.find((t) => t.id === trade.tradeThreadId);
    if (thread) {
      setSelectedThread(thread);
      setSelectedTrade(trade);
      setShowTimelineSheet(true);
    }
  };

  const handleRefresh = () => {
    loadOpenThreads();
    loadMyTrades();
    loadJournalTrades();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Trades</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Track your trade subscriptions and performance
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--brand-primary)]" />
              <span className="text-sm">
                <span className="font-semibold">{availableThreads.length}</span>{" "}
                <span className="text-[var(--text-muted)]">available</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">
                <span className="font-semibold">{activeTrades.length}</span>{" "}
                <span className="text-[var(--text-muted)]">active</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                <span className="font-semibold">{journalTrades.length}</span>{" "}
                <span className="text-[var(--text-muted)]">completed</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="available">
              Available Trades ({availableThreads.length})
            </TabsTrigger>
            <TabsTrigger value="active">My Active ({activeTrades.length})</TabsTrigger>
            <TabsTrigger value="journal">Journal ({journalTrades.length})</TabsTrigger>
          </TabsList>

          {/* Available Trades Tab */}
          <TabsContent value="available">
            {availableThreads.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-12 w-12" />}
                title="No trades available"
                description="Check back soon for new trade opportunities from the admin."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableThreads.map((thread) => (
                  <AvailableTradeCard
                    key={thread.id}
                    thread={thread}
                    onSubscribe={() => handleSubscribe(thread)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Trades Tab */}
          <TabsContent value="active">
            {activeTrades.length === 0 ? (
              <EmptyState
                icon={<Target className="h-12 w-12" />}
                title="No active trades"
                description="Subscribe to a trade to start tracking your performance."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeTrades.map((trade) => (
                  <ActiveTradeCard
                    key={trade.id}
                    trade={trade}
                    thread={openThreads.find((t) => t.id === trade.tradeThreadId)}
                    onExit={() => handleExit(trade)}
                    onViewTimeline={() => handleViewTimeline(trade)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Journal Tab */}
          <TabsContent value="journal">
            {journalTrades.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-12 w-12" />}
                title="No completed trades"
                description="Your trade history will appear here after you exit positions."
              />
            ) : (
              <div className="space-y-4">
                {journalTrades.map((trade) => (
                  <JournalTradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Subscribe Sheet */}
      {selectedThread && (
        <ITookThisSheet
          thread={selectedThread}
          open={showSubscribeSheet}
          onOpenChange={setShowSubscribeSheet}
          onSuccess={() => {
            setShowSubscribeSheet(false);
            setSelectedThread(null);
            loadMyTrades();
            setActiveTab("active");
          }}
        />
      )}

      {/* Exit Sheet */}
      {selectedTrade && (
        <MemberExitSheet
          trade={selectedTrade}
          open={showExitSheet}
          onOpenChange={setShowExitSheet}
          onSuccess={() => {
            setShowExitSheet(false);
            setSelectedTrade(null);
            loadMyTrades();
            loadJournalTrades();
          }}
        />
      )}

      {/* Timeline Sheet */}
      <Sheet open={showTimelineSheet} onOpenChange={setShowTimelineSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Trade Timeline</SheetTitle>
          </SheetHeader>
          {selectedThread && selectedTrade && (
            <div className="mt-4">
              <TradeTimeline thread={selectedThread} memberTrade={selectedTrade} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Sub-components

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-[var(--text-muted)] mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-sm">{description}</p>
    </div>
  );
}

function AvailableTradeCard({
  thread,
  onSubscribe,
}: {
  thread: TradeThread;
  onSubscribe: () => void;
}) {
  const isCall = thread.contract?.type === "call";

  return (
    <Card className="bg-[var(--surface-1)] border-[var(--border-primary)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{thread.symbol}</span>
            {thread.contract && (
              <Badge variant={isCall ? "default" : "destructive"} className="text-xs">
                {thread.contract.strike} {isCall ? "C" : "P"}
              </Badge>
            )}
          </div>
          {thread.tradeType && (
            <Badge variant="outline" className="text-xs">
              {thread.tradeType}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Price Info */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Entry</span>
              <p className="font-medium">${thread.entryPrice?.toFixed(2) || "—"}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Target</span>
              <p className="font-medium text-emerald-500">
                ${thread.targetPrice?.toFixed(2) || "—"}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Stop</span>
              <p className="font-medium text-red-500">${thread.stopLoss?.toFixed(2) || "—"}</p>
            </div>
          </div>

          {/* Subscribers */}
          {thread.memberCount !== undefined && thread.memberCount > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              {thread.memberCount} member{thread.memberCount !== 1 ? "s" : ""} subscribed
            </p>
          )}

          {/* Subscribe Button */}
          <Button
            onClick={onSubscribe}
            className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90"
          >
            I Took This Trade
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveTradeCard({
  trade,
  thread,
  onExit,
  onViewTimeline,
}: {
  trade: MemberTrade;
  thread?: TradeThread;
  onExit: () => void;
  onViewTimeline: () => void;
}) {
  // Calculate P/L based on current price (would need real-time data)
  // For now, show entry info
  const pnl = trade.exitPrice ? calculatePnlPercent(trade.entryPrice, trade.exitPrice) : null;

  return (
    <Card className="bg-[var(--surface-1)] border-[var(--border-primary)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{thread?.symbol || "—"}</span>
            {thread?.contract && (
              <Badge
                variant={thread.contract.type === "call" ? "default" : "destructive"}
                className="text-xs"
              >
                {thread.contract.strike} {thread.contract.type === "call" ? "C" : "P"}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Entry Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">My Entry</span>
              <p className="font-medium">${trade.entryPrice.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Size</span>
              <p className="font-medium">
                {trade.sizeContracts || 1} contract{(trade.sizeContracts || 1) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Stop/Target */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Stop</span>
              <p className="font-medium text-red-500">
                ${trade.stopPrice?.toFixed(2) || thread?.stopLoss?.toFixed(2) || "—"}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Target</span>
              <p className="font-medium text-emerald-500">
                ${trade.targets?.[0]?.toFixed(2) || thread?.targetPrice?.toFixed(2) || "—"}
              </p>
            </div>
          </div>

          {/* Notes */}
          {trade.notes && (
            <p className="text-xs text-[var(--text-muted)] truncate">Note: {trade.notes}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onViewTimeline}>
              Timeline
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={onExit}>
              Exit Trade
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JournalTradeRow({ trade }: { trade: MemberTrade }) {
  const pnl = trade.exitPrice ? calculatePnlPercent(trade.entryPrice, trade.exitPrice) : null;
  const isWin = pnl !== null && pnl > 0;

  return (
    <Card className="bg-[var(--surface-1)] border-[var(--border-primary)]">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* P/L Badge */}
            <div
              className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                isWin ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              }`}
            >
              {isWin ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-semibold">
                {pnl !== null ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(1)}%` : "—"}
              </span>
            </div>

            {/* Trade Info */}
            <div>
              <p className="font-medium">
                Entry: ${trade.entryPrice.toFixed(2)} → Exit: ${trade.exitPrice?.toFixed(2) || "—"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {trade.entryTime ? new Date(trade.entryTime).toLocaleDateString() : "—"} •{" "}
                {trade.sizeContracts || 1} contract
                {(trade.sizeContracts || 1) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Notes indicator */}
          {trade.notes && (
            <Badge variant="outline" className="text-xs">
              <BookOpen className="h-3 w-3 mr-1" />
              Notes
            </Badge>
          )}
        </div>

        {/* Notes expanded */}
        {trade.notes && (
          <p className="mt-3 text-sm text-[var(--text-muted)] border-t border-[var(--border-primary)] pt-3">
            {trade.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default MemberDashboard;
