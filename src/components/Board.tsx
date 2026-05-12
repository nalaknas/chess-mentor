import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';

interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** Optional UCI move (e.g. 'e2e4') drawn as a green arrow on the board. */
  bestMoveArrow?: string;
}

function uciToShape(uci?: string): DrawShape[] {
  if (!uci || uci.length < 4) return [];
  const orig = uci.slice(0, 2);
  const dest = uci.slice(2, 4);
  return [
    {
      orig: orig as DrawShape['orig'],
      dest: dest as DrawShape['dest'],
      brush: 'green',
    },
  ];
}

export function Board({ fen, orientation = 'white', bestMoveArrow }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    apiRef.current = Chessground(containerRef.current, {
      fen,
      orientation,
      viewOnly: true,
      coordinates: true,
      drawable: { enabled: false, visible: true },
    });
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.set({ fen, orientation });
    // `set({ orientation })` redraws and clears existing shapes —
    // re-apply the engine arrow immediately so flipping the board
    // doesn't drop it.
    apiRef.current?.setShapes(uciToShape(bestMoveArrow));
  }, [fen, orientation, bestMoveArrow]);

  return (
    <div className="aspect-square w-full max-w-lg self-center">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
