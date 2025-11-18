import { useState, useEffect, useMemo } from 'react';
import { Trade, Challenge, DiscordChannel, AlertType } from '../../types';
import { cn, formatPrice } from '../../lib/utils';
import { formatDiscordAlert } from '../../lib/discordFormatter';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Edit2 } from 'lucide-react';
import { HDCalculatorModal } from './HDCalculatorModal';
import { HDTradeShareCard } from './HDTradeShareCard';

interface HDAlertComposerProps {
  trade: Trade;
  alertType: AlertType;
  alertOptions?: { updateKind?: 'trim' | 'generic' | 'sl' };
  availableChannels: DiscordChannel[];
  challenges: Challenge[];
  onSend: (channels: string[], challengeIds: string[], comment?: string) => void;
  onEnterAndAlert?: (channels: string[], challengeIds: string[], comment?: string) => void; // New callback for Enter and Alert
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
  console.log('📝 HDAlertComposer rendered:', { alertType, alertOptions, trade: trade.ticker });
  
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  
  // Field toggles for alert customization
  const [showEntry, setShowEntry] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [showStopLoss, setShowStopLoss] = useState(false);
  const [showPnL, setShowPnL] = useState(false);
  const [showConfluence, setShowConfluence] = useState(false);
  const [showGainsImage, setShowGainsImage] = useState(false); // For exit alerts only
  
  // Editable prices
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice || trade.contract.mid);
  const [currentPrice, setCurrentPrice] = useState(trade.currentPrice || trade.contract.mid);
  const [targetPrice, setTargetPrice] = useState(trade.targetPrice || trade.contract.mid * 1.5);
  const [stopLoss, setStopLoss] = useState(trade.stopLoss || trade.contract.mid * 0.5);
  
  // Calculator modal state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [editingField, setEditingField] = useState<'entry' | 'current' | 'target' | 'stop' | null>(null);

  // Quick action buttons state for stop loss updates
  const [slQuickAction, setSlQuickAction] = useState<'custom' | 'trail' | 'breakeven'>('custom');

  // Initialize channels and challenges when trade changes or alert opens
  useEffect(() => {
    setSelectedChannels(trade.discordChannels || []);
    setSelectedChallenges(trade.challenges || []);
  }, [trade.id, trade.discordChannels, trade.challenges]); // Re-run when channels/challenges change

  // Initialize defaults based on alertType
  useEffect(() => {
    // Initialize prices
    setEntryPrice(trade.entryPrice || trade.contract.mid);
    setCurrentPrice(trade.currentPrice || trade.contract.mid);
    setTargetPrice(trade.targetPrice || trade.contract.mid * 1.5);
    setStopLoss(trade.stopLoss || trade.contract.mid * 0.5);
    
    // Set default comment with auto-populated info
    let defaultComment = '';
    if (alertType === 'load') {
      defaultComment = `Watching this ${trade.tradeType} setup. Entry around $${formatPrice(trade.contract.mid)}${underlyingPrice ? ` (${trade.ticker} @ $${formatPrice(underlyingPrice)})` : ''}.`;
    } else if (alertType === 'enter') {
      defaultComment = `Entering at $${formatPrice(trade.entryPrice || trade.contract.mid)}${underlyingPrice ? ` (${trade.ticker} @ $${formatPrice(underlyingPrice)})` : ''}. Targeting $${formatPrice(trade.targetPrice || trade.contract.mid * 1.5)} with stop at $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)}.`;
    } else if (alertType === 'update' && alertOptions?.updateKind === 'trim') {
      defaultComment = `Trimming here at $${formatPrice(trade.currentPrice || trade.contract.mid)} to lock in profit. ${trade.movePercent ? `Up ${trade.movePercent > 0 ? '+' : ''}${trade.movePercent.toFixed(1)}%.` : ''}`;
    } else if (alertType === 'update' && alertOptions?.updateKind === 'sl') {
      defaultComment = `Moving stop loss to $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)} to protect gains. Currently at $${formatPrice(trade.currentPrice || trade.contract.mid)} (${trade.movePercent ? (trade.movePercent > 0 ? '+' : '') + trade.movePercent.toFixed(1) : '0.0'}%).`;
    } else if (alertType === 'update' && alertOptions?.updateKind === 'generic') {
      defaultComment = `Update: Currently at $${formatPrice(trade.currentPrice || trade.contract.mid)}. ${trade.movePercent ? `P&L: ${trade.movePercent > 0 ? '+' : ''}${trade.movePercent.toFixed(1)}%.` : ''}`;
    } else if (alertType === 'trail_stop') {
      defaultComment = `Enabling trailing stop at $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)}. Letting winners run.`;
    } else if (alertType === 'add') {
      defaultComment = `Adding to position at $${formatPrice(trade.currentPrice || trade.contract.mid)}. ${trade.movePercent ? `Currently ${trade.movePercent > 0 ? '+' : ''}${trade.movePercent.toFixed(1)}%.` : ''}`;
    } else if (alertType === 'exit') {
      defaultComment = `Exiting position at $${formatPrice(trade.currentPrice || trade.contract.mid)}. ${trade.movePercent ? `Final P&L: ${trade.movePercent > 0 ? '+' : ''}${trade.movePercent.toFixed(1)}%.` : ''}`;
    }
    setComment(defaultComment);
    
    // Set default field visibility
    if (alertType === 'enter') {
      setShowEntry(true);
      setShowCurrent(true);
      setShowTarget(true);
      setShowStopLoss(true);
      setShowPnL(false);
    } else if (alertType === 'update' && alertOptions?.updateKind === 'trim') {
      setShowEntry(false);
      setShowCurrent(true);
      setShowTarget(false);
      setShowStopLoss(false);
      setShowPnL(true);
    } else if (alertType === 'update' && alertOptions?.updateKind === 'sl') {
      setShowEntry(false);
      setShowCurrent(true);
      setShowTarget(false);
      setShowStopLoss(true);
      setShowPnL(true);
    } else if (alertType === 'update' && alertOptions?.updateKind === 'generic') {
      setShowEntry(false);
      setShowCurrent(true);
      setShowTarget(false);
      setShowStopLoss(false);
      setShowPnL(true);
    } else if (alertType === 'trail_stop') {
      setShowEntry(false);
      setShowCurrent(false);
      setShowTarget(false);
      setShowStopLoss(true);
      setShowPnL(false);
    } else if (alertType === 'add') {
      setShowEntry(false);
      setShowCurrent(true);
      setShowTarget(false);
      setShowStopLoss(false);
      setShowPnL(true);
    } else if (alertType === 'exit') {
      setShowEntry(false);
      setShowCurrent(true);
      setShowTarget(false);
      setShowStopLoss(false);
      setShowPnL(true);
      setShowGainsImage(true); // Show gains image for exit alerts
    } else if (alertType === 'load') {
      setShowEntry(false);
      setShowCurrent(true);
      setShowTarget(false);
      setShowStopLoss(false);
      setShowPnL(false);
    }
  }, [trade, alertType, alertOptions]);

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challengeId)
        ? prev.filter((c) => c !== challengeId)
        : [...prev, challengeId]
    );
  };

  const getAlertTitle = () => {
    if (alertType === 'load') return 'Load Alert';
    if (alertType === 'enter') return 'Entry Alert';
    if (alertType === 'exit') return 'Exit Alert';
    if (alertType === 'add') return 'Add Alert';
    if (alertType === 'trail_stop') return 'Trail Stop Alert';
    if (alertType === 'update' && alertOptions?.updateKind === 'trim') return 'Trim Alert';
    if (alertType === 'update' && alertOptions?.updateKind === 'sl') return 'Update Stop Loss';
    if (alertType === 'update' && alertOptions?.updateKind === 'generic') return 'Update Alert';
    return 'Alert';
  };

  const getPreviewMessage = () => {
    const confluenceDataFromTrade = trade.confluence
      ? {
          rsi: trade.confluence.rsi14,
          macdSignal: trade.confluence.macdSignal,
          volumeChange: trade.confluence.volumeChange,
          ivPercentile: trade.confluence.ivPercentile,
        }
      : undefined;

    // Use the Discord formatter with current field selections
    return formatDiscordAlert(trade, alertType, {
      updateKind: alertOptions?.updateKind,
      includeEntry: showEntry,
      includeCurrent: showCurrent,
      includeTarget: showTarget,
      includeStopLoss: showStopLoss,
      includePnL: showPnL,
      includeConfluence: showConfluence,
      comment: comment,
      confluenceData: showConfluence ? confluenceDataFromTrade : undefined,
    });
  };
  
  const openCalculator = (field: 'entry' | 'current' | 'target' | 'stop') => {
    setEditingField(field);
    setCalculatorOpen(true);
  };
  
  const handlePriceUpdate = (value: number) => {
    if (editingField === 'entry') {
      setEntryPrice(value);
    } else if (editingField === 'current') {
      setCurrentPrice(value);
    } else if (editingField === 'target') {
      setTargetPrice(value);
    } else if (editingField === 'stop') {
      setStopLoss(value);
    }
  };
  
  const getCalculatorTitle = () => {
    if (editingField === 'entry') return 'Entry Price';
    if (editingField === 'current') return 'Current Price';
    if (editingField === 'target') return 'Target Price';
    if (editingField === 'stop') return 'Stop Loss Price';
    return 'Price';
  };
  
  const getCalculatorValue = () => {
    if (editingField === 'entry') return entryPrice;
    if (editingField === 'current') return currentPrice;
    if (editingField === 'target') return targetPrice;
    if (editingField === 'stop') return stopLoss;
    return 0;
  };

  const tradeTypeDisplay = useMemo(() => {
    if (!trade.contract?.expiration) return null;
    
    const expiration = new Date(trade.contract.expiration);
    const now = new Date();
    const diffMs = expiration.getTime() - now.getTime();
    const dte = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    
    let type = 'DAY';
    if (dte <= 2) type = '0DTE/SCALP';
    else if (dte <= 14) type = 'DAY';
    else if (dte <= 60) type = 'SWING';
    else type = 'LEAP';
    
    return { type, dte };
  }, [trade.contract?.expiration]);

  return (
    <div className="h-full flex flex-col bg-[var(--surface-2)] overflow-hidden">
      {/* Header */}
      <div className="px-4 lg:px-6 py-4 border-b border-[var(--border-hairline)] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[var(--text-high)] font-semibold">
              {getAlertTitle()}
            </h2>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              Configure alert details and channels
            </p>
          </div>
          {tradeTypeDisplay && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs px-2 py-1 rounded-[var(--radius)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-medium uppercase tracking-wide">
                {tradeTypeDisplay.type}
              </span>
              <span className="text-[var(--text-muted)] text-xs">
                {tradeTypeDisplay.dte} DTE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Middle Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-6">
        {/* Stop Loss Quick Actions - Show for SL updates */}
        {alertType === 'update' && alertOptions?.updateKind === 'sl' && trade.entryPrice && (
          <div>
            <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-3 block">
              Quick Actions
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const breakeven = trade.entryPrice || trade.contract.mid;
                  setStopLoss(breakeven);
                  setComment(`Moving stop to breakeven at $${formatPrice(breakeven)} to lock in risk-free trade. Currently at $${formatPrice(trade.currentPrice || trade.contract.mid)} (${trade.movePercent ? (trade.movePercent > 0 ? '+' : '') + trade.movePercent.toFixed(1) : '0.0'}%).`);
                }}
                className={cn(
                  'flex-1 px-3 py-2 rounded-[var(--radius)] text-xs transition-colors',
                  'bg-[var(--surface-1)] border border-[var(--border-hairline)]',
                  'text-[var(--text-high)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                )}
              >
                Move to Breakeven
              </button>
              <button
                onClick={() => {
                  setComment(`Trailing stop activated at $${formatPrice(trade.stopLoss || trade.contract.mid * 0.5)}. Letting winners run. Currently at $${formatPrice(trade.currentPrice || trade.contract.mid)} (${trade.movePercent ? (trade.movePercent > 0 ? '+' : '') + trade.movePercent.toFixed(1) : '0.0'}%).`);
                }}
                className={cn(
                  'flex-1 px-3 py-2 rounded-[var(--radius)] text-xs transition-colors',
                  'bg-[var(--surface-1)] border border-[var(--border-hairline)]',
                  'text-[var(--text-high)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                )}
              >
                Trail Stop
              </button>
            </div>
          </div>
        )}

        {/* Trim Quick Actions - Show current price and P&L info */}
        {alertType === 'update' && alertOptions?.updateKind === 'trim' && (
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[var(--text-muted)] text-xs">Current Price</span>
              <span className="text-[var(--text-high)] tabular-nums">${formatPrice(trade.currentPrice || trade.contract.mid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] text-xs">P&L</span>
              <span className={cn(
                'tabular-nums',
                (trade.movePercent || 0) >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}>
                {(trade.movePercent || 0) >= 0 ? '+' : ''}{(trade.movePercent || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        
        {/* Field Checkboxes - Collapsible */}
        <div>
          <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-3 block">
            Include in Alert
          </Label>
          <details className="group" open>
            <summary className="cursor-pointer flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors mb-2">
              <span className="text-xs text-[var(--text-high)]">
                {[showEntry, showCurrent, showTarget, showStopLoss, showPnL, showConfluence].filter(Boolean).length} field{[showEntry, showCurrent, showTarget, showStopLoss, showPnL, showConfluence].filter(Boolean).length !== 1 ? 's' : ''} selected
              </span>
              <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 mt-2">
              <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="field-entry"
                    checked={showEntry}
                    onCheckedChange={(checked) => setShowEntry(checked as boolean)}
                  />
                  <label htmlFor="field-entry" className="text-xs text-[var(--text-high)] cursor-pointer">
                    Entry
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-med)] text-xs tabular-nums">
                    ${formatPrice(entryPrice)}
                  </span>
                  <button
                    onClick={() => openCalculator('entry')}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="field-current"
                    checked={showCurrent}
                    onCheckedChange={(checked) => setShowCurrent(checked as boolean)}
                  />
                  <label htmlFor="field-current" className="text-xs text-[var(--text-high)] cursor-pointer">
                    Current
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-med)] text-xs tabular-nums">
                    ${formatPrice(currentPrice)}
                  </span>
                  <button
                    onClick={() => openCalculator('current')}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="field-target"
                    checked={showTarget}
                    onCheckedChange={(checked) => setShowTarget(checked as boolean)}
                  />
                  <label htmlFor="field-target" className="text-xs text-[var(--text-high)] cursor-pointer">
                    Target {/* Add TP1/TP2 labels if multiple */}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-positive)] text-xs tabular-nums">
                    ${formatPrice(targetPrice)}
                  </span>
                  <button
                    onClick={() => openCalculator('target')}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="field-stop"
                    checked={showStopLoss}
                    onCheckedChange={(checked) => setShowStopLoss(checked as boolean)}
                  />
                  <label htmlFor="field-stop" className="text-xs text-[var(--text-high)] cursor-pointer">
                    Stop Loss
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-negative)] text-xs tabular-nums">
                    ${formatPrice(stopLoss)}
                  </span>
                  <button
                    onClick={() => openCalculator('stop')}
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
                    <label htmlFor="field-pnl" className="text-sm text-[var(--text-high)] cursor-pointer">
                      P&L
                    </label>
                  </div>
                  <div className={cn(
                    'text-sm tabular-nums',
                    trade.movePercent >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                  )}>
                    {trade.movePercent >= 0 ? '+' : ''}{trade.movePercent.toFixed(1)}%
                  </div>
                </div>
              )}

              {/* Gains Image - Only for Exit alerts */}
              {alertType === 'exit' && (
                <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="field-gains-image"
                      checked={showGainsImage}
                      onCheckedChange={(checked) => setShowGainsImage(checked as boolean)}
                    />
                    <label htmlFor="field-gains-image" className="text-xs text-[var(--text-high)] cursor-pointer">
                      Gains Image
                    </label>
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">
                    Screenshot
                  </div>
                </div>
              )}

              {/* Confluence Metrics - Optional */}
              <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="field-confluence"
                    checked={showConfluence}
                    onCheckedChange={(checked) => setShowConfluence(checked as boolean)}
                  />
                  <label htmlFor="field-confluence" className="text-xs text-[var(--text-high)] cursor-pointer">
                    Confluence Metrics
                  </label>
                </div>
                <div className="text-[var(--text-muted)] text-xs">
                  Optional
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Comment */}
        <div>
          <Label htmlFor="alert-comment" className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-2 block">
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

        {/* Channels */}
        <div>
          <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-3 block">
            Discord Channels {selectedChannels.length === 0 && <span className="text-[var(--accent-negative)] normal-case">(required)</span>}
          </Label>
          {alertType === 'enter' && selectedChannels.length > 0 ? (
            // Collapsed by default for enter alerts when channels are already selected
            <details className="group">
              <summary className="cursor-pointer flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors mb-2">
                <span className="text-xs text-[var(--text-high)]">
                  {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''} selected
                </span>
                <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center space-x-2 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors">
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
            // Expanded by default for load alerts or when no channels selected
            <div className="grid grid-cols-2 gap-2">
              {availableChannels.map((channel) => (
                <div key={channel.id} className="flex items-center space-x-2 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors">
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

        {/* Challenges */}
        {challenges.length > 0 && (
          <div>
            <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-3 block">
              Challenges (Optional)
            </Label>
            {alertType === 'enter' && selectedChallenges.length > 0 ? (
              // Collapsed by default for enter alerts when challenges are already selected
              <details className="group">
                <summary className="cursor-pointer flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]/80 transition-colors mb-2">
                  <span className="text-xs text-[var(--text-high)]">
                    {selectedChallenges.length} challenge{selectedChallenges.length !== 1 ? 's' : ''} selected
                  </span>
                  <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="space-y-2 mt-2">
                  {challenges.map((challenge) => (
                    <div key={challenge.id} className="flex items-center space-x-3 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors">
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
                        {challenge.scope === 'honeydrip-wide' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide">
                            HD
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              // Expanded by default for load alerts or when no challenges selected
              <div className="space-y-2">
                {challenges.map((challenge) => (
                  <div key={challenge.id} className="flex items-center space-x-3 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors">
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
                      {challenge.scope === 'honeydrip-wide' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide">
                          HD
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Discord Preview */}
        <div>
          <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-2 block">
            Discord Message Preview
          </Label>
          <div className="p-4 rounded-[var(--radius)] bg-[var(--bg-base)] border border-[var(--border-hairline)] font-mono text-xs leading-relaxed">
            <pre className="text-[var(--text-high)] whitespace-pre-wrap overflow-x-auto">
              {getPreviewMessage()}
            </pre>
          </div>
        </div>

        {/* Gains Image Preview - Only for Exit alerts when enabled */}
        {alertType === 'exit' && showGainsImage && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
                Gains Image Preview
              </Label>
              <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
                Will be attached to Discord alert
              </span>
            </div>
            <div className="flex items-center justify-center p-4 rounded-[var(--radius)] bg-[var(--bg-base)] border border-[var(--border-hairline)]">
              <div className="scale-75 origin-center">
                <HDTradeShareCard trade={trade} includeWatermark={true} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 lg:p-6 border-t border-[var(--border-hairline)] space-y-2 flex-shrink-0">
        {/* For 'enter' alerts: Show Enter Trade (green), Unload (yellow), Cancel (red) */}
        {alertType === 'enter' ? (
          <>
            {/* Enter Trade button - green (positive), calls onEnterAndAlert */}
            {onEnterAndAlert && (
              <button
                onClick={() => {
                  console.log('🔴 ENTER TRADE BUTTON CLICKED!');
                  console.log('📋 Selected channels:', selectedChannels);
                  console.log('📋 Selected challenges:', selectedChallenges);
                  console.log('📋 Comment:', comment);
                  onEnterAndAlert(selectedChannels, selectedChallenges, comment.trim() || undefined);
                }}
                disabled={selectedChannels.length === 0}
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
              onClick={() => onSend(selectedChannels, selectedChallenges, comment.trim() || undefined)}
              disabled={selectedChannels.length === 0}
              className="w-full py-3 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
            >
              {alertType === 'load' ? 'Load and Alert' : 'Send Alert'}
            </button>
            {/* Show "Enter and Alert" only for load alerts */}
            {alertType === 'load' && onEnterAndAlert && (
              <button
                onClick={() => {
                  console.log('🔴 ENTER AND ALERT BUTTON CLICKED!');
                  console.log('📋 Selected channels:', selectedChannels);
                  console.log('📋 Selected challenges:', selectedChallenges);
                  console.log('📋 Comment:', comment);
                  console.log('📋 onEnterAndAlert exists?', !!onEnterAndAlert);
                  onEnterAndAlert(selectedChannels, selectedChallenges, comment.trim() || undefined);
                  console.log('✅ onEnterAndAlert() called');
                }}
                disabled={selectedChannels.length === 0}
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
