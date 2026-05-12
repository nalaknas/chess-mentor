import type { Color } from '../types';

interface FlipBoardButtonProps {
  orientation: Color;
  onFlip: () => void;
}

export function FlipBoardButton({ orientation, onFlip }: FlipBoardButtonProps) {
  const other: Color = orientation === 'white' ? 'black' : 'white';
  return (
    <button
      type="button"
      onClick={onFlip}
      className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-100"
      title={`Flip board to ${other}'s perspective`}
      aria-label={`Flip board to ${other}'s perspective`}
    >
      <span aria-hidden="true">⇅</span>
      <span>Flip</span>
    </button>
  );
}
