import { useState } from "react";
import { AppSheet } from "../../ui/AppSheet";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { HDButton } from "../common/HDButton";
import { DiscordChannel } from "../../../types";
import { Trash2, Plus, Check, AlertCircle } from "lucide-react";
import { useAppToast } from "../../../hooks/useAppToast";

interface HDDialogDiscordSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: DiscordChannel[];
  onAddChannel: (name: string, webhookUrl: string) => void;
  onRemoveChannel: (id: string) => void;
  onTestWebhook?: (channel: DiscordChannel) => Promise<boolean>;
  discordAlertsEnabled: boolean;
  onToggleAlertsEnabled: (enabled: boolean) => void;
}

export function HDDialogDiscordSettings({
  open,
  onOpenChange,
  channels,
  onAddChannel,
  onRemoveChannel,
  onTestWebhook,
  discordAlertsEnabled,
  onToggleAlertsEnabled,
}: HDDialogDiscordSettingsProps) {
  const toast = useAppToast();
  const [newChannelName, setNewChannelName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "error">>({});

  const handleAddChannel = () => {
    if (newChannelName.trim() && newWebhookUrl.trim()) {
      // Basic webhook URL validation
      if (!newWebhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        toast.error(
          "Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/"
        );
        return;
      }

      onAddChannel(newChannelName.trim(), newWebhookUrl.trim());
      setNewChannelName("");
      setNewWebhookUrl("");
      toast.success(`Channel #${newChannelName.trim()} added successfully`);
    }
  };

  const handleTestWebhook = async (channel: DiscordChannel) => {
    if (!onTestWebhook) return;

    setTestingChannelId(channel.id);
    try {
      const success = await onTestWebhook(channel);
      setTestResults((prev) => ({ ...prev, [channel.id]: success ? "success" : "error" }));
      toast.success(
        success
          ? `Test message sent to #${channel.name}`
          : `Failed to send test message to #${channel.name}`
      );
    } catch (error) {
      setTestResults((prev) => ({ ...prev, [channel.id]: "error" }));
      toast.error(`Failed to send test message to #${channel.name}`);
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    toast.success("Settings saved");
  };

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Discord Integration Settings"
      snapPoint="full"
    >
      <div className="space-y-6 p-4">
        {/* Global Toggle */}
        <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label
                htmlFor="discord-alerts-toggle"
                className="text-[var(--text-high)] font-medium"
              >
                Allow Discord Alerts
              </Label>
              <p className="text-xs text-[var(--text-muted)]">
                Enable or disable all Discord alert notifications globally
              </p>
            </div>
            <Switch
              id="discord-alerts-toggle"
              checked={discordAlertsEnabled}
              onCheckedChange={onToggleAlertsEnabled}
            />
          </div>
        </div>

        {/* Add New Channel Section */}
        <div className="space-y-4 p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
          <h3 className="text-[var(--text-high)] text-sm uppercase tracking-wide">
            Add New Channel
          </h3>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-[var(--text-med)]">
                Channel Name
              </Label>
              <Input
                id="channel-name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g., scalps, day-trades, alerts"
                className="bg-[var(--bg-base)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
              <p className="text-xs text-[var(--text-muted)]">
                A friendly name for this Discord channel
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-[var(--text-med)]">
                Webhook URL
              </Label>
              <Input
                id="webhook-url"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="bg-[var(--bg-base)] border-[var(--border-hairline)] text-[var(--text-high)] font-mono text-xs"
              />
              <p className="text-xs text-[var(--text-muted)]">
                Get this from Discord: Server Settings → Integrations → Webhooks
              </p>
            </div>

            <HDButton
              variant="primary"
              onClick={handleAddChannel}
              disabled={!newChannelName.trim() || !newWebhookUrl.trim()}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Channel
            </HDButton>
          </div>
        </div>

        {/* Existing Channels List */}
        <div className="space-y-3">
          <h3 className="text-[var(--text-high)] text-sm uppercase tracking-wide">
            Configured Channels ({channels.length})
          </h3>

          {channels.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-[var(--radius)]">
              No Discord channels configured yet. Add one above to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-[var(--text-high)] font-mono">#{channel.name}</h4>
                        {testResults[channel.id] === "success" && (
                          <span className="flex items-center gap-1 text-xs text-[var(--positive)]">
                            <Check className="w-3 h-3" />
                            Tested
                          </span>
                        )}
                        {testResults[channel.id] === "error" && (
                          <span className="flex items-center gap-1 text-xs text-[var(--negative)]">
                            <AlertCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-mono break-all">
                        {channel.webhookUrl}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-2">
                        Added {channel.createdAt.toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onTestWebhook && (
                        <HDButton
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestWebhook(channel)}
                          disabled={testingChannelId === channel.id}
                        >
                          {testingChannelId === channel.id ? "Testing..." : "Test"}
                        </HDButton>
                      )}
                      <HDButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remove channel #${channel.name}?`)) {
                            onRemoveChannel(channel.id);
                            // Clear test result
                            setTestResults((prev) => {
                              const newResults = { ...prev };
                              delete newResults[channel.id];
                              return newResults;
                            });
                          }
                        }}
                        className="text-[var(--negative)] hover:bg-[var(--negative)]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </HDButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-[var(--radius)] text-xs text-blue-400 space-y-2">
          <p className="font-medium">💡 How to get a Discord webhook URL:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-300 ml-2">
            <li>Open your Discord server</li>
            <li>Go to Server Settings → Integrations → Webhooks</li>
            <li>Click "New Webhook" or select an existing one</li>
            <li>Copy the webhook URL</li>
            <li>Paste it above to add the channel</li>
          </ol>
        </div>
      </div>
    </AppSheet>
  );
}
