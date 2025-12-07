import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { DiscordChannel, Challenge } from "../types";
import {
  getDiscordChannels,
  addDiscordChannel,
  deleteDiscordChannel,
  updateDiscordChannel,
  getChallenges,
  addChallenge,
  deleteChallenge,
  updateChallenge,
} from "../lib/supabase/database";

// TP/SL Settings Types
export type TPMode = "percent" | "calculated";

export interface TPSettings {
  tpMode: TPMode;
  tpPercent: number;
  slPercent: number;
  tpNearThreshold: number;
  tpAutoOpenTrim: boolean;
}

const DEFAULT_TP_SETTINGS: TPSettings = {
  tpMode: "percent",
  tpPercent: 50,
  slPercent: 20,
  tpNearThreshold: 0.85,
  tpAutoOpenTrim: true,
};

interface SettingsStore {
  // State
  discordChannels: DiscordChannel[];
  challenges: Challenge[];
  isLoading: boolean;
  error: string | null;
  discordAlertsEnabled: boolean;

  // TP Settings state
  tpSettings: TPSettings;
  tpSettingsLoaded: boolean;

  // Actions
  setDiscordChannels: (channels: DiscordChannel[]) => void;
  setChallenges: (challenges: Challenge[]) => void;
  setDiscordAlertsEnabled: (enabled: boolean) => void;

  // Discord operations
  loadDiscordChannels: (userId: string) => Promise<void>;
  createDiscordChannel: (
    userId: string,
    name: string,
    webhookUrl: string,
    description?: string
  ) => Promise<void>;
  removeDiscordChannel: (channelId: string) => Promise<void>;
  updateDiscordChannelSettings: (
    channelId: string,
    updates: Partial<DiscordChannel>
  ) => Promise<void>;
  setDefaultChannel: (userId: string, channelId: string) => Promise<void>;
  getGlobalDefaultChannel: () => DiscordChannel | undefined;

  // Challenge operations
  loadChallenges: (userId: string) => Promise<void>;
  createChallenge: (userId: string, challenge: Partial<Challenge>) => Promise<void>;
  removeChallenge: (challengeId: string) => Promise<void>;
  updateChallengeSettings: (challengeId: string, updates: Partial<Challenge>) => Promise<void>;

  // Utilities
  getChannelById: (channelId: string) => DiscordChannel | undefined;
  getChallengeById: (challengeId: string) => Challenge | undefined;
  getDefaultChannels: (type: "load" | "enter" | "exit" | "update") => DiscordChannel[];
  getActiveChallenges: () => Challenge[];

  // TP Settings operations
  loadTPSettings: (userId: string) => Promise<void>;
  saveTPSettings: (userId: string, settings: Partial<TPSettings>) => Promise<void>;
  setTPSettings: (settings: Partial<TPSettings>) => void;

  // Reset
  reset: () => void;
}

// Initialize from localStorage
const getInitialDiscordAlertsEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem("discordAlertsEnabled");
    return stored !== null ? JSON.parse(stored) : true;
  } catch {
    return true;
  }
};

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      discordChannels: [],
      challenges: [],
      isLoading: false,
      error: null,
      discordAlertsEnabled: getInitialDiscordAlertsEnabled(),

      // TP Settings initial state
      tpSettings: DEFAULT_TP_SETTINGS,
      tpSettingsLoaded: false,

      // Simple setters
      setDiscordChannels: (channels) => set({ discordChannels: channels }),
      setChallenges: (challenges) => set({ challenges }),
      setDiscordAlertsEnabled: (enabled) => {
        // Persist to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("discordAlertsEnabled", JSON.stringify(enabled));
        }
        set({ discordAlertsEnabled: enabled });
      },

      // Discord operations
      loadDiscordChannels: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          const channelsData = await getDiscordChannels(userId);
          const mappedChannels: DiscordChannel[] = channelsData.map((ch) => ({
            id: ch.id,
            name: ch.name,
            webhookUrl: ch.webhook_url,
            createdAt: new Date(ch.created_at),
            description: ch.description,
            isActive: ch.is_active,
            isGlobalDefault: ch.is_global_default,
            isDefaultLoad: ch.is_default_load,
            isDefaultEnter: ch.is_default_enter,
            isDefaultExit: ch.is_default_exit,
            isDefaultUpdate: ch.is_default_update,
          }));

          set({ discordChannels: mappedChannels, isLoading: false });
        } catch (error) {
          console.error("[SettingsStore] Failed to load Discord channels:", error);
          set({ error: "Failed to load Discord channels", isLoading: false });
        }
      },

      createDiscordChannel: async (userId, name, webhookUrl, description) => {
        set({ isLoading: true, error: null });
        try {
          await addDiscordChannel(userId, name, webhookUrl, description);
          const channelsData = await getDiscordChannels(userId);
          const mappedChannels: DiscordChannel[] = channelsData.map((ch) => ({
            id: ch.id,
            name: ch.name,
            webhookUrl: ch.webhook_url,
            createdAt: new Date(ch.created_at),
            description: ch.description,
            isActive: ch.is_active,
            isGlobalDefault: ch.is_global_default,
            isDefaultLoad: ch.is_default_load,
            isDefaultEnter: ch.is_default_enter,
            isDefaultExit: ch.is_default_exit,
            isDefaultUpdate: ch.is_default_update,
          }));

          set({ discordChannels: mappedChannels, isLoading: false });
        } catch (error) {
          console.error("[SettingsStore] Failed to create Discord channel:", error);
          set({ error: "Failed to create Discord channel", isLoading: false });
        }
      },

      removeDiscordChannel: async (channelId) => {
        set({ isLoading: true, error: null });
        try {
          await deleteDiscordChannel(channelId);

          set((state) => ({
            discordChannels: state.discordChannels.filter((ch) => ch.id !== channelId),
            isLoading: false,
          }));
        } catch (error) {
          console.error("[SettingsStore] Failed to remove Discord channel:", error);
          set({ error: "Failed to remove Discord channel", isLoading: false });
        }
      },

      updateDiscordChannelSettings: async (channelId, updates) => {
        set({ isLoading: true, error: null });
        try {
          await updateDiscordChannel(channelId, updates as any);

          set((state) => ({
            discordChannels: state.discordChannels.map((ch) =>
              ch.id === channelId ? { ...ch, ...updates } : ch
            ),
            isLoading: false,
          }));
        } catch (error) {
          console.error("[SettingsStore] Failed to update Discord channel:", error);
          set({ error: "Failed to update Discord channel", isLoading: false });
        }
      },

      setDefaultChannel: async (userId, channelId) => {
        set({ isLoading: true, error: null });
        try {
          // Clear existing default and set new one
          // The database trigger will handle clearing other defaults
          await updateDiscordChannel(channelId, { is_global_default: true });

          // Update local state - clear all defaults and set the new one
          set((state) => ({
            discordChannels: state.discordChannels.map((ch) => ({
              ...ch,
              isGlobalDefault: ch.id === channelId,
            })),
            isLoading: false,
          }));
        } catch (error) {
          console.error("[SettingsStore] Failed to set default channel:", error);
          set({ error: "Failed to set default channel", isLoading: false });
        }
      },

      getGlobalDefaultChannel: () => {
        return get().discordChannels.find((ch) => ch.isGlobalDefault);
      },

      // Challenge operations
      loadChallenges: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          const challengesData = await getChallenges(userId);
          const mappedChallenges: Challenge[] = challengesData.map((ch) => ({
            id: ch.id,
            name: ch.name,
            description: ch.description,
            startingBalance: parseFloat(ch.starting_balance),
            currentBalance: parseFloat(ch.current_balance),
            targetBalance: parseFloat(ch.target_balance),
            startDate: ch.start_date,
            endDate: ch.end_date,
            isActive: ch.is_active,
            createdAt: new Date(ch.created_at),
          }));

          set({ challenges: mappedChallenges, isLoading: false });
        } catch (error) {
          console.error("[SettingsStore] Failed to load challenges:", error);
          set({ error: "Failed to load challenges", isLoading: false });
        }
      },

      createChallenge: async (userId, challenge) => {
        set({ isLoading: true, error: null });
        try {
          await addChallenge(userId, challenge as any);
          const challengesData = await getChallenges(userId);
          const mappedChallenges: Challenge[] = challengesData.map((ch) => ({
            id: ch.id,
            name: ch.name,
            description: ch.description,
            startingBalance: parseFloat(ch.starting_balance),
            currentBalance: parseFloat(ch.current_balance),
            targetBalance: parseFloat(ch.target_balance),
            startDate: ch.start_date,
            endDate: ch.end_date,
            isActive: ch.is_active,
            createdAt: new Date(ch.created_at),
          }));

          set({ challenges: mappedChallenges, isLoading: false });
        } catch (error) {
          console.error("[SettingsStore] Failed to create challenge:", error);
          set({ error: "Failed to create challenge", isLoading: false });
        }
      },

      removeChallenge: async (challengeId) => {
        set({ isLoading: true, error: null });
        try {
          await deleteChallenge(challengeId);

          set((state) => ({
            challenges: state.challenges.filter((ch) => ch.id !== challengeId),
            isLoading: false,
          }));
        } catch (error) {
          console.error("[SettingsStore] Failed to remove challenge:", error);
          set({ error: "Failed to remove challenge", isLoading: false });
        }
      },

      updateChallengeSettings: async (challengeId, updates) => {
        set({ isLoading: true, error: null });
        try {
          await updateChallenge(challengeId, updates as any);

          set((state) => ({
            challenges: state.challenges.map((ch) =>
              ch.id === challengeId ? { ...ch, ...updates } : ch
            ),
            isLoading: false,
          }));
        } catch (error) {
          console.error("[SettingsStore] Failed to update challenge:", error);
          set({ error: "Failed to update challenge", isLoading: false });
        }
      },

      // Utilities
      getChannelById: (channelId) => {
        return get().discordChannels.find((ch) => ch.id === channelId);
      },

      getChallengeById: (challengeId) => {
        return get().challenges.find((ch) => ch.id === challengeId);
      },

      getDefaultChannels: (type) => {
        const { discordChannels } = get();
        switch (type) {
          case "load":
            return discordChannels.filter((ch) => ch.isDefaultLoad && ch.isActive);
          case "enter":
            return discordChannels.filter((ch) => ch.isDefaultEnter && ch.isActive);
          case "exit":
            return discordChannels.filter((ch) => ch.isDefaultExit && ch.isActive);
          case "update":
            return discordChannels.filter((ch) => ch.isDefaultUpdate && ch.isActive);
          default:
            return [];
        }
      },

      getActiveChallenges: () => {
        return get().challenges.filter((ch) => ch.isActive);
      },

      // TP Settings operations
      loadTPSettings: async (userId) => {
        try {
          // Import supabase client dynamically to avoid circular dependencies
          const { createClient } = await import("../lib/supabase/client");
          const supabase = createClient();

          const { data, error } = await supabase
            .from("profiles")
            .select("tp_mode, tp_percent, sl_percent, tp_near_threshold, tp_auto_open_trim")
            .eq("id", userId)
            .single();

          if (error) {
            console.error("[SettingsStore] Failed to load TP settings:", error);
            return;
          }

          if (data) {
            const settings: TPSettings = {
              tpMode: (data.tp_mode as TPMode) || DEFAULT_TP_SETTINGS.tpMode,
              tpPercent: data.tp_percent ?? DEFAULT_TP_SETTINGS.tpPercent,
              slPercent: data.sl_percent ?? DEFAULT_TP_SETTINGS.slPercent,
              tpNearThreshold: data.tp_near_threshold ?? DEFAULT_TP_SETTINGS.tpNearThreshold,
              tpAutoOpenTrim: data.tp_auto_open_trim ?? DEFAULT_TP_SETTINGS.tpAutoOpenTrim,
            };
            set({ tpSettings: settings, tpSettingsLoaded: true });
          }
        } catch (error) {
          console.error("[SettingsStore] Error loading TP settings:", error);
        }
      },

      saveTPSettings: async (userId, settings) => {
        try {
          // Import supabase client dynamically to avoid circular dependencies
          const { createClient } = await import("../lib/supabase/client");
          const supabase = createClient();

          // Map to database column names
          const dbUpdates: Record<string, unknown> = {};
          if (settings.tpMode !== undefined) dbUpdates.tp_mode = settings.tpMode;
          if (settings.tpPercent !== undefined) dbUpdates.tp_percent = settings.tpPercent;
          if (settings.slPercent !== undefined) dbUpdates.sl_percent = settings.slPercent;
          if (settings.tpNearThreshold !== undefined)
            dbUpdates.tp_near_threshold = settings.tpNearThreshold;
          if (settings.tpAutoOpenTrim !== undefined)
            dbUpdates.tp_auto_open_trim = settings.tpAutoOpenTrim;

          const { error } = await supabase.from("profiles").update(dbUpdates).eq("id", userId);

          if (error) {
            console.error("[SettingsStore] Failed to save TP settings:", error);
            throw error;
          }

          // Update local state
          set((state) => ({
            tpSettings: { ...state.tpSettings, ...settings },
          }));
        } catch (error) {
          console.error("[SettingsStore] Error saving TP settings:", error);
          throw error;
        }
      },

      setTPSettings: (settings) => {
        set((state) => ({
          tpSettings: { ...state.tpSettings, ...settings },
        }));
      },

      // Reset
      reset: () =>
        set({
          discordChannels: [],
          challenges: [],
          isLoading: false,
          error: null,
          discordAlertsEnabled: true,
          tpSettings: DEFAULT_TP_SETTINGS,
          tpSettingsLoaded: false,
        }),
    }),
    { name: "SettingsStore" }
  )
);
