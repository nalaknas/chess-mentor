import { isMateScore, matePliesFrom } from '../engine/stockfish';

interface EvalBarProps {
  cp?: number;
  // Side to move at this position. Engine reports eval from White's
  // perspective; we only need this for the optional "from-user-POV" hint.
}

// Clamp to ±5 pawns for the visual fill; anything beyond is "winning".
const CLAMP_CP = 500;

export function EvalBar({ cp }: EvalBarProps) {
  if (cp === undefined) {
    return (
      <div className="flex h-full w-3 flex-col overflow-hidden rounded-sm border border-stone-200 bg-stone-100" />
    );
  }

  let whitePct = 50;
  let label: string;

  if (isMateScore(cp)) {
    whitePct = cp > 0 ? 100 : 0;
    const plies = Math.abs(matePliesFrom(cp));
    label = `${cp > 0 ? '' : '-'}M${plies}`;
  } else {
    const clamped = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, cp));
    whitePct = 50 + (clamped / CLAMP_CP) * 50;
    const pawns = cp / 100;
    label = `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
  }

  return (
    <div
      className="relative flex h-full w-6 flex-col overflow-hidden rounded-sm border border-stone-300 bg-stone-900"
      aria-label={`Engine eval: ${label}`}
    >
      <div className="flex-1" />
      <div
        className="bg-white transition-all duration-200"
        style={{ height: `${whitePct}%` }}
      />
      <div className="absolute inset-x-0 top-1 text-center text-[10px] font-medium text-white">
        {cp < 0 ? label : ''}
      </div>
      <div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-stone-900">
        {cp >= 0 ? label : ''}
      </div>
    </div>
  );
}
