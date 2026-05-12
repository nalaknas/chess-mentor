import { formatEval } from '../format';
import { useAppStore } from '../store';
import type { Classification } from '../types';

const CLASS_LABEL: Record<Classification, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

const CLASS_COLOR: Record<Classification, string> = {
  best: 'text-stone-700',
  good: 'text-stone-700',
  inaccuracy: 'text-yellow-700',
  mistake: 'text-orange-700',
  blunder: 'text-red-700',
};

export function SidePane() {
  const game = useAppStore((s) => s.currentGame);
  const ply = useAppStore((s) => s.currentPly);
  const position = game?.positions[ply];

  if (!game) {
    return (
      <aside
        aria-label="Analysis pane"
        className="rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-400 md:w-80"
      >
        Side pane
      </aside>
    );
  }

  // Phase 4 will replace this with Claude analysis. For now, surface
  // the classification + engine pick so CHE-9 / CHE-10 are testable.
  const isKey = position?.isKeyMoment;
  const cls = position?.classification;

  return (
    <aside
      aria-label="Analysis pane"
      className="space-y-3 rounded-md border border-stone-200 bg-white p-3 text-sm md:w-80"
    >
      <div>
        <div className="text-stone-900">
          {game.white} vs {game.black}
        </div>
        <div className="text-stone-500">Result: {game.result}</div>
        <div className="text-stone-500">Moves: {game.positions.length - 1}</div>
      </div>

      {position && (
        <div className="border-t border-stone-200 pt-3">
          <div className="text-xs uppercase tracking-wide text-stone-400">
            Move {ply > 0 ? Math.ceil(ply / 2) : '—'}
            {ply > 0 && (ply % 2 === 1 ? ' (White)' : ' (Black)')}
          </div>
          {position.moveSan ? (
            <div className="mt-1 font-mono text-base text-stone-900">
              {position.moveSan}
              {cls && (
                <span className={`ml-2 text-xs ${CLASS_COLOR[cls]}`}>
                  {CLASS_LABEL[cls]}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-stone-500">Starting position</div>
          )}

          {isKey && position.evalDrop !== undefined && (
            <div className="mt-2 text-xs text-stone-600">
              Lost {Math.round(position.evalDrop)}cp vs the engine's pick
              {position.engineBestMoveSan && (
                <>
                  : <span className="font-mono text-stone-900">{position.engineBestMoveSan}</span>
                  {position.engineEval !== undefined && (
                    <> ({formatEval(position.engineEval)} → engine line)</>
                  )}
                </>
              )}
              .
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
