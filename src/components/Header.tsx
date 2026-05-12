import { useRef } from 'react';
import { exportBackup, importBackup } from '../persistence';
import { useAppStore } from '../store';

export function Header() {
  const currentGame = useAppStore((s) => s.currentGame);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onImportClick = () => fileInputRef.current?.click();

  const onImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importBackup(file);
      window.alert(
        `Imported ${result.games} game${result.games === 1 ? '' : 's'} ` +
          `(+${result.analyses} analyses, +${result.conversations} conversations).`,
      );
    } catch (err) {
      console.error('Import failed:', err);
      window.alert(`Import failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Chess Mentor</h1>
        {currentGame && (
          <button
            type="button"
            onClick={() => setCurrentGame(null)}
            className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-100"
          >
            New game
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-stone-500">
        <button
          type="button"
          onClick={exportBackup}
          className="hover:text-stone-800"
          title="Export all games + analyses as JSON"
        >
          Export
        </button>
        <button
          type="button"
          onClick={onImportClick}
          className="hover:text-stone-800"
          title="Restore from a previously-exported JSON backup"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportChange}
        />
        <span>ELO —</span>
      </div>
    </header>
  );
}
