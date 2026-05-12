import { AnalysisProgress } from './components/AnalysisProgress';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';
import { PgnInput } from './components/PgnInput';
import { useAppStore } from './store';

const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function App() {
  const game = useAppStore((s) => s.currentGame);
  const ply = useAppStore((s) => s.currentPly);
  const position = game?.positions[ply];
  const fen = position?.fen ?? STARTING_FEN;

  return (
    <div className="flex h-full flex-col bg-stone-50 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Chess Mentor</h1>
        <div className="text-sm text-stone-500">ELO —</div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:flex-row">
        <section
          aria-label="Board and move list"
          className="flex flex-1 flex-col gap-4"
        >
          <div className="flex items-stretch justify-center gap-2">
            <EvalBar cp={position?.engineEval} />
            <Board fen={fen} orientation={game?.userColor ?? 'white'} />
          </div>
          <AnalysisProgress />
          {game ? <MoveList /> : <PgnInput />}
        </section>

        <aside
          aria-label="Analysis pane"
          className="rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-400 md:w-80"
        >
          {game ? (
            <div className="space-y-1">
              <div className="text-stone-900">
                {game.white} vs {game.black}
              </div>
              <div>Result: {game.result}</div>
              <div>Moves: {game.positions.length - 1}</div>
            </div>
          ) : (
            'Side pane'
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
