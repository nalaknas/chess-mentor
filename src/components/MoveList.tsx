import { useEffect } from 'react';
import { formatEval } from '../format';
import { useAppStore } from '../store';

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

  // Group moves into [whiteMove, blackMove] pairs by full-move number.
  type MoveCellData = { ply: number; san: string; eval?: number };
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
  move?: { ply: number; san: string; eval?: number };
  currentPly: number;
  onClick: (ply: number) => void;
}) {
  if (!move) return <div />;
  const active = move.ply === currentPly;
  const evalLabel = formatEval(move.eval);
  return (
    <button
      type="button"
      onClick={() => onClick(move.ply)}
      className={
        'flex items-baseline justify-between rounded px-1.5 py-0.5 font-mono hover:bg-stone-100 ' +
        (active ? 'bg-amber-100 text-amber-900' : '')
      }
    >
      <span>{move.san}</span>
      {evalLabel && (
        <span className="ml-2 text-[10px] font-normal text-stone-500">
          {evalLabel}
        </span>
      )}
    </button>
  );
}
