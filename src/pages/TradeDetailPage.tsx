"use client";

import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { useTradeStore } from "../stores/tradeStore";
import { AppLayout } from "../components/layouts/AppLayout";
import { BreadcrumbNav } from "../components/navigation/BreadcrumbNav";
import { HDLiveChart } from "../components/hd/charts/HDLiveChart";
import { HDEditablePrice } from "../components/hd/common/HDEditablePrice";
import { NowPanelManage } from "../components/trading/NowPanelManage";
import { useActiveTradePnL } from "../hooks/useMassiveData";
import { Suspense } from "react";
import { cn } from "../lib/utils";

/**
 * TradeDetailPage - View details for a specific trade
 *
 * Route: /trades/:id
 *
 * For ENTERED trades (active management):
 * - Live P&L via WebSocket/REST streaming
 * - Full management cockpit (NowPanelManage)
 * - Key levels, MTF status, trade tape
 *
 * For EXITED trades (historical review):
 * - Static review layout
 * - Entry/exit prices and times
 * - P&L breakdown
 * - Trade charts/analysis
 */
export default function TradeDetailPage() {
  const { id: tradeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeTrades, historyTrades, updateTrade } = useTradeStore();

  // Find the trade from either active or history trades
  const allTrades = [...activeTrades, ...historyTrades];
  const trade = allTrades.find((t) => t.id === tradeId);

  /**
   * Handle editing entry or exit price with P&L recalculation
   */
  const handlePriceEdit = async (field: "entryPrice" | "exitPrice", newPrice: number) => {
    if (!trade) return;

    // Calculate new movePercent based on updated prices
    const entryPrice = field === "entryPrice" ? newPrice : trade.entryPrice || 0;
    const exitPrice = field === "exitPrice" ? newPrice : trade.exitPrice || 0;

    let movePercent: number | undefined;
    if (entryPrice > 0 && exitPrice > 0) {
      movePercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    }

    // Update trade in database with new price and recalculated P&L
    await updateTrade(trade.id, {
      [field]: newPrice,
      movePercent,
    });
  };

  if (!trade) {
    return (
      <AppLayout hideMainBottomNav>
        <div className="p-4 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-[var(--text-high)] text-xl mb-2">Trade not found</h1>
            <p className="text-[var(--text-muted)] mb-4">Trade ID: {tradeId}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-[var(--brand-primary)] text-[var(--bg-base)] rounded-[var(--radius)] hover:opacity-90 transition-opacity"
            >
              Go Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Determine if trade is active (ENTERED/LOADED) or historical (EXITED)
  const isActiveTrade = trade.state === "ENTERED" || trade.state === "LOADED";
  const breadcrumbItems = [
    { label: "Trades", href: isActiveTrade ? "/" : "/history" },
    {
      label: `${trade.ticker} ${trade.contract.strike}${trade.contract.type}`,
      isActive: true,
    },
  ];

  // For ENTERED trades, render the live management cockpit
  if (isActiveTrade) {
    return (
      <AppLayout hideMainBottomNav>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              Loading trade details...
            </div>
          }
        >
          {/* Breadcrumb Navigation */}
          <BreadcrumbNav items={breadcrumbItems} />

          {/* Header with back button */}
          <div className="sticky top-0 z-40 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] p-4">
            <div className="max-w-6xl mx-auto flex items-center gap-3">
              <button
                onClick={() => navigate("/")}
                className="p-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] transition-colors"
                title="Back to cockpit"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-medium">{trade.ticker}</h1>
                <p className="text-[var(--text-muted)] text-sm">
                  {trade.contract.strike}
                  {trade.contract.type} • {trade.contract.daysToExpiry}DTE • Active Trade
                </p>
              </div>
            </div>
          </div>

          {/* Live Management Cockpit */}
          <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-120px)]">
            <NowPanelManage trade={trade} activeTicker={null} />
          </div>
        </Suspense>
      </AppLayout>
    );
  }

  // For EXITED trades, render the static review layout
  return (
    <AppLayout hideMainBottomNav>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            Loading trade details...
          </div>
        }
      >
        {/* Breadcrumb Navigation */}
        <BreadcrumbNav items={breadcrumbItems} />

        {/* Header with back button and P&L summary */}
        <div className="sticky top-0 z-40 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-medium">{trade.ticker}</h1>
                <p className="text-[var(--text-muted)] text-sm">
                  {trade.contract.strike}
                  {trade.contract.type} • {trade.contract.daysToExpiry}DTE
                </p>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-2xl font-bold ${(trade.movePercent || 0) >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"}`}
              >
                {(trade.movePercent || 0) >= 0 ? "+" : ""}
                {(trade.movePercent || 0).toFixed(2)}%
              </div>
              <p className="text-[var(--text-muted)] text-sm">P&L</p>
            </div>
          </div>
        </div>

        {/* Main content - Static review for EXITED trades */}
        <div className="max-w-6xl mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Entry Info */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Entry</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-[var(--text-muted)] text-xs mb-1">Price</p>
                  <HDEditablePrice
                    value={trade.entryPrice || 0}
                    onSave={async (newPrice) => handlePriceEdit("entryPrice", newPrice)}
                    className="text-lg font-medium text-[var(--text-high)]"
                  />
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Time</p>
                  <p className="text-sm">
                    {trade.entryTime ? new Date(trade.entryTime).toLocaleString() : "--"}
                  </p>
                </div>
              </div>
            </div>

            {/* Exit Info */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Exit</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-[var(--text-muted)] text-xs mb-1">Price</p>
                  <HDEditablePrice
                    value={trade.exitPrice || 0}
                    onSave={async (newPrice) => handlePriceEdit("exitPrice", newPrice)}
                    className="text-lg font-medium text-[var(--text-high)]"
                    disabled={trade.state !== "EXITED"}
                  />
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Time</p>
                  <p className="text-sm">
                    {trade.exitTime ? new Date(trade.exitTime).toLocaleString() : "--"}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Stats</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Type</p>
                  <p className="text-sm">{trade.tradeType}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">State</p>
                  <p className="text-sm">{trade.state}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Price Chart */}
          <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4 mb-4">
            <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Price Chart</h2>
            <div className="h-[400px]">
              <HDLiveChart ticker={trade.ticker} timeframe="5m" showToolbar={true} height={400} />
            </div>
          </div>

          {/* Trade Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Risk Metrics */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Risk Metrics</h2>
              <div className="space-y-3">
                {trade.targetPrice && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Target</span>
                    <span className="font-medium">${trade.targetPrice.toFixed(2)}</span>
                  </div>
                )}
                {trade.stopLoss && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Stop Loss</span>
                    <span className="font-medium">${trade.stopLoss.toFixed(2)}</span>
                  </div>
                )}
                {trade.contract.daysToExpiry && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">DTE</span>
                    <span className="font-medium">{trade.contract.daysToExpiry}d</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contract Details */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Contract Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Strike</span>
                  <span className="font-medium">${trade.contract.strike}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Type</span>
                  <span className="font-medium uppercase">{trade.contract.type}</span>
                </div>
                {trade.contract.expiration && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Expiration</span>
                    <span className="font-medium text-sm">
                      {new Date(trade.contract.expiration).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trade Notes */}
          {trade.notes && (
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Notes</h2>
              <p className="text-sm text-[var(--text-high)]">{trade.notes}</p>
            </div>
          )}
        </div>
      </Suspense>
    </AppLayout>
  );
}
