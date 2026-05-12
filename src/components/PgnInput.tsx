import { useState } from 'react';
import { analyzeGame } from '../engine/analyze';
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
        userColor: defaultColor,
        importedAt: Date.now(),
        analysisStatus: 'pending',
        positions,
      };
      setCurrentGame(game);
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
      <button
        type="button"
        onClick={onAnalyze}
        disabled={!text.trim()}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        Analyze
      </button>
    </div>
  );
}
