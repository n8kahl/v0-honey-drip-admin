import { MobileWatermark } from '../MobileWatermark';
import { HDButton } from '../hd/common/HDButton';
import { TakeProfitSettings } from './TakeProfitSettings';
import { VoiceCommandsSettings } from './VoiceCommandsSettings';
import { LiveDataBehaviorSettings } from './LiveDataBehaviorSettings';
import { DiscordNotificationSettings } from './DiscordNotificationSettings';
import { StrategyLibraryAdmin } from '../StrategyLibraryAdmin';
import { useAppToast } from '../../hooks/useAppToast';

interface SettingsPageProps {
  onOpenDiscordSettings?: () => void;
  onClose?: () => void;
}

export function SettingsPage({ onOpenDiscordSettings, onClose }: SettingsPageProps) {
  const toast = useAppToast();

  const handleSaveAll = () => {
    toast.success('Settings saved successfully');
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4 lg:p-6 overflow-y-auto bg-[var(--bg-base)] relative">
      <MobileWatermark />

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h1 className="text-[var(--text-high)]">Settings</h1>
          <HDButton variant="primary" onClick={handleSaveAll}>
            Save Settings
          </HDButton>
        </div>

        <div className="space-y-6 lg:space-y-8">
          {/* Core Trading Settings */}
          <TakeProfitSettings />
          <LiveDataBehaviorSettings />
          <VoiceCommandsSettings />

          {/* Integrations */}
          <DiscordNotificationSettings onOpenDiscordSettings={onOpenDiscordSettings} />

          {/* Advanced */}
          <section>
            <StrategyLibraryAdmin />
          </section>
        </div>
      </div>
    </div>
  );
}
