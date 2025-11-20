import { Info, Settings } from 'lucide-react';
import { HDCard } from '../hd/HDCard';
import { HDButton } from '../hd/HDButton';

interface DiscordNotificationSettingsProps {
  onOpenDiscordSettings?: () => void;
}

export function DiscordNotificationSettings({ onOpenDiscordSettings }: DiscordNotificationSettingsProps) {
  return (
    <section>
      <HDCard>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-[var(--text-high)] mb-1">Discord & Channels</h2>
                <p className="text-[var(--text-muted)] text-xs">
                  Configure webhook URLs, default channels, and per-challenge routing
                </p>
              </div>
            </div>
            {onOpenDiscordSettings && (
              <HDButton
                variant="secondary"
                onClick={onOpenDiscordSettings}
                className="w-full sm:w-auto flex-shrink-0"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Channels
              </HDButton>
            )}
          </div>

          <div className="p-3 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/30 rounded-[var(--radius)] text-xs text-[var(--text-med)]">
            <p className="mb-2 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[var(--brand-primary)]" />
              <span>Configure multiple Discord channels with individual webhooks. Set default channels per challenge for automatic routing.</span>
            </p>
            <p className="text-[var(--text-muted)] text-micro">
              Click "Manage Channels" to add, remove, or test your Discord integrations.
            </p>
          </div>
        </div>
      </HDCard>
    </section>
  );
}
