import { ConversationView } from './ConversationView';
import { formatEval } from '../format';
import { useAppStore } from '../store';
import type { Classification } from '../types';

// Placeholder until the userProfile UI lands. Spec target user is 400-1800
// ELO; mid-beginner is a reasonable default and matches the spec's examples.
const DEFAULT_USER_ELO = 800;

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
  const previous = ply > 0 ? game?.positions[ply - 1] : undefined;

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
  // "What the user should have played" lives on the PREVIOUS position
  // (the position from which the user was about to move). The current
  // position's engineBestMove is the opponent's response to the
  // blunder — not what we want to surface.
  const alternativeSan = previous?.engineBestMoveSan;
  const evalBefore = previous?.engineEval;
  const evalAfter = position?.engineEval;

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
                <span className={`ml-2 font-sans text-xs ${CLASS_COLOR[cls]}`}>
                  {CLASS_LABEL[cls]}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-stone-500">Starting position</div>
          )}

          {isKey && position.evalDrop !== undefined && (
            <div className="mt-2 space-y-1 text-xs text-stone-600">
              <div>Lost {Math.round(position.evalDrop)}cp.</div>
              {alternativeSan && (
                <div>
                  Engine preferred:{' '}
                  <span className="font-mono text-stone-900">
                    {alternativeSan}
                  </span>
                  .
                </div>
              )}
              {evalBefore !== undefined && evalAfter !== undefined && (
                <div className="text-stone-500">
                  Eval: {formatEval(evalBefore)} → {formatEval(evalAfter)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isKey && (
        <ConversationView game={game} ply={ply} userElo={DEFAULT_USER_ELO} />
      )}
    </aside>
  );
}
