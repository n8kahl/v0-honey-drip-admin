import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DiscordChannel, Challenge } from '../types';
import {
  getDiscordChannels,
  addDiscordChannel,
  deleteDiscordChannel,
  updateDiscordChannel,
  getChallenges,
  addChallenge,
  deleteChallenge,
  updateChallenge,
} from '../lib/supabase/database';

interface SettingsStore {
  // State
  discordChannels: DiscordChannel[];
  challenges: Challenge[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setDiscordChannels: (channels: DiscordChannel[]) => void;
  setChallenges: (challenges: Challenge[]) => void;
  
  // Discord operations
  loadDiscordChannels: (userId: string) => Promise<void>;
  createDiscordChannel: (userId: string, name: string, webhookUrl: string) => Promise<void>;
  removeDiscordChannel: (channelId: string) => Promise<void>;
  updateDiscordChannelSettings: (channelId: string, updates: Partial<DiscordChannel>) => Promise<void>;
  
  // Challenge operations
  loadChallenges: (userId: string) => Promise<void>;
  createChallenge: (userId: string, challenge: Partial<Challenge>) => Promise<void>;
  removeChallenge: (challengeId: string) => Promise<void>;
  updateChallengeSettings: (challengeId: string, updates: Partial<Challenge>) => Promise<void>;
  
  // Utilities
  getChannelById: (channelId: string) => DiscordChannel | undefined;
  getChallengeById: (challengeId: string) => Challenge | undefined;
  getDefaultChannels: (type: 'load' | 'enter' | 'exit' | 'update') => DiscordChannel[];
  getActiveChallenges: () => Challenge[];
  
  // Reset
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      discordChannels: [],
      challenges: [],
      isLoading: false,
      error: null,

      // Simple setters
      setDiscordChannels: (channels) => set({ discordChannels: channels }),
      setChallenges: (challenges) => set({ challenges }),

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
            isActive: ch.is_active,
            isDefaultLoad: ch.is_default_load,
            isDefaultEnter: ch.is_default_enter,
            isDefaultExit: ch.is_default_exit,
            isDefaultUpdate: ch.is_default_update,
          }));
          
          set({ discordChannels: mappedChannels, isLoading: false });
        } catch (error) {
          console.error('[SettingsStore] Failed to load Discord channels:', error);
          set({ error: 'Failed to load Discord channels', isLoading: false });
        }
      },

      createDiscordChannel: async (userId, name, webhookUrl) => {
        set({ isLoading: true, error: null });
        try {
          await addDiscordChannel(userId, name, webhookUrl);
          const channelsData = await getDiscordChannels(userId);
          const mappedChannels: DiscordChannel[] = channelsData.map((ch) => ({
            id: ch.id,
            name: ch.name,
            webhookUrl: ch.webhook_url,
            createdAt: new Date(ch.created_at),
            isActive: ch.is_active,
            isDefaultLoad: ch.is_default_load,
            isDefaultEnter: ch.is_default_enter,
            isDefaultExit: ch.is_default_exit,
            isDefaultUpdate: ch.is_default_update,
          }));
          
          set({ discordChannels: mappedChannels, isLoading: false });
        } catch (error) {
          console.error('[SettingsStore] Failed to create Discord channel:', error);
          set({ error: 'Failed to create Discord channel', isLoading: false });
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
          console.error('[SettingsStore] Failed to remove Discord channel:', error);
          set({ error: 'Failed to remove Discord channel', isLoading: false });
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
          console.error('[SettingsStore] Failed to update Discord channel:', error);
          set({ error: 'Failed to update Discord channel', isLoading: false });
        }
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
          console.error('[SettingsStore] Failed to load challenges:', error);
          set({ error: 'Failed to load challenges', isLoading: false });
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
          console.error('[SettingsStore] Failed to create challenge:', error);
          set({ error: 'Failed to create challenge', isLoading: false });
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
          console.error('[SettingsStore] Failed to remove challenge:', error);
          set({ error: 'Failed to remove challenge', isLoading: false });
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
          console.error('[SettingsStore] Failed to update challenge:', error);
          set({ error: 'Failed to update challenge', isLoading: false });
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
          case 'load':
            return discordChannels.filter((ch) => ch.isDefaultLoad && ch.isActive);
          case 'enter':
            return discordChannels.filter((ch) => ch.isDefaultEnter && ch.isActive);
          case 'exit':
            return discordChannels.filter((ch) => ch.isDefaultExit && ch.isActive);
          case 'update':
            return discordChannels.filter((ch) => ch.isDefaultUpdate && ch.isActive);
          default:
            return [];
        }
      },

      getActiveChallenges: () => {
        return get().challenges.filter((ch) => ch.isActive);
      },

      // Reset
      reset: () =>
        set({
          discordChannels: [],
          challenges: [],
          isLoading: false,
          error: null,
        }),
    }),
    { name: 'SettingsStore' }
  )
);
