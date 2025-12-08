import { DiscordChannel } from "../../../types";
import { LogOut, MessageCircle, Mic, ChevronRight } from "lucide-react";
import { useUIStore } from "../../../stores";

interface MobileSettingsScreenProps {
  channels: DiscordChannel[];
  voiceEnabled?: boolean;
  onLogout?: () => void;
}

export function MobileSettingsScreen({
  channels,
  voiceEnabled = true,
  onLogout,
}: MobileSettingsScreenProps) {
  const setShowDiscordDialog = useUIStore((s) => s.setShowDiscordDialog);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Discord Section */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
            Discord
          </h3>
          <button
            onClick={() => setShowDiscordDialog(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)]"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-[var(--text-muted)]" />
              <div className="text-left">
                <span className="text-[var(--text-high)] block">Channels</span>
                <span className="text-[var(--text-muted)] text-xs">
                  {channels.length} configured
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Voice Section */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
            Voice Commands
          </h3>
          <div className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)]">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-[var(--text-muted)]" />
              <div className="text-left">
                <span className="text-[var(--text-high)] block">Hey Honey</span>
                <span className="text-[var(--text-muted)] text-xs">Wake word voice control</span>
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                voiceEnabled ? "bg-[var(--brand-primary)]" : "bg-[var(--surface-3)]"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                  voiceEnabled ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Account Section */}
        {onLogout && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">
              Account
            </h3>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-1)] rounded-xl border border-[var(--border-hairline)]"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-[var(--accent-negative)]" />
                <span className="text-[var(--accent-negative)]">Sign Out</span>
              </div>
            </button>
          </div>
        )}

        {/* Version info */}
        <div className="text-center pt-8 pb-4">
          <span className="text-[var(--text-muted)] text-xs">HoneyDrip Admin Mobile v1.0</span>
        </div>
      </div>
    </div>
  );
}
