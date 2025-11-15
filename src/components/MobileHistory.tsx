import { useState } from 'react';
import { Trade, DiscordChannel, Challenge } from '../types';
import { HDTagTradeType } from './hd/HDTagTradeType';
import { HDInput } from './hd/HDInput';
import { HDButton } from './hd/HDButton';
import { HDCard } from './hd/HDCard';
import { formatPrice, formatPercent, formatDate, formatTime, cn } from '../lib/utils';
import { Search, Share2, Download, ChevronDown, X, Filter } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { HDPanelDiscordAlert } from './hd/HDPanelDiscordAlert';
import { toast } from 'sonner@2.0.3';
import { MobileWatermark } from './MobileWatermark';

interface MobileHistoryProps {
  trades: Trade[];
  channels?: DiscordChannel[];
  challenges?: Challenge[];
}

type DateRangeFilter = 'all' | 'today' | '7d' | '30d';

export function MobileHistory({ trades, channels = [], challenges = [] }: MobileHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('7d');
  const [challengeFilter, setChallengeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  
  // Filter logic
  const filtered = trades.filter(trade => {
    const matchesSearch = trade.ticker.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || trade.tradeType === typeFilter;
    
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
    
    const matchesChallenge = challengeFilter === 'all' || trade.challenges.includes(challengeFilter);
    
    return matchesSearch && matchesType && matchesDateRange && matchesChallenge;
  }).sort((a, b) => {
    const timeA = a.exitTime ? new Date(a.exitTime).getTime() : 0;
    const timeB = b.exitTime ? new Date(b.exitTime).getTime() : 0;
    return timeB - timeA;
  });
  
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
  
  const handleShareClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setShowShareSheet(true);
  };
  
  const handleSendAlert = (channelIds: string[], challengeIds: string[], comment?: string) => {
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    const channelNames = selectedChannels.map(c => `#${c.name}`).join(', ');
    
    toast.success(`Share alert sent to ${channelNames}`);
    setShowShareSheet(false);
  };
  
  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)] relative">
      {/* Watermark */}
      <MobileWatermark />
      
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-hairline)] flex-shrink-0 bg-[var(--bg-base)] relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[var(--text-high)]">Review</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "w-9 h-9 rounded-[var(--radius)] flex items-center justify-center transition-colors",
                showFilters 
                  ? "bg-[var(--brand-primary)] text-[var(--bg-base)]"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)]"
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <HDInput
            placeholder="Search by ticker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Filters Panel - Collapsible */}
      {showFilters && (
        <div className="p-4 bg-[var(--surface-2)] border-b border-[var(--border-hairline)] space-y-4 flex-shrink-0 relative z-10">
          {/* Type Filter */}
          <div>
            <label className="block text-[var(--text-muted)] text-xs mb-2 uppercase tracking-wide">
              Trade Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {['all', 'Scalp', 'Day', 'Swing', 'LEAP'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    'px-3 h-9 rounded-[var(--radius)] text-sm transition-colors whitespace-nowrap',
                    typeFilter === type
                      ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                      : 'bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                  )}
                >
                  {type === 'all' ? 'All' : type}
                </button>
              ))}
            </div>
          </div>
          
          {/* Date Range */}
          <div>
            <label className="block text-[var(--text-muted)] text-xs mb-2 uppercase tracking-wide">
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
          
          {/* Challenge Filter */}
          {challenges.length > 0 && (
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-2 uppercase tracking-wide">
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
          )}
        </div>
      )}
      
      {/* Trade Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)]">
            No trades found
          </div>
        ) : (
          filtered.map((trade) => {
            const isProfit = (trade.movePercent || 0) >= 0;
            
            return (
              <HDCard
                key={trade.id}
                variant="interactive"
                onClick={() => handleShareClick(trade)}
                className="relative"
              >
                {/* Share indicator badge */}
                <div className="absolute top-3 right-3">
                  <div className="w-8 h-8 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] flex items-center justify-center">
                    <Share2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                </div>
                
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--text-high)]">{trade.ticker}</span>
                      <HDTagTradeType type={trade.tradeType} className="text-micro" />
                    </div>
                    <div className="text-[var(--text-muted)] text-xs">
                      {trade.contract.strike}{trade.contract.type} • {trade.contract.expiry}
                    </div>
                  </div>
                  
                  {/* P&L Badge */}
                  <div className={cn(
                    'px-3 py-1.5 rounded-[var(--radius)]',
                    isProfit ? 'bg-[var(--accent-positive)]/10' : 'bg-[var(--accent-negative)]/10'
                  )}>
                    <span className={cn(
                      'font-semibold tabular-nums text-sm',
                      isProfit ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                    )}>
                      {formatPercent(trade.movePercent || 0)}
                    </span>
                  </div>
                </div>
                
                {/* Price Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--border-hairline)]">
                    <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">Entry</div>
                    <div className="text-[var(--text-high)] text-sm tabular-nums">
                      ${formatPrice(trade.entryPrice || 0)}
                    </div>
                  </div>
                  <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--border-hairline)]">
                    <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">Exit</div>
                    <div className="text-[var(--text-high)] text-sm tabular-nums">
                      ${formatPrice(trade.exitPrice || 0)}
                    </div>
                  </div>
                </div>
                
                {/* Footer - Date & Time */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-hairline)]">
                  <span className="text-[var(--text-muted)] text-xs">
                    {trade.exitTime ? formatDate(trade.exitTime) : '--'}
                  </span>
                  <span className="text-[var(--text-muted)] text-xs">
                    {trade.exitTime ? formatTime(trade.exitTime) : '--'}
                  </span>
                </div>
              </HDCard>
            );
          })
        )}
      </div>
      
      {/* Share Sheet */}
      <Sheet open={showShareSheet} onOpenChange={setShowShareSheet}>
        <SheetContent 
          side="bottom" 
          className="h-[90vh] p-0 bg-[var(--surface-1)] border-t-2 border-t-[var(--brand-primary)] flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Share Trade</SheetTitle>
            <SheetDescription>Share this trade result to Discord channels</SheetDescription>
          </SheetHeader>
          
          {selectedTrade && (
            <HDPanelDiscordAlert
              trade={selectedTrade}
              alertType="update"
              availableChannels={channels}
              challenges={challenges}
              onSend={handleSendAlert}
              onCancel={() => setShowShareSheet(false)}
              overridePreviewText={getShareText(selectedTrade)}
              showShareCard={true}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
