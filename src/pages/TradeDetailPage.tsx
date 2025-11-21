'use client';

import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTradeStore } from '../stores/tradeStore';
import { AppLayout } from '../components/layouts/AppLayout';
import { BreadcrumbNav } from '../components/navigation/BreadcrumbNav';
import { HDLiveChart } from '../components/hd/charts/HDLiveChart';
import { Suspense } from 'react';

/**
 * TradeDetailPage - View details for a specific trade
 *
 * Route: /trades/:id
 *
 * Shows:
 * - Full trade information
 * - Entry/exit prices and times
 * - P&L breakdown
 * - Trade charts/analysis
 * - Option to close trade
 */
export default function TradeDetailPage() {
  const { id: tradeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeTrades, historyTrades } = useTradeStore();

  // Find the trade from either active or history trades
  const allTrades = [...activeTrades, ...historyTrades];
  const trade = allTrades.find((t) => t.id === tradeId);

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

  // Determine if trade is active or historical for breadcrumb navigation
  const isActiveTrade = activeTrades.some((t) => t.id === tradeId);
  const breadcrumbItems = [
    { label: 'Trades', href: isActiveTrade ? '/trades/active' : '/trades/history' },
    {
      label: `${trade.ticker} ${trade.contract.strike}${trade.contract.type}`,
      isActive: true,
    },
  ];

  return (
    <AppLayout hideMainBottomNav>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading trade details...</div>}>
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
                className={`text-2xl font-bold ${(trade.movePercent || 0) >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'}`}
              >
                {(trade.movePercent || 0) >= 0 ? '+' : ''}{(trade.movePercent || 0).toFixed(2)}%
              </div>
              <p className="text-[var(--text-muted)] text-sm">P&L</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-6xl mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Entry Info */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Entry</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Price</p>
                  <p className="text-lg font-medium">${(trade.entryPrice || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Time</p>
                  <p className="text-sm">{trade.entryTime ? new Date(trade.entryTime).toLocaleString() : '--'}</p>
                </div>
              </div>
            </div>

            {/* Exit Info */}
            <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase mb-3">Exit</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Price</p>
                  <p className="text-lg font-medium">${(trade.exitPrice || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Time</p>
                  <p className="text-sm">{trade.exitTime ? new Date(trade.exitTime).toLocaleString() : '--'}</p>
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
              <HDLiveChart
                ticker={trade.ticker}
                timeframe="5m"
                showToolbar={true}
                height={400}
              />
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
