import { useEffect, useState } from 'react';
import { AnalysisProgress } from './components/AnalysisProgress';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { FlipBoardButton } from './components/FlipBoardButton';
import { Header } from './components/Header';
import { LibraryList } from './components/LibraryList';
import { MoveList } from './components/MoveList';
import { PgnInput } from './components/PgnInput';
import { SidePane } from './components/SidePane';
import { hydrateFromDb } from './persistence';
import { useAppStore } from './store';
import type { Color } from './types';

const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function App() {
  const game = useAppStore((s) => s.currentGame);
  const ply = useAppStore((s) => s.currentPly);
  const position = game?.positions[ply];
  const fen = position?.fen ?? STARTING_FEN;

  // Board orientation is ephemeral UI state: defaults to the user's
  // color for this game, but the user can flip it any time to see
  // the position from the other side. Resets when the active game
  // changes.
  const [orientation, setOrientation] = useState<Color>('white');
  useEffect(() => {
    setOrientation(game?.userColor ?? 'white');
  }, [game?.id, game?.userColor]);

  useEffect(() => {
    void hydrateFromDb();
  }, []);

  // On a key moment, show the engine's best move from the position
  // BEFORE the user's move. That arrow tells the user "here's what
  // you should have played instead."
  const bestMoveArrow =
    position?.isKeyMoment && ply > 0
      ? game?.positions[ply - 1]?.engineBestMove
      : undefined;

  return (
    <div className="flex h-full flex-col bg-stone-50 text-stone-900">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:flex-row">
        <section
          aria-label="Board and move list"
          className="flex flex-1 flex-col gap-4"
        >
          {game && (
            <div className="flex items-center justify-end">
              <FlipBoardButton
                orientation={orientation}
                onFlip={() =>
                  setOrientation((o) => (o === 'white' ? 'black' : 'white'))
                }
              />
            </div>
          )}
          <div className="flex items-stretch justify-center gap-2">
            <EvalBar cp={position?.engineEval} />
            <Board
              fen={fen}
              orientation={orientation}
              bestMoveArrow={bestMoveArrow}
            />
          </div>
          <AnalysisProgress />
          {game ? (
            <MoveList />
          ) : (
            <div className="space-y-4">
              <PgnInput />
              <LibraryList />
            </div>
          )}
        </section>

        <SidePane />
      </main>
    </div>
  );
}

export default App;
