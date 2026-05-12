// Glue between the Zustand store and Dexie/IndexedDB. The store stays
// pure (UI-driven); functions here orchestrate read/write to the DB
// and refresh the library.

import { db } from './db';
import { analyzeGame } from './engine/analyze';
import { useAppStore } from './store';
import type {
  Analysis,
  Conversation,
  Game,
  UserProfile,
} from './types';

export interface ImportResult {
  games: number;
  analyses: number;
  conversations: number;
}

/** Save a game (and its updated positions) to IndexedDB. */
export async function saveGame(game: Game): Promise<void> {
  await db.games.put(game);
}

/**
 * Load all games from IndexedDB on app boot. Sets the most recent
 * game as currentGame so a reload restores state. If that game's
 * engine analysis was incomplete, resume it.
 */
export async function hydrateFromDb(): Promise<void> {
  const store = useAppStore;
  if (store.getState().hydrated) return;

  const games = await db.games.orderBy('importedAt').reverse().toArray();
  store.getState().setGameLibrary(games);

  const mostRecent = games[0];
  if (mostRecent) {
    store.getState().setCurrentGame(mostRecent);
    if (mostRecent.analysisStatus !== 'engine_done') {
      // Resume: analyzeGame skips plies that already have engineEval.
      void analyzeGame(mostRecent);
    }
  }

  store.getState().setHydrated(true);
}

/** Refresh the library list from disk (after a new import or backup). */
export async function refreshLibrary(): Promise<void> {
  const games = await db.games.orderBy('importedAt').reverse().toArray();
  useAppStore.getState().setGameLibrary(games);
}

/** Remove a game (and its analyses/conversations) from disk. */
export async function deleteGame(gameId: string): Promise<void> {
  await db.transaction('rw', [db.games, db.analyses, db.conversations], async () => {
    await db.games.delete(gameId);
    await db.analyses.where('gameId').equals(gameId).delete();
    await db.conversations.where('gameId').equals(gameId).delete();
  });
  await refreshLibrary();
}

// ─── Analyses ──────────────────────────────────────────────────────

/** Stable id so put() upserts deterministically per (gameId, ply). */
export function analysisId(gameId: string, ply: number): string {
  return `${gameId}-ply${ply}`;
}

export async function getAnalysis(
  gameId: string,
  ply: number,
): Promise<Analysis | undefined> {
  return db.analyses.where('[gameId+ply]').equals([gameId, ply]).first();
}

export async function saveAnalysis(analysis: Analysis): Promise<void> {
  await db.analyses.put(analysis);
}

// ─── Backup / restore ──────────────────────────────────────────────

export interface BackupFile {
  version: 1;
  exportedAt: number;
  userProfile: UserProfile[];
  games: Game[];
  analyses: Analysis[];
  conversations: Conversation[];
}

export async function exportBackup(): Promise<void> {
  const data: BackupFile = {
    version: 1,
    exportedAt: Date.now(),
    userProfile: await db.userProfile.toArray(),
    games: await db.games.toArray(),
    analyses: await db.analyses.toArray(),
    conversations: await db.conversations.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chess-mentor-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text();
  let parsed: Partial<BackupFile>;
  try {
    parsed = JSON.parse(text) as Partial<BackupFile>;
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (parsed.version !== 1) {
    throw new Error(
      `Unsupported backup version: ${parsed.version}. Expected 1.`,
    );
  }
  if (!Array.isArray(parsed.games)) {
    throw new Error('Backup is missing the `games` array');
  }

  await db.transaction(
    'rw',
    [db.userProfile, db.games, db.analyses, db.conversations],
    async () => {
      await db.userProfile.clear();
      await db.games.clear();
      await db.analyses.clear();
      await db.conversations.clear();
      if (parsed.userProfile?.length) await db.userProfile.bulkAdd(parsed.userProfile);
      if (parsed.games?.length) await db.games.bulkAdd(parsed.games);
      if (parsed.analyses?.length) await db.analyses.bulkAdd(parsed.analyses);
      if (parsed.conversations?.length) await db.conversations.bulkAdd(parsed.conversations);
    },
  );

  // Replace in-memory state with what's now on disk. The stale
  // `currentGame` reference was making it look like nothing happened.
  const store = useAppStore.getState();
  store.setCurrentGame(null);
  await refreshLibrary();
  const games = useAppStore.getState().gameLibrary;
  if (games.length > 0) {
    useAppStore.getState().setCurrentGame(games[0]);
  }

  return {
    games: parsed.games?.length ?? 0,
    analyses: parsed.analyses?.length ?? 0,
    conversations: parsed.conversations?.length ?? 0,
  };
}
