import React, { useState, useEffect } from "react";
import { AppSheet } from "../../ui/AppSheet";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { HDButton } from "../common/HDButton";
import { DetailsToggle } from "../common/DetailsToggle";
import { DiscordChannel } from "../../../types";
import { Trash2, Plus, Check, AlertCircle, Star, Pencil, X } from "lucide-react";
import { useAppToast } from "../../../hooks/useAppToast";
import { cn } from "../../../lib/utils";

interface HDDialogDiscordSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: DiscordChannel[];
  onAddChannel: (name: string, webhookUrl: string, description?: string) => void;
  onUpdateChannel?: (id: string, updates: Partial<DiscordChannel>) => void;
  onRemoveChannel: (id: string) => void;
  onSetDefaultChannel?: (id: string) => void;
  onTestWebhook?: (channel: DiscordChannel) => Promise<boolean>;
  discordAlertsEnabled: boolean;
  onToggleAlertsEnabled: (enabled: boolean) => void;
}

export function HDDialogDiscordSettings({
  open,
  onOpenChange,
  channels,
  onAddChannel,
  onUpdateChannel,
  onRemoveChannel,
  onSetDefaultChannel,
  onTestWebhook,
  discordAlertsEnabled,
  onToggleAlertsEnabled,
}: HDDialogDiscordSettingsProps) {
  const toast = useAppToast();
  const [newChannelName, setNewChannelName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "error">>({});
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    isDefaultEnter: boolean;
    isDefaultExit: boolean;
    isDefaultUpdate: boolean;
  }>({
    name: "",
    description: "",
    isDefaultEnter: true,
    isDefaultExit: true,
    isDefaultUpdate: true,
  });

  const handleAddChannel = () => {
    if (newChannelName.trim() && newWebhookUrl.trim()) {
      // Basic webhook URL validation - allow discord.com, discordapp.com, and canary/ptb variants
      const validPrefixes = [
        "https://discord.com/api/webhooks/",
        "https://discordapp.com/api/webhooks/",
        "https://canary.discord.com/api/webhooks/",
        "https://ptb.discord.com/api/webhooks/",
      ];

      if (!validPrefixes.some((prefix) => newWebhookUrl.startsWith(prefix))) {
        toast.error("Invalid Discord webhook URL. Must be a valid Discord webhook URL.");
        return;
      }

      onAddChannel(newChannelName.trim(), newWebhookUrl.trim(), newDescription.trim() || undefined);
      setNewChannelName("");
      setNewWebhookUrl("");
      setNewDescription("");
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

  const handleSetDefault = (channel: DiscordChannel) => {
    if (onSetDefaultChannel) {
      onSetDefaultChannel(channel.id);
      toast.success(`#${channel.name} is now your default channel`);
    }
  };

  const handleStartEdit = (channel: DiscordChannel) => {
    setEditingChannelId(channel.id);
    setEditForm({
      name: channel.name,
      description: channel.description || "",
      isDefaultEnter: channel.isDefaultEnter ?? true,
      isDefaultExit: channel.isDefaultExit ?? true,
      isDefaultUpdate: channel.isDefaultUpdate ?? true,
    });
  };

  const handleSaveEdit = (channelId: string) => {
    if (onUpdateChannel && editForm.name.trim()) {
      onUpdateChannel(channelId, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        isDefaultEnter: editForm.isDefaultEnter,
        isDefaultExit: editForm.isDefaultExit,
        isDefaultUpdate: editForm.isDefaultUpdate,
      });
      toast.success("Channel updated");
    }
    setEditingChannelId(null);
    setEditForm({
      name: "",
      description: "",
      isDefaultEnter: true,
      isDefaultExit: true,
      isDefaultUpdate: true,
    });
  };

  const handleCancelEdit = () => {
    setEditingChannelId(null);
    setEditForm({
      name: "",
      description: "",
      isDefaultEnter: true,
      isDefaultExit: true,
      isDefaultUpdate: true,
    });
  };

  // Get the default channel
  const defaultChannel = channels.find((c) => c.isGlobalDefault);

  const alertTypes: Array<{ key: string; label: string; description: string }> = [
    { key: "setup", label: "Setups", description: "Pre-signal setups when confluence is forming" },
    { key: "ready", label: "Ready", description: "High-confidence signals ready to trade" },
    { key: "signal", label: "Signals", description: "General signal notifications" },
    { key: "error", label: "Errors", description: "Scanner/worker errors and health issues" },
    { key: "heartbeat", label: "Heartbeat", description: "Periodic health checks (admin only)" },
  ];

  const [alertPrefs, setAlertPrefs] = useState<
    Record<string, { enabled: boolean; channels: string[] }>
  >({});
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const resp = await fetch("/api/discord/alert-preferences");
      const data = await resp.json();
      const prefs: Record<string, { enabled: boolean; channels: string[] }> = {};
      if (Array.isArray(data?.preferences)) {
        for (const p of data.preferences) {
          prefs[p.alert_type] = {
            enabled: p.enabled ?? true,
            channels: Array.isArray(p.webhook_urls) ? p.webhook_urls : [],
          };
        }
      }
      setAlertPrefs(prefs);
    } catch (err) {
      toast.error("Failed to load alert preferences");
    } finally {
      setLoadingPrefs(false);
    }
  };

  const savePreference = async (alertType: string, enabled: boolean, channels: string[]) => {
    setSavingPrefs(true);
    try {
      await fetch("/api/discord/alert-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_type: alertType,
          enabled,
          webhook_urls: channels,
        }),
      });
      toast.success(`Saved alert settings for ${alertType}`);
    } catch {
      toast.error(`Failed to save settings for ${alertType}`);
    } finally {
      setSavingPrefs(false);
    }
  };

  // Load once on open
  useEffect(() => {
    if (open) loadPreferences();
  }, [open]);

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

        {/* Default Channel Info */}
        {defaultChannel && (
          <div className="p-3 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-[var(--radius)]">
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-[var(--brand-primary)] fill-[var(--brand-primary)]" />
              <span className="text-[var(--text-high)]">Default Channel:</span>
              <span className="font-mono text-[var(--brand-primary)]">#{defaultChannel.name}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 ml-6">
              This channel will be pre-selected when composing alerts
            </p>
          </div>
        )}

        {/* Alert Type Controls */}
        <div className="space-y-3 p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[var(--text-high)] text-sm uppercase tracking-wide">
              Alert Types & Routing
            </h3>
            {loadingPrefs && <span className="text-xs text-[var(--text-muted)]">Loading…</span>}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Turn specific alert types on/off and choose which channels receive them.
          </p>
          <div className="space-y-3">
            {alertTypes.map((t) => {
              const pref = alertPrefs[t.key] || { enabled: true, channels: [] };
              return (
                <div
                  key={t.key}
                  className="p-3 rounded-[var(--radius)] border border-[var(--border-hairline)] bg-[var(--surface-3)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-[var(--text-high)] font-medium capitalize">
                          {t.label}
                        </Label>
                        {t.key === "error" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-200 border border-red-500/40">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{t.description}</p>
                    </div>
                    <Switch
                      checked={pref.enabled}
                      onCheckedChange={(checked) => {
                        const next = { ...pref, enabled: checked };
                        setAlertPrefs((p) => ({ ...p, [t.key]: next }));
                        savePreference(t.key, checked, pref.channels);
                      }}
                      disabled={savingPrefs}
                    />
                  </div>
                  <div className="mt-2 space-y-1">
                    <Label className="text-[11px] text-[var(--text-med)]">Channels</Label>
                    <div className="flex flex-wrap gap-2">
                      {channels.map((ch) => {
                        const selected = pref.channels.includes(
                          ch.webhookUrl || ch.webhook_url || ch.id
                        );
                        const key = ch.webhookUrl || ch.webhook_url || ch.id;
                        return (
                          <button
                            key={key}
                            className={cn(
                              "px-2 py-1 text-[11px] rounded border transition-colors",
                              selected
                                ? "bg-[var(--brand-primary)]/15 border-[var(--brand-primary)] text-[var(--text-high)]"
                                : "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-med)] hover:border-[var(--brand-primary)]/60"
                            )}
                            onClick={() => {
                              const nextChannels = selected
                                ? pref.channels.filter((c) => c !== key)
                                : [...pref.channels, key];
                              const next = { ...pref, channels: nextChannels };
                              setAlertPrefs((p) => ({ ...p, [t.key]: next }));
                              savePreference(t.key, pref.enabled, nextChannels);
                            }}
                            disabled={savingPrefs}
                          >
                            #{ch.name}
                          </button>
                        );
                      })}
                      {channels.length === 0 && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          No channels added yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[var(--text-med)]">
                Description <span className="text-[var(--text-muted)]">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g., For 0DTE scalp alerts only"
                className="bg-[var(--bg-base)] border-[var(--border-hairline)] text-[var(--text-high)] min-h-[60px]"
              />
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
                  className={cn(
                    "p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border",
                    channel.isGlobalDefault
                      ? "border-[var(--brand-primary)]/50"
                      : "border-[var(--border-hairline)]"
                  )}
                >
                  {editingChannelId === channel.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-[var(--text-med)] text-xs">Channel Name</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="bg-[var(--bg-base)] border-[var(--border-hairline)] text-[var(--text-high)]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[var(--text-med)] text-xs">Description</Label>
                        <Textarea
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, description: e.target.value }))
                          }
                          className="bg-[var(--bg-base)] border-[var(--border-hairline)] text-[var(--text-high)] min-h-[60px]"
                          placeholder="Add a description..."
                        />
                      </div>

                      {/* Voice Alert Routing in Edit Mode */}
                      <div className="space-y-2">
                        <Label className="text-[var(--text-med)] text-xs">
                          Voice Alert Routing
                        </Label>
                        <div className="flex flex-wrap gap-3 p-3 bg-[var(--surface-3)] rounded border border-[var(--border-hairline)]">
                          <label className="flex items-center gap-2 text-sm text-[var(--text-high)] cursor-pointer hover:opacity-80 transition-opacity select-none">
                            <input
                              type="checkbox"
                              checked={editForm.isDefaultEnter}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, isDefaultEnter: e.target.checked }))
                              }
                              className="w-4 h-4 rounded accent-[var(--brand-primary)] cursor-pointer"
                            />
                            <span>Entry</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[var(--text-high)] cursor-pointer hover:opacity-80 transition-opacity select-none">
                            <input
                              type="checkbox"
                              checked={editForm.isDefaultExit}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, isDefaultExit: e.target.checked }))
                              }
                              className="w-4 h-4 rounded accent-[var(--brand-primary)] cursor-pointer"
                            />
                            <span>Exit</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[var(--text-high)] cursor-pointer hover:opacity-80 transition-opacity select-none">
                            <input
                              type="checkbox"
                              checked={editForm.isDefaultUpdate}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, isDefaultUpdate: e.target.checked }))
                              }
                              className="w-4 h-4 rounded accent-[var(--brand-primary)] cursor-pointer"
                            />
                            <span>Update</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <HDButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveEdit(channel.id)}
                          className="flex-1"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Save
                        </HDButton>
                        <HDButton variant="outline" size="sm" onClick={handleCancelEdit}>
                          <X className="w-3 h-3" />
                        </HDButton>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {channel.isGlobalDefault && (
                            <Star className="w-3.5 h-3.5 text-[var(--brand-primary)] fill-[var(--brand-primary)]" />
                          )}
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
                        {channel.description && (
                          <p className="text-xs text-[var(--text-med)] mb-2">
                            {channel.description}
                          </p>
                        )}

                        {/* Voice Alert Routing */}
                        <div className="flex flex-wrap gap-3 mb-2 relative z-10">
                          <label
                            className="flex items-center gap-1.5 text-[11px] text-[var(--text-high)] cursor-pointer hover:opacity-80 transition-opacity select-none"
                            style={{ pointerEvents: "auto" }}
                          >
                            <input
                              type="checkbox"
                              checked={channel.isDefaultEnter ?? true}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (onUpdateChannel) {
                                  onUpdateChannel(channel.id, { isDefaultEnter: e.target.checked });
                                  toast.success(
                                    `${e.target.checked ? "Enabled" : "Disabled"} entry alerts for #${channel.name}`
                                  );
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded accent-[var(--brand-primary)] cursor-pointer"
                              style={{ pointerEvents: "auto" }}
                            />
                            <span>Entry</span>
                          </label>
                          <label
                            className="flex items-center gap-1.5 text-[11px] text-[var(--text-high)] cursor-pointer hover:opacity-80 transition-opacity select-none"
                            style={{ pointerEvents: "auto" }}
                          >
                            <input
                              type="checkbox"
                              checked={channel.isDefaultExit ?? true}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (onUpdateChannel) {
                                  onUpdateChannel(channel.id, { isDefaultExit: e.target.checked });
                                  toast.success(
                                    `${e.target.checked ? "Enabled" : "Disabled"} exit alerts for #${channel.name}`
                                  );
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded accent-[var(--brand-primary)] cursor-pointer"
                              style={{ pointerEvents: "auto" }}
                            />
                            <span>Exit</span>
                          </label>
                          <label
                            className="flex items-center gap-1.5 text-[11px] text-[var(--text-high)] cursor-pointer hover:opacity-80 transition-opacity select-none"
                            style={{ pointerEvents: "auto" }}
                          >
                            <input
                              type="checkbox"
                              checked={channel.isDefaultUpdate ?? true}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (onUpdateChannel) {
                                  onUpdateChannel(channel.id, {
                                    isDefaultUpdate: e.target.checked,
                                  });
                                  toast.success(
                                    `${e.target.checked ? "Enabled" : "Disabled"} update alerts for #${channel.name}`
                                  );
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded accent-[var(--brand-primary)] cursor-pointer"
                              style={{ pointerEvents: "auto" }}
                            />
                            <span>Update</span>
                          </label>
                        </div>

                        <div className="text-xs text-[var(--text-muted)] font-mono break-all">
                          {channel.webhookUrl.slice(0, 50)}...
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Added {channel.createdAt.toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {/* Default toggle */}
                        {onSetDefaultChannel && !channel.isGlobalDefault && (
                          <HDButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(channel)}
                            className="text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
                            title="Set as default"
                          >
                            <Star className="w-4 h-4" />
                          </HDButton>
                        )}
                        {/* Edit button */}
                        {onUpdateChannel && (
                          <HDButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(channel)}
                            className="text-[var(--text-muted)] hover:text-[var(--text-high)]"
                          >
                            <Pencil className="w-4 h-4" />
                          </HDButton>
                        )}
                        {/* Test button */}
                        {onTestWebhook && (
                          <HDButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestWebhook(channel)}
                            disabled={testingChannelId === channel.id}
                            className="text-[var(--text-muted)] hover:text-[var(--text-high)] text-xs"
                          >
                            {testingChannelId === channel.id ? "..." : "Test"}
                          </HDButton>
                        )}
                        {/* Delete button */}
                        <HDButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remove channel #${channel.name}?`)) {
                              onRemoveChannel(channel.id);
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
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Webhook Help - Collapsed */}
        <DetailsToggle summary="How to get a webhook URL">
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-muted)] pl-1">
            <li>Server Settings → Integrations → Webhooks</li>
            <li>Create or select a webhook</li>
            <li>Copy URL and paste above</li>
          </ol>
        </DetailsToggle>
      </div>
    </AppSheet>
  );
}
