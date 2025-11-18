import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Trade } from '../types';

type AppTab = 'live' | 'active' | 'history' | 'settings';
type VoiceState = 'idle' | 'listening' | 'processing';

interface UIStore {
  // State
  activeTab: AppTab;
  showDiscordDialog: boolean;
  showAddTickerDialog: boolean;
  showAddChallengeDialog: boolean;
  voiceActive: boolean;
  voiceState: VoiceState;
  focusedTrade: Trade | null;
  flashTradeTab: boolean;
  
  // Actions
  setActiveTab: (tab: AppTab) => void;
  setShowDiscordDialog: (show: boolean) => void;
  setShowAddTickerDialog: (show: boolean) => void;
  setShowAddChallengeDialog: (show: boolean) => void;
  setVoiceActive: (active: boolean) => void;
  setVoiceState: (state: VoiceState) => void;
  setFocusedTrade: (trade: Trade | null) => void;
  setFlashTradeTab: (flash: boolean) => void;
  
  // Compound actions
  toggleVoice: () => void;
  openDiscordSettings: () => void;
  closeDiscordSettings: () => void;
  openAddTicker: () => void;
  closeAddTicker: () => void;
  openAddChallenge: () => void;
  closeAddChallenge: () => void;
  closeAllDialogs: () => void;
  
  // Navigation helpers
  navigateToLive: () => void;
  navigateToActive: () => void;
  navigateToHistory: () => void;
  navigateToSettings: () => void;
  focusTradeInLive: (trade: Trade) => void;
  
  // Reset
  reset: () => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      activeTab: 'live',
      showDiscordDialog: false,
      showAddTickerDialog: false,
      showAddChallengeDialog: false,
      voiceActive: false,
      voiceState: 'idle',
      focusedTrade: null,
      flashTradeTab: false,

      // Simple setters
      setActiveTab: (tab) => set({ activeTab: tab }),
      setShowDiscordDialog: (show) => set({ showDiscordDialog: show }),
      setShowAddTickerDialog: (show) => set({ showAddTickerDialog: show }),
      setShowAddChallengeDialog: (show) => set({ showAddChallengeDialog: show }),
      setVoiceActive: (active) => set({ voiceActive: active }),
      setVoiceState: (state) => set({ voiceState: state }),
      setFocusedTrade: (trade) => set({ focusedTrade: trade }),
      setFlashTradeTab: (flash) => set({ flashTradeTab: flash }),

      // Compound actions
      toggleVoice: () => {
        const { voiceActive } = get();
        set({
          voiceActive: !voiceActive,
          voiceState: !voiceActive ? 'listening' : 'idle',
        });
      },

      openDiscordSettings: () => set({ showDiscordDialog: true }),
      closeDiscordSettings: () => set({ showDiscordDialog: false }),
      
      openAddTicker: () => set({ showAddTickerDialog: true }),
      closeAddTicker: () => set({ showAddTickerDialog: false }),
      
      openAddChallenge: () => set({ showAddChallengeDialog: true }),
      closeAddChallenge: () => set({ showAddChallengeDialog: false }),
      
      closeAllDialogs: () =>
        set({
          showDiscordDialog: false,
          showAddTickerDialog: false,
          showAddChallengeDialog: false,
        }),

      // Navigation helpers
      navigateToLive: () => set({ activeTab: 'live', focusedTrade: null }),
      
      navigateToActive: () => {
        set({ activeTab: 'active', flashTradeTab: true });
        setTimeout(() => set({ flashTradeTab: false }), 2000);
      },
      
      navigateToHistory: () => set({ activeTab: 'history' }),
      navigateToSettings: () => set({ activeTab: 'settings' }),
      
      focusTradeInLive: (trade) => {
        set({
          activeTab: 'live',
          focusedTrade: trade,
        });
        // Clear focus after a brief moment to allow component to react
        setTimeout(() => set({ focusedTrade: null }), 100);
      },

      // Reset
      reset: () =>
        set({
          activeTab: 'live',
          showDiscordDialog: false,
          showAddTickerDialog: false,
          showAddChallengeDialog: false,
          voiceActive: false,
          voiceState: 'idle',
          focusedTrade: null,
          flashTradeTab: false,
        }),
    }),
    { name: 'UIStore' }
  )
);
