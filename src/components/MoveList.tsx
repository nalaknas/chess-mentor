import { useEffect } from 'react';
import { formatEval } from '../format';
import { useAppStore } from '../store';
import type { Classification } from '../types';

const BADGE: Record<Classification, { label: string; dot: string; text: string }> = {
  best:       { label: '',    dot: '',                       text: '' },
  good:       { label: '',    dot: '',                       text: '' },
  inaccuracy: { label: '?',   dot: 'bg-yellow-400',          text: 'text-yellow-700' },
  mistake:    { label: '?!',  dot: 'bg-orange-500',          text: 'text-orange-700' },
  blunder:    { label: '??',  dot: 'bg-red-500',             text: 'text-red-700' },
};

interface MoveCellData {
  ply: number;
  san: string;
  eval?: number;
  classification?: Classification;
}

export function MoveList() {
  const game = useAppStore((s) => s.currentGame);
  const currentPly = useAppStore((s) => s.currentPly);
  const setCurrentPly = useAppStore((s) => s.setCurrentPly);

  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (e.key === 'ArrowRight') {
        setCurrentPly(Math.min(currentPly + 1, game.positions.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentPly(Math.max(currentPly - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, currentPly, setCurrentPly]);

  if (!game) return null;

  const pairs: Array<{
    moveNumber: number;
    white?: MoveCellData;
    black?: MoveCellData;
  }> = [];
  for (let i = 1; i < game.positions.length; i++) {
    const pos = game.positions[i];
    if (!pos.moveSan) continue;
    const cell: MoveCellData = {
      ply: i,
      san: pos.moveSan,
      eval: pos.engineEval,
      classification: pos.classification,
    };
    const moveNumber = Math.ceil(i / 2);
    const side = i % 2 === 1 ? 'white' : 'black';
    if (side === 'white') {
      pairs.push({ moveNumber, white: cell });
    } else {
      const last = pairs[pairs.length - 1];
      if (last && last.moveNumber === moveNumber) {
        last.black = cell;
      } else {
        pairs.push({ moveNumber, black: cell });
      }
    }
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-2 gap-y-1 text-sm">
        {pairs.map(({ moveNumber, white, black }) => (
          <div key={moveNumber} className="contents">
            <div className="text-stone-400">{moveNumber}.</div>
            <MoveCell move={white} currentPly={currentPly} onClick={setCurrentPly} />
            <MoveCell move={black} currentPly={currentPly} onClick={setCurrentPly} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCell({
  move,
  currentPly,
  onClick,
}: {
  move?: MoveCellData;
  currentPly: number;
  onClick: (ply: number) => void;
}) {
  if (!move) return <div />;
  const active = move.ply === currentPly;
  const evalLabel = formatEval(move.eval);
  const badge = move.classification ? BADGE[move.classification] : undefined;
  return (
    <button
      type="button"
      onClick={() => onClick(move.ply)}
      className={
        'flex items-baseline justify-between rounded px-1.5 py-0.5 font-mono hover:bg-stone-100 ' +
        (active ? 'bg-amber-100 text-amber-900' : '')
      }
    >
      <span className="flex items-center gap-1">
        {badge?.dot && (
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dot}`}
            aria-hidden="true"
          />
        )}
        <span className={badge?.text ?? ''}>
          {move.san}
          {badge?.label}
        </span>
      </span>
      {evalLabel && (
        <span className="ml-2 text-[10px] font-normal text-stone-500">
          {evalLabel}
        </span>
      )}
    </button>
  );
}
