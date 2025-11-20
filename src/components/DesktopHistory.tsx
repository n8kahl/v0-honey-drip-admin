import { useState } from 'react';
import { Trade, DiscordChannel, Challenge } from '../types';
import { HDTagTradeType } from './hd/HDTagTradeType';
import { HDInput } from './hd/HDInput';
import { HDButton } from './hd/HDButton';
import { formatPrice, formatPercent, formatDate, formatTime, cn } from '../lib/utils';
import { Search, Share2, Download, ChevronDown, History } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { HDPanelDiscordAlert } from './hd/HDPanelDiscordAlert';
import { EmptyState } from './ui/EmptyState';
import { useAppToast } from '../hooks/useAppToast';
import { MobileWatermark } from './MobileWatermark';

interface DesktopHistoryProps {
  trades: Trade[];
  channels?: DiscordChannel[];
  challenges?: Challenge[];
}

type DateRangeFilter = 'all' | 'today' | '7d' | '30d';

export function DesktopHistory({ trades, channels = [], challenges = [] }: DesktopHistoryProps) {
  const toast = useAppToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tickerFilter, setTickerFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('7d'); // Default to last 7 days
  const [challengeFilter, setChallengeFilter] = useState<string>('all');
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(false); // Collapsed by default

  // For export/share dialog
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMode, setAlertMode] = useState<'export' | 'share'>('export');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  
  // Filter logic
  const filtered = trades.filter(trade => {
    // Search term
    const matchesSearch = trade.ticker.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Type filter
    const matchesType = typeFilter === 'all' || trade.tradeType === typeFilter;
    
    // Ticker filter
    const matchesTicker = !tickerFilter.trim() || 
      trade.ticker.toUpperCase() === tickerFilter.trim().toUpperCase();
    
    // Date range filter
    let matchesDateRange = true;
    if (dateRangeFilter !== 'all' && trade.exitTime) {
      const now = new Date();
      const exitDate = new Date(trade.exitTime);
      const daysDiff = Math.floor((now.getTime() - exitDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateRangeFilter === 'today') {
        matchesDateRange = exitDate.toDateString() === now.toDateString();
      } else if (dateRangeFilter === '7d') {
        matchesDateRange = daysDiff <= 7;
      } else if (dateRangeFilter === '30d') {
        matchesDateRange = daysDiff <= 30;
      }
    }
    
    // Challenge filter
    const matchesChallenge = challengeFilter === 'all' || 
      trade.challenges.includes(challengeFilter);
    
    return matchesSearch && matchesType && matchesTicker && matchesDateRange && matchesChallenge;
  }).sort((a, b) => {
    // Sort by exitTime descending (most recent first)
    const timeA = a.exitTime ? new Date(a.exitTime).getTime() : 0;
    const timeB = b.exitTime ? new Date(b.exitTime).getTime() : 0;
    return timeB - timeA;
  });
  
  // Calculate summary stats for export
  const getSummaryText = () => {
    if (filtered.length === 0) return '';
    
    const wins = filtered.filter(t => (t.movePercent || 0) > 0).length;
    const winRate = ((wins / filtered.length) * 100).toFixed(1);
    const avgPnL = (filtered.reduce((sum, t) => sum + (t.movePercent || 0), 0) / filtered.length).toFixed(1);
    
    const biggestWinner = filtered.reduce((max, t) => 
      (t.movePercent || 0) > (max.movePercent || 0) ? t : max
    );
    const biggestLoser = filtered.reduce((min, t) => 
      (t.movePercent || 0) < (min.movePercent || 0) ? t : min
    );
    
    const challengeName = challengeFilter === 'all' ? 'All Challenges' : 
      challenges.find(c => c.id === challengeFilter)?.name || 'Challenge';
    
    const dateRangeLabel = {
      'all': 'All Time',
      'today': 'Today',
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days'
    }[dateRangeFilter];
    
    const tickerLabel = tickerFilter.trim() ? tickerFilter.toUpperCase() : 'All Tickers';
    
    return `**Trade Summary – ${challengeName} – ${dateRangeLabel} – ${tickerLabel}**

- Trades: ${filtered.length}
- Wins: ${wins} (${winRate}%)
- Average P&L: ${avgPnL > 0 ? '+' : ''}${avgPnL}%
- Biggest winner: ${biggestWinner.ticker} ${biggestWinner.contract.strike}${biggestWinner.contract.type} ${formatPercent(biggestWinner.movePercent || 0)}
- Biggest loser: ${biggestLoser.ticker} ${biggestLoser.contract.strike}${biggestLoser.contract.type} ${formatPercent(biggestLoser.movePercent || 0)}`;
  };
  
  const getShareText = (trade: Trade) => {
    const duration = trade.entryTime && trade.exitTime ? 
      formatDuration(trade.entryTime, trade.exitTime) : 'N/A';
    
    return `**${trade.ticker} ${trade.contract.strike}${trade.contract.type} (${trade.tradeType})**

Entry: $${formatPrice(trade.entryPrice || 0)}
Exit: $${formatPrice(trade.exitPrice || 0)}
P&L: ${formatPercent(trade.movePercent || 0)}
Duration: ${duration}`;
  };
  
  const formatDuration = (start: Date, end: Date) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };
  
  const handleExportClick = () => {
    setAlertMode('export');
    setSelectedTrade(null);
    setShowAlertDialog(true);
  };
  
  const handleShareClick = (trade: Trade) => {
    setAlertMode('share');
    setSelectedTrade(trade);
    setShowAlertDialog(true);
  };
  
  const handleSendAlert = (channelIds: string[], challengeIds: string[], comment?: string) => {
    // Map channel IDs to channel names
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    const channelNames = selectedChannels.map(c => `#${c.name}`).join(', ');
    
    console.log('Sending history alert:', { channelIds, selectedChannels, challengeIds, comment });
    
    const message = alertMode === 'share' 
      ? `Share alert sent to ${channelNames}`
      : `Export alert sent to ${channelNames}`;
    
    toast.success(message);
    setShowAlertDialog(false);
  };
  
  // Create a mock trade for export summary
  const getMockTradeForExport = (): Trade => {
    return {
      id: 'summary-export',
      ticker: 'SUMMARY',
      contract: {
        id: 'summary',
        strike: 0,
        expiry: '',
        expiryDate: new Date(),
        daysToExpiry: 0,
        type: 'C',
        mid: 0,
        bid: 0,
        ask: 0,
        volume: 0,
        openInterest: 0,
      },
      tradeType: 'Day',
      state: 'EXITED',
      updates: [],
      discordChannels: [],
      challenges: challengeFilter !== 'all' ? [challengeFilter] : [],
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
              className={cn(
                "w-4 h-4 transition-transform",
                showAdditionalFilters && "rotate-180"
              )} 
            />
          </button>
        </div>
        
        {/* Collapsible Additional Filters */}
        {showAdditionalFilters && (
          <div className="space-y-4 mb-6 p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
            {/* Type Filter Chips */}
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-2">
                Trade Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {['all', 'Scalp', 'Day', 'Swing', 'LEAP'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'px-4 h-9 rounded-[var(--radius)] text-sm transition-colors whitespace-nowrap',
                      typeFilter === type
                        ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                        : 'bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--border-hairline)] hover:text-[var(--text-high)]'
                    )}
                  >
                    {type === 'all' ? 'All Types' : type}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Date Range and Challenge in a row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date range filter */}
              <div>
                <label className="block text-[var(--text-muted)] text-xs mb-2">
                  Date Range
                </label>
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
                <label className="block text-[var(--text-muted)] text-xs mb-2">
                  Challenge
                </label>
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
                  filtered.map((trade) => {
                    const isProfit = (trade.movePercent || 0) >= 0;
                    
                    return (
                      <button
                        key={trade.id}
                        onClick={() => handleShareClick(trade)}
                        className="w-full grid grid-cols-[auto_1fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-4 border-b border-[var(--border-hairline)] hover:bg-[var(--surface-1)] transition-colors text-left items-center cursor-pointer"
                      >
                        {/* Share icon indicator */}
                        <div className="flex items-center">
                          <Share2 className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                        
                        <div className="text-[var(--text-high)] font-medium">
                          {trade.ticker}
                        </div>
                        <div className="text-[var(--text-muted)] text-sm">
                          {trade.contract.strike}{trade.contract.type} {trade.contract.expiry}
                        </div>
                        <div>
                          <HDTagTradeType type={trade.tradeType} />
                        </div>
                        <div className="text-[var(--text-high)] tabular-nums">
                          ${formatPrice(trade.entryPrice || 0)}
                        </div>
                        <div className="text-[var(--text-high)] tabular-nums">
                          ${formatPrice(trade.exitPrice || 0)}
                        </div>
                        <div
                          className={cn(
                            'tabular-nums',
                            isProfit ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                          )}
                        >
                          {formatPercent(trade.movePercent || 0)}
                        </div>
                        <div className="text-[var(--text-muted)] text-sm">
                          {trade.exitTime ? formatDate(trade.exitTime) : '--'}
                        </div>
                        <div className="text-[var(--text-muted)] text-sm">
                          {trade.exitTime ? formatTime(trade.exitTime) : '--'}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent 
          className="max-w-2xl p-0 gap-0 bg-[var(--surface-1)] border-[var(--border-hairline)] border-t-2 border-t-[var(--brand-primary)] max-h-[90vh] !flex flex-col"
          ref={(el) => {
            if (el) {
              console.log('[DesktopHistory] DialogContent dimensions:', {
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                offsetHeight: el.offsetHeight,
                maxHeight: window.getComputedStyle(el).maxHeight,
                display: window.getComputedStyle(el).display,
                flexDirection: window.getComputedStyle(el).flexDirection,
                overflow: window.getComputedStyle(el).overflow
              });
            }
          }}
        >
          <DialogTitle className="sr-only">
            {alertMode === 'export' ? 'Export Trade Summary' : 'Share Trade'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {alertMode === 'export' 
              ? 'Export your trade summary to Discord channels' 
              : 'Share this trade result to Discord channels'}
          </DialogDescription>
          <div 
            className="flex-1 min-h-0 flex flex-col"
            ref={(el) => {
              if (el) {
                console.log('[DesktopHistory] Wrapper div dimensions:', {
                  scrollHeight: el.scrollHeight,
                  clientHeight: el.clientHeight,
                  offsetHeight: el.offsetHeight,
                  flex: window.getComputedStyle(el).flex,
                  minHeight: window.getComputedStyle(el).minHeight
                });
              }
            }}
          >
            <HDPanelDiscordAlert
              trade={alertMode === 'export' ? getMockTradeForExport() : selectedTrade!}
              alertType="update"
              availableChannels={channels}
              challenges={challenges}
              onSend={handleSendAlert}
              onCancel={() => setShowAlertDialog(false)}
              overridePreviewText={alertMode === 'export' ? getSummaryText() : getShareText(selectedTrade!)}
              showShareCard={alertMode === 'share'} // Show share card only for individual trade shares
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
