import { useState, useEffect } from 'react';
import { Trade, Challenge, DiscordChannel, AlertType } from '../../types';
import { cn, formatPrice } from '../../lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { HDShareCard } from './HDShareCard';

interface HDPanelDiscordAlertProps {
  trade: Trade | null;
  alertType: AlertType;
  alertOptions?: { updateKind?: 'trim' | 'generic' | 'sl' };
  availableChannels: DiscordChannel[];
  challenges: Challenge[];
  onSend: (channels: string[], challengeIds: string[], comment?: string) => void;
  onCancel?: () => void;
  className?: string;
  overridePreviewText?: string;
  showShareCard?: boolean; // Whether to show the share card (for History share flow)
}

export function HDPanelDiscordAlert({
  trade,
  alertType,
  alertOptions,
  availableChannels,
  challenges,
  onSend,
  onCancel,
  className,
  overridePreviewText,
  showShareCard = false
}: HDPanelDiscordAlertProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [attachShareCard, setAttachShareCard] = useState(true); // Default to ON
  
  // Field toggles for alert customization
  const [showEntry, setShowEntry] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [showStopLoss, setShowStopLoss] = useState(false);
  const [showPnL, setShowPnL] = useState(false);

  // Initialize with trade's existing associations and set defaults based on alertType
  useEffect(() => {
    if (trade) {
      setSelectedChannels(trade.discordChannels || []);
      setSelectedChallenges(trade.challenges || []);
      
      // Set default comment based on alert type
      let defaultComment = '';
      if (alertType === 'update' && alertOptions?.updateKind === 'trim') {
        defaultComment = 'Trimming here to lock profit.';
      } else if (alertType === 'update' && alertOptions?.updateKind === 'sl') {
        defaultComment = 'Updating stop loss.';
      } else if (alertType === 'update' && alertOptions?.updateKind === 'generic') {
        defaultComment = 'Quick update on this position.';
      } else if (alertType === 'trail_stop') {
        defaultComment = 'Enabling trailing stop on this position.';
      } else if (alertType === 'add') {
        defaultComment = 'Adding to position here.';
      } else if (alertType === 'exit') {
        defaultComment = 'Exiting position here.';
      }
      setComment(defaultComment);
      
      // Set default field visibility based on alert type
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
        setShowCurrent(false);
        setShowTarget(false);
        setShowStopLoss(true);
        setShowPnL(false);
      } else if (alertType === 'update' && alertOptions?.updateKind === 'generic') {
        setShowEntry(false);
        setShowCurrent(true);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(false);
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
      } else if (alertType === 'load') {
        setShowEntry(false);
        setShowCurrent(false);
        setShowTarget(false);
        setShowStopLoss(false);
        setShowPnL(false);
      }
    }
  }, [trade, alertType, alertOptions]);

  if (!trade) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-[var(--surface-2)] p-6', className)}>
        <p className="text-[var(--text-muted)] text-sm text-center">
          Select a contract to preview alert
        </p>
      </div>
    );
  }

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
    switch (alertType) {
      case 'load': return '📋 LOADED';
      case 'enter': return '🎯 ENTERED';
      case 'add': return '➕ ADDED';
      case 'exit': return '🏁 EXITED';
      case 'update': return '📊 UPDATE';
      case 'trail_stop': return '🏃‍♂️ TRAIL STOP';
    }
  };

  const getAlertMessage = () => {
    // Use override text if provided (for export/share from History)
    if (overridePreviewText) {
      return comment.trim() ? `${overridePreviewText}\n\n${comment}` : overridePreviewText;
    }
    
    const { ticker, contract, entryPrice, currentPrice, movePercent, tradeType } = trade;
    const strikeStr = `$${contract.strike}${contract.type}`;
    const expiryStr = contract.expiry;
    
    let message = `**${ticker} ${strikeStr} ${expiryStr}** (${tradeType})\n`;
    
    if (alertType === 'load') {
      // For load alerts, just show basic info - no prices or greeks
      message += `\nLoaded for review`;
    } else if (alertType === 'enter' && entryPrice) {
      message += `\nEntry: $${entryPrice.toFixed(2)}`;
      if (trade.targetPrice) message += `\nTarget: $${trade.targetPrice.toFixed(2)}`;
      if (trade.stopLoss) message += `\nStop: $${trade.stopLoss.toFixed(2)}`;
    } else if (currentPrice) {
      message += `\nCurrent: $${currentPrice.toFixed(2)}`;
      if (movePercent !== undefined) {
        const sign = movePercent >= 0 ? '+' : '';
        message += `\nP&L: ${sign}${movePercent.toFixed(1)}%`;
      }
    }
    
    if (comment.trim()) {
      message += `\n\n${comment}`;
    }
    
    return message;
  };

  const buttonLabel = alertType === 'load' ? 'Load and Alert' : 'Send Alert';

  // Debug logging for scroll container
  useEffect(() => {
    console.log('[HDPanelDiscordAlert] Component mounted/updated', {
      alertType,
      showShareCard,
      channelsCount: availableChannels.length,
      challengesCount: challenges.length
    });
  }, [alertType, showShareCard, availableChannels.length, challenges.length]);

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 bg-[var(--surface-2)]', className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex-shrink-0">
        <h2 className="text-[var(--text-high)] uppercase tracking-wide text-xs">
          Alert Preview
        </h2>
      </div>

      <div 
        className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        onScroll={(e) => {
          const target = e.currentTarget;
          console.log('[HDPanelDiscordAlert] Scroll event:', {
            scrollTop: target.scrollTop,
            scrollHeight: target.scrollHeight,
            clientHeight: target.clientHeight,
            canScrollMore: target.scrollTop + target.clientHeight < target.scrollHeight
          });
        }}
        ref={(el) => {
          if (el) {
            console.log('[HDPanelDiscordAlert] Scroll container dimensions:', {
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              offsetHeight: el.offsetHeight,
              isScrollable: el.scrollHeight > el.clientHeight
            });
          }
        }}
      >
        {/* Share Card Preview - Only show for share flow from History */}
        {showShareCard && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[var(--text-med)] text-xs uppercase tracking-wide">
                Share Card Preview
              </Label>
              <span className="text-[var(--text-muted)] text-micro uppercase tracking-wide">
                for screenshot / image attachment
              </span>
            </div>
            <HDShareCard trade={trade} challenges={challenges} />
            
            {/* Toggle to attach card */}
            <div className="flex items-start space-x-2 p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <Checkbox
                id="attach-share-card"
                checked={attachShareCard}
                onCheckedChange={(checked) => setAttachShareCard(checked as boolean)}
                className="border-[var(--border-hairline)] mt-0.5"
              />
              <div className="flex-1">
                <label
                  htmlFor="attach-share-card"
                  className="text-sm text-[var(--text-high)] cursor-pointer block mb-1"
                >
                  Attach Share Card image to Discord alert
                </label>
                <p className="text-xs text-[var(--text-muted)]">
                  When enabled, this trade highlight card will be attached to the Discord alert as an image.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Alert Preview */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4">
          <div className="text-[var(--brand-primary)] text-xs uppercase tracking-wide mb-2">
            {getAlertTitle()}
          </div>
          <div className="text-[var(--text-high)] text-sm whitespace-pre-line">
            {getAlertMessage()}
          </div>
        </div>

        {/* Discord Channels */}
        <div className="space-y-3">
          <Label className="text-[var(--text-med)] text-xs uppercase tracking-wide">
            Discord Channels
          </Label>
          <div className="space-y-2">
            {availableChannels.map((channel) => (
              <div key={channel.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`channel-${channel.id}`}
                  checked={selectedChannels.includes(channel.id)}
                  onCheckedChange={() => toggleChannel(channel.id)}
                  className="border-[var(--border-hairline)]"
                />
                <label
                  htmlFor={`channel-${channel.id}`}
                  className="text-sm text-[var(--text-high)] cursor-pointer"
                >
                  #{channel.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Challenges */}
        <div className="space-y-3">
          <Label className="text-[var(--text-med)] text-xs uppercase tracking-wide">
            Challenges
          </Label>
          <div className="space-y-2">
            {challenges.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">No active challenges</p>
            ) : (
              challenges.map((challenge) => (
                <div key={challenge.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`challenge-${challenge.id}`}
                    checked={selectedChallenges.includes(challenge.id)}
                    onCheckedChange={() => toggleChallenge(challenge.id)}
                    className="border-[var(--border-hairline)]"
                  />
                  <label
                    htmlFor={`challenge-${challenge.id}`}
                    className="text-sm text-[var(--text-high)] cursor-pointer flex items-center gap-2"
                  >
                    {challenge.name}
                    {challenge.scope === 'honeydrip-wide' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide">
                        HD
                      </span>
                    )}
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-3">
          <Label htmlFor="alert-comment" className="text-[var(--text-med)] text-xs uppercase tracking-wide">
            Add Comment (Optional)
          </Label>
          <Textarea
            id="alert-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add additional context to this alert..."
            className="min-h-[80px] bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)] resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-[var(--border-hairline)] space-y-2 flex-shrink-0">
        <Button
          onClick={() => onSend(selectedChannels, selectedChallenges, comment.trim() || undefined)}
          disabled={selectedChannels.length === 0}
          className="w-full bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90"
        >
          {buttonLabel}
        </Button>
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full bg-transparent border-[var(--border-hairline)] text-[var(--text-med)] hover:bg-[var(--surface-1)] hover:text-[var(--text-high)]"
          >
            Discard
          </Button>
        )}
      </div>
    </div>
  );
}
