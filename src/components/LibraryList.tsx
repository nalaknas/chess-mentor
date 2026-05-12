import { deleteGame } from '../persistence';
import { useAppStore } from '../store';
import type { Game } from '../types';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LibraryList() {
  const library = useAppStore((s) => s.gameLibrary);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  if (library.length === 0) return null;

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
        Library
      </div>
      <ul className="divide-y divide-stone-100">
        {library.map((game) => (
          <li key={game.id} className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => setCurrentGame(game)}
              className="flex flex-1 flex-col text-left hover:text-amber-700"
            >
              <span className="text-sm font-medium text-stone-900">
                {game.white} vs {game.black}
              </span>
              <span className="text-xs text-stone-500">
                {game.result} · {game.positions.length - 1} moves ·{' '}
                {formatDate(game.importedAt)}
                {game.analysisStatus !== 'engine_done' && (
                  <span className="ml-1 text-amber-600">
                    · analysis incomplete
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete ${game.white} vs ${game.black}?`)) {
                  void deleteGameAndClear(game);
                }
              }}
              className="ml-3 text-xs text-stone-400 hover:text-red-600"
              aria-label="Delete game"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function deleteGameAndClear(game: Game) {
  await deleteGame(game.id);
  const store = useAppStore.getState();
  if (store.currentGame?.id === game.id) {
    store.setCurrentGame(null);
  }
}
