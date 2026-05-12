import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';

interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
}

export function Board({ fen, orientation = 'white' }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    apiRef.current = Chessground(containerRef.current, {
      fen,
      orientation,
      viewOnly: true,
      coordinates: true,
    });
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.set({ fen, orientation });
  }, [fen, orientation]);

  return (
    <div className="aspect-square w-full max-w-lg self-center">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
