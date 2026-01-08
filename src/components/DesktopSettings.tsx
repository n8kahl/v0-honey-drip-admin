import { useState, useEffect } from "react";
import { HDInput } from "./hd/common/HDInput";
import { HDButton } from "./hd/common/HDButton";
import { HDCard } from "./hd/common/HDCard";
import { Settings, Activity, Info, User } from "lucide-react";
import { MobileWatermark } from "./MobileWatermark";
import { useAuth } from "../contexts/AuthContext";
import { createBrowserClient } from "@supabase/ssr";
import { StrategyLibraryAdmin } from "./StrategyLibraryAdmin";
import { useTPSettings, saveTPSettings } from "../hooks/useTPSettings";

interface DesktopSettingsProps {
  onOpenDiscordSettings?: () => void;
  onClose?: () => void;
}

export function DesktopSettings({ onOpenDiscordSettings, onClose }: DesktopSettingsProps = {}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: "",
    email: user?.email || "",
    discordHandle: "",
    avatarUrl: "",
    defaultChannels: [] as string[],
  });

  const [discordWebhook, setDiscordWebhook] = useState("");
  const [defaultChannel, setDefaultChannel] = useState("alerts");
  const [tpStrategy, setTpStrategy] = useState("percent");
  const { tpNearThreshold, autoOpenTrim } = useTPSettings();
  const [tpNearPct, setTpNearPct] = useState(Math.round((tpNearThreshold ?? 0.85) * 100));
  const [tpAutoOpenTrim, setTpAutoOpenTrim] = useState(!!autoOpenTrim);
  const [slStrategy, setSlStrategy] = useState("atr");
  const [atrMultiTimeframe, setAtrMultiTimeframe] = useState(false);
  const [tradeTypeInference, setTradeTypeInference] = useState(true);
  const [dteScalpThreshold, setDteScalpThreshold] = useState(2);
  const [dteDayThreshold, setDteDayThreshold] = useState(14);
  const [dteSwingThreshold, setDteSwingThreshold] = useState(60);
  const [orbMinutes, setOrbMinutes] = useState(15);
  const [trackIndices, setTrackIndices] = useState(true);
  const [enabledIndices, setEnabledIndices] = useState<string[]>(["SPX", "VIX", "NDX"]);
  const [vixLowThreshold, setVixLowThreshold] = useState(15);
  const [vixElevatedThreshold, setVixElevatedThreshold] = useState(20);
  const [vixHighThreshold, setVixHighThreshold] = useState(30);

  // Load profile data on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      const supabase = createBrowserClient(
        import.meta.env.VITE_SUPABASE_URL!,
        import.meta.env.VITE_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Profile doesn't exist yet, create it
          const { error: insertError } = await supabase.from("profiles").insert([
            {
              id: user.id,
              display_name: "",
              discord_handle: "",
              avatar_url: "",
            },
          ]);

          if (insertError) {
            console.error("Error creating profile:", insertError);
          }
        } else {
          console.error("Error loading profile:", error);
        }
        return;
      }

      if (data) {
        setProfile({
          displayName: data.display_name || "",
          email: user.email || "",
          discordHandle: data.discord_handle || "",
          avatarUrl: data.avatar_url || "",
          defaultChannels: profile.defaultChannels, // Keep from state for now
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    try {
      const supabase = createBrowserClient(
        import.meta.env.VITE_SUPABASE_URL!,
        import.meta.env.VITE_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.from("profiles").upsert([
        {
          id: user.id,
          display_name: profile.displayName,
          discord_handle: profile.discordHandle,
          avatar_url: profile.avatarUrl,
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Error saving profile:", error);
        import("sonner").then(({ toast }) => {
          toast.error("Failed to update profile");
        });
        return;
      }

      import("sonner").then(({ toast }) => {
        toast.success("Profile updated");
      });
    } catch (err) {
      console.error("Failed to save profile:", err);
      import("sonner").then(({ toast }) => {
        toast.error("Failed to update profile");
      });
    }
  };

  const handleSave = () => {
    // Persist TP settings
    if (user?.id) {
      saveTPSettings(user.id, {
        tpNearThreshold: Math.min(Math.max(tpNearPct / 100, 0.5), 0.99),
        autoOpenTrim: tpAutoOpenTrim,
      });
    }
    import("sonner").then(({ toast }) => {
      toast.success("Settings saved successfully");
    });
    if (onClose) {
      onClose();
    }
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (profile.displayName) {
      return profile.displayName.substring(0, 2).toUpperCase();
    }
    return profile.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4 lg:p-6 overflow-y-auto bg-[var(--bg-base)] relative">
      <MobileWatermark />

      <div className="max-w-2xl mx-auto relative z-10">
        <h1 className="text-[var(--text-high)] mb-4 lg:mb-6">Settings</h1>

        <div className="space-y-6 lg:space-y-8">
          {/* Take Profit Settings */}
          <section>
            <HDCard>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[var(--text-high)] mb-1">Take Profit</h2>
                    <p className="text-[var(--text-muted)] text-xs">
                      Control TP-near alerts and auto-open Trim behavior.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">
                      TP Near Threshold (%)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={99}
                      value={tpNearPct}
                      onChange={(e) =>
                        setTpNearPct(Math.max(50, Math.min(99, Number(e.target.value))))
                      }
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)]"
                    />
                    <p className="text-[var(--text-muted)] text-xs mt-1">
                      When option premium progress reaches this percent of target, show a TP-near
                      alert.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <input
                      id="autoOpenTrim"
                      type="checkbox"
                      checked={tpAutoOpenTrim}
                      onChange={(e) => setTpAutoOpenTrim(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="autoOpenTrim" className="text-sm text-[var(--text-high)]">
                      Auto-open Trim composer on TP-near
                    </label>
                  </div>
                </div>
              </div>
            </HDCard>
          </section>
          {/* Profile Section */}
          <section>
            <HDCard>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[var(--text-high)] mb-1">Profile</h2>
                    <p className="text-[var(--text-muted)] text-xs">
                      Manage your personal information and preferences
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Profile Picture */}
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">
                      Profile Picture
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white font-bold text-xl">
                        {getInitials()}
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">Name</label>
                    <input
                      type="text"
                      value={profile.displayName}
                      onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                      className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                      placeholder="Your name"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled={true}
                      className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-sm cursor-not-allowed"
                    />
                  </div>

                  {/* Discord Handle */}
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">
                      Discord Handle
                    </label>
                    <input
                      type="text"
                      value={profile.discordHandle}
                      onChange={(e) => setProfile({ ...profile, discordHandle: e.target.value })}
                      className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                      placeholder="@honeydrip_admin"
                    />
                  </div>

                  {/* Default Discord Channels */}
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">
                      Default Discord Channels
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={profile.defaultChannels.includes("alerts")}
                          onChange={(e) => {
                            const channels = e.target.checked
                              ? [...profile.defaultChannels, "alerts"]
                              : profile.defaultChannels.filter((c) => c !== "alerts");
                            setProfile({ ...profile, defaultChannels: channels });
                          }}
                          className="w-4 h-4 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                        />
                        <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                          Alerts
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={profile.defaultChannels.includes("entries")}
                          onChange={(e) => {
                            const channels = e.target.checked
                              ? [...profile.defaultChannels, "entries"]
                              : profile.defaultChannels.filter((c) => c !== "entries");
                            setProfile({ ...profile, defaultChannels: channels });
                          }}
                          className="w-4 h-4 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                        />
                        <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                          Entries
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={profile.defaultChannels.includes("exits")}
                          onChange={(e) => {
                            const channels = e.target.checked
                              ? [...profile.defaultChannels, "exits"]
                              : profile.defaultChannels.filter((c) => c !== "exits");
                            setProfile({ ...profile, defaultChannels: channels });
                          }}
                          className="w-4 h-4 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                        />
                        <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                          Exits
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Save Profile Button */}
                  <div className="pt-2">
                    <HDButton
                      variant="primary"
                      onClick={handleSaveProfile}
                      className="w-full sm:w-auto"
                    >
                      Save Profile
                    </HDButton>
                  </div>
                </div>
              </div>
            </HDCard>
          </section>

          {/* Trade Defaults */}
          <section>
            <HDCard>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[var(--text-high)] mb-1">Trade Defaults</h2>
                    <p className="text-[var(--text-muted)] text-xs">
                      Configure default TP/SL strategies and automatic trade type detection
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">
                      Take Profit Strategy
                    </label>
                    <select
                      value={tpStrategy}
                      onChange={(e) => setTpStrategy(e.target.value)}
                      className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                    >
                      <option value="percent">Percent-based</option>
                      <option value="atr">ATR-based</option>
                      <option value="atr-mtf">ATR + Multi-Timeframe</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] text-sm mb-2">
                      Stop Loss Strategy
                    </label>
                    <select
                      value={slStrategy}
                      onChange={(e) => setSlStrategy(e.target.value)}
                      className="w-full h-9 px-3 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                    >
                      <option value="percent">Percent-based</option>
                      <option value="atr">ATR-based</option>
                      <option value="atr-mtf">ATR + Multi-Timeframe</option>
                    </select>
                  </div>

                  <div className="pt-2 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={tradeTypeInference}
                        onChange={(e) => setTradeTypeInference(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                          Auto-detect trade type by DTE
                        </span>
                        <p className="text-[var(--text-muted)] text-xs mt-0.5">
                          Automatically classifies as SCALP, DAY, SWING, or LEAP based on days to
                          expiration
                        </p>
                      </div>
                    </label>

                    {tradeTypeInference && (
                      <div className="pl-7 space-y-3 pt-2">
                        <div>
                          <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                            SCALP Threshold (0-N DTE)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={dteScalpThreshold}
                            onChange={(e) => setDteScalpThreshold(parseInt(e.target.value))}
                            className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                          />
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            Intraday scalping (includes 0DTE)
                          </p>
                        </div>

                        <div>
                          <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                            DAY Threshold (N-M DTE)
                          </label>
                          <input
                            type="number"
                            min={3}
                            max={30}
                            value={dteDayThreshold}
                            onChange={(e) => setDteDayThreshold(parseInt(e.target.value))}
                            className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                          />
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            Intraday bias, more tolerance
                          </p>
                        </div>

                        <div>
                          <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                            SWING Threshold (M-N DTE)
                          </label>
                          <input
                            type="number"
                            min={15}
                            max={120}
                            value={dteSwingThreshold}
                            onChange={(e) => setDteSwingThreshold(parseInt(e.target.value))}
                            className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                          />
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            Multi-day holds (&gt;N DTE = LEAP)
                          </p>
                        </div>

                        <div>
                          <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                            ORB Window (minutes)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={60}
                            value={orbMinutes}
                            onChange={(e) => setOrbMinutes(parseInt(e.target.value))}
                            className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                          />
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            Opening Range Breakout calculation window
                          </p>
                        </div>
                      </div>
                    )}

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={atrMultiTimeframe}
                        onChange={(e) => setAtrMultiTimeframe(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                          Enable ATR + Multi-Timeframe analysis
                        </span>
                        <p className="text-[var(--text-muted)] text-xs mt-0.5">
                          Analyzes volatility across multiple timeframes for more precise TP/SL
                          levels
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </HDCard>
          </section>

          {/* Discord Integration */}
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
                    <span>
                      Configure multiple Discord channels with individual webhooks. Set default
                      channels per challenge for automatic routing.
                    </span>
                  </p>
                  <p className="text-[var(--text-muted)] text-micro">
                    Click "Manage Channels" to add, remove, or test your Discord integrations.
                  </p>
                </div>
              </div>
            </HDCard>
          </section>

          {/* Live Data Behavior */}
          <section>
            <HDCard>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-[var(--accent-positive)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[var(--text-high)] mb-1">Live Data Behavior</h2>
                    <p className="text-[var(--text-muted)] text-xs">
                      How data updates when connected to live market feeds (for developer reference)
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-[var(--accent-positive)] min-w-[16px] mt-0.5">•</span>
                    <div>
                      <span className="text-[var(--text-high)] font-medium">Active Trades: </span>
                      <span className="text-[var(--text-med)]">
                        Prices and P&L update in real-time from live data feed
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-[var(--accent-positive)] min-w-[16px] mt-0.5">•</span>
                    <div>
                      <span className="text-[var(--text-high)] font-medium">
                        Watchlist & Options Chains:{" "}
                      </span>
                      <span className="text-[var(--text-med)]">
                        Refresh every few seconds with latest market data
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-[var(--accent-positive)] min-w-[16px] mt-0.5">•</span>
                    <div>
                      <span className="text-[var(--text-high)] font-medium">
                        Confluence Metrics:{" "}
                      </span>
                      <span className="text-[var(--text-med)]">
                        Trend/volatility/liquidity refreshed periodically from live market analysis
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-[var(--accent-positive)] min-w-[16px] mt-0.5">•</span>
                    <div>
                      <span className="text-[var(--text-high)] font-medium">5-Minute Charts: </span>
                      <span className="text-[var(--text-med)]">
                        New candles appear as market progresses, EMAs recalculate automatically
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-xs text-[var(--text-muted)]">
                  <Info className="w-3.5 h-3.5 inline-block mr-1.5 text-[var(--accent-positive)]" />
                  These annotations document future behavior when live WebSocket connections are
                  implemented.
                </div>
              </div>
            </HDCard>
          </section>

          {/* Indices Tracking */}
          <section>
            <HDCard>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[var(--text-high)] mb-1">Indices Tracking</h2>
                    <p className="text-[var(--text-muted)] text-xs">
                      Configure macro context monitoring with SPX, VIX, and other indices
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={trackIndices}
                      onChange={(e) => setTrackIndices(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                        Enable indices tracking
                      </span>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">
                        Monitor SPX, VIX, NDX for macro context and market regime detection
                      </p>
                    </div>
                  </label>

                  {trackIndices && (
                    <div className="pl-7 space-y-4 pt-2">
                      {/* Enabled Indices */}
                      <div>
                        <label className="block text-[var(--text-muted)] text-sm mb-2">
                          Tracked Indices
                        </label>
                        <div className="space-y-2">
                          {["SPX", "VIX", "NDX", "DJI", "RUT"].map((index) => (
                            <label
                              key={index}
                              className="flex items-center gap-2 cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                checked={enabledIndices.includes(index)}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...enabledIndices, index]
                                    : enabledIndices.filter((i) => i !== index);
                                  setEnabledIndices(updated);
                                }}
                                className="w-4 h-4 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                              />
                              <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                                {index}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* VIX Thresholds */}
                      <div>
                        <label className="block text-[var(--text-muted)] text-sm mb-2">
                          VIX Classification Thresholds
                        </label>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                              Low (&lt; N)
                            </label>
                            <input
                              type="number"
                              min={10}
                              max={25}
                              value={vixLowThreshold}
                              onChange={(e) => setVixLowThreshold(parseInt(e.target.value))}
                              className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                              Elevated (&lt; N)
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={30}
                              value={vixElevatedThreshold}
                              onChange={(e) => setVixElevatedThreshold(parseInt(e.target.value))}
                              className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[var(--text-muted)] text-xs mb-1.5">
                              High (&gt;= N)
                            </label>
                            <input
                              type="number"
                              min={25}
                              max={50}
                              value={vixHighThreshold}
                              onChange={(e) => setVixHighThreshold(parseInt(e.target.value))}
                              className="w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm"
                            />
                          </div>
                        </div>
                        <p className="text-[var(--text-muted)] text-xs mt-2">
                          Thresholds: Low &lt; {vixLowThreshold}, Normal {vixLowThreshold}-
                          {vixElevatedThreshold}, Elevated {vixElevatedThreshold}-{vixHighThreshold}
                          , High &gt;= {vixHighThreshold}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </HDCard>
          </section>

          {/* Feedback & Notifications */}
          <section>
            <HDCard>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[var(--text-high)] mb-1">Feedback & Notifications</h2>
                    <p className="text-[var(--text-muted)] text-xs">
                      Toast notifications appear for all key actions
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h3 className="text-[var(--text-high)] text-sm">Success Notifications</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-[var(--text-muted)] min-w-[4px]">•</span>
                      <span className="text-[var(--text-med)]">
                        Alert sent (with channel names and P&L)
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-[var(--text-muted)] min-w-[4px]">•</span>
                      <span className="text-[var(--text-med)]">Settings saved successfully</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-[var(--text-muted)] min-w-[4px]">•</span>
                      <span className="text-[var(--text-med)]">Trade state updated</span>
                    </div>
                  </div>

                  <p className="text-[var(--text-muted)] text-micro pt-2">
                    All toasts use consistent styling from design tokens (brand colors, typography,
                    border radius).
                  </p>
                </div>
              </div>
            </HDCard>
          </section>

          {/* Save Button */}
          <div className="flex justify-end pb-8">
            <HDButton variant="primary" onClick={handleSave} className="w-full sm:w-auto">
              Save Settings
            </HDButton>
          </div>

          {/* Strategy Library Admin (Super Admin) */}
          <section>
            <StrategyLibraryAdmin />
          </section>
        </div>
      </div>
    </div>
  );
}
