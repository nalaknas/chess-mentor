import { useState } from 'react';
import { analyzeGame } from '../engine/analyze';
import { refreshLibrary, saveGame } from '../persistence';
import { parsePgn } from '../pgn';
import { useAppStore } from '../store';
import type { Color, Game, GameResult, GameSource } from '../types';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface PgnInputProps {
  defaultColor?: Color;
  source?: GameSource;
}

export function PgnInput({ defaultColor = 'white', source = 'paste' }: PgnInputProps) {
  const [text, setText] = useState('');
  const [userColor, setUserColor] = useState<Color>(defaultColor);
  const [error, setError] = useState<string | null>(null);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  const onAnalyze = () => {
    setError(null);
    try {
      const { headers, positions } = parsePgn(text);
      const game: Game = {
        id: uuid(),
        pgn: text,
        white: headers.White ?? 'White',
        black: headers.Black ?? 'Black',
        result: (headers.Result as GameResult) ?? '*',
        date: headers.Date ?? '',
        source,
        userColor,
        importedAt: Date.now(),
        analysisStatus: 'pending',
        positions,
      };
      setCurrentGame(game);
      // Persist immediately so the game survives a reload even if
      // analysis is interrupted mid-pass.
      void saveGame(game).then(refreshLibrary);
      // Kick off engine analysis in the background; the UI stays
      // navigable while evals stream in.
      void analyzeGame(game);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse PGN');
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a PGN here..."
        rows={6}
        className="w-full resize-y rounded-md border border-stone-300 bg-white p-2 font-mono text-sm focus:border-amber-500 focus:outline-none"
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <span>You played:</span>
          <ColorToggle value={userColor} onChange={setUserColor} />
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!text.trim()}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Analyze
        </button>
      </div>
    </div>
  );
}

function ColorToggle({
  value,
  onChange,
}: {
  value: Color;
  onChange: (c: Color) => void;
}) {
  const base =
    'rounded px-2 py-0.5 text-xs font-medium border transition-colors';
  const active = 'border-stone-900 bg-stone-900 text-white';
  const inactive = 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100';
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange('white')}
        className={`${base} ${value === 'white' ? active : inactive}`}
        aria-pressed={value === 'white'}
      >
        ⚪ White
      </button>
      <button
        type="button"
        onClick={() => onChange('black')}
        className={`${base} ${value === 'black' ? active : inactive}`}
        aria-pressed={value === 'black'}
      >
        ⚫ Black
      </button>
    </div>
  );
}
