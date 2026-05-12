import { create } from 'zustand';
import type { AnalysisStatus, Game, Position, UserProfile } from './types';

export interface AnalysisProgress {
  done: number;
  total: number;
}

interface AppState {
  userProfile: UserProfile | null;
  currentGame: Game | null;
  currentPly: number;
  analysisProgress: AnalysisProgress | null;
  gameLibrary: Game[];
  hydrated: boolean;

  setCurrentGame: (game: Game | null) => void;
  setCurrentPly: (ply: number) => void;
  setAnalysisProgress: (progress: AnalysisProgress | null) => void;
  setAnalysisStatus: (status: AnalysisStatus) => void;
  updatePosition: (ply: number, patch: Partial<Position>) => void;
  setGameLibrary: (games: Game[]) => void;
  setHydrated: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userProfile: null,
  currentGame: null,
  currentPly: 0,
  analysisProgress: null,
  gameLibrary: [],
  hydrated: false,

  setCurrentGame: (game) =>
    set({ currentGame: game, currentPly: 0, analysisProgress: null }),
  setCurrentPly: (ply) => set({ currentPly: ply }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setAnalysisStatus: (status) =>
    set((s) =>
      s.currentGame
        ? { currentGame: { ...s.currentGame, analysisStatus: status } }
        : s,
    ),
  updatePosition: (ply, patch) =>
    set((s) => {
      if (!s.currentGame) return s;
      const positions = s.currentGame.positions.slice();
      positions[ply] = { ...positions[ply], ...patch };
      return { currentGame: { ...s.currentGame, positions } };
    }),
  setGameLibrary: (games) => set({ gameLibrary: games }),
  setHydrated: (value) => set({ hydrated: value }),
}));
