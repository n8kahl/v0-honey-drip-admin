import { useState } from 'react';
import { AlertChannels } from '../../../types';
import { HDButton } from '../common/HDButton';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface HDAlertPreviewProps {
  message: string;
  onSend?: (channels: AlertChannels) => void;
  onEdit?: () => void;
  sent?: boolean;
  sentTime?: string;
}

export function HDAlertPreview({ message, onSend, onEdit, sent, sentTime }: HDAlertPreviewProps) {
  const [channels, setChannels] = useState<AlertChannels>({
    discord: true,
    telegram: false,
    app: true
  });
  
  const toggleChannel = (channel: keyof AlertChannels) => {
    setChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
  };
  
  if (sent && sentTime) {
    return (
      <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 text-[var(--accent-positive)]">
          <Check className="w-4 h-4" />
          <span className="text-sm">Sent {sentTime}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <h3 className="text-[var(--text-muted)] text-xs uppercase tracking-wide">
        Alert Preview
      </h3>
      
      <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)]">
        <p className="text-[var(--text-high)] text-sm leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
      </div>
      
      <div>
        <label className="text-[var(--text-muted)] text-xs mb-2 block">
          Send to
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => toggleChannel('discord')}
            className={cn(
              'px-3 h-7 rounded-[var(--radius)] text-xs transition-colors',
              channels.discord
                ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
            )}
          >
            Discord
          </button>
          <button
            onClick={() => toggleChannel('telegram')}
            className={cn(
              'px-3 h-7 rounded-[var(--radius)] text-xs transition-colors',
              channels.telegram
                ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
            )}
          >
            Telegram
          </button>
          <button
            onClick={() => toggleChannel('app')}
            className={cn(
              'px-3 h-7 rounded-[var(--radius)] text-xs transition-colors',
              channels.app
                ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
            )}
          >
            App
          </button>
        </div>
      </div>
      
      <div className="flex gap-2">
        <HDButton variant="primary" className="flex-1" onClick={() => onSend?.(channels)}>
          Send Alert
        </HDButton>
        <HDButton variant="ghost" onClick={onEdit}>
          Edit
        </HDButton>
      </div>
    </div>
  );
}
