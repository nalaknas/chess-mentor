import { create } from 'zustand';
import type { Game, UserProfile } from './types';

interface AppState {
  userProfile: UserProfile | null;
  currentGame: Game | null;
  currentPly: number;

  setCurrentGame: (game: Game | null) => void;
  setCurrentPly: (ply: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userProfile: null,
  currentGame: null,
  currentPly: 0,

  setCurrentGame: (game) => set({ currentGame: game, currentPly: 0 }),
  setCurrentPly: (ply) => set({ currentPly: ply }),
}));
