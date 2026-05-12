import { useAppStore } from '../store';
import type { Game } from '../types';
import { getEngine } from './stockfish';
import { uciToSan } from './utils';

const ENGINE_DEPTH = 18;

export async function analyzeGame(game: Game): Promise<void> {
  const engine = getEngine();
  const store = useAppStore;
  const total = game.positions.length;

  store.getState().setAnalysisProgress({ done: 0, total });

  for (let ply = 0; ply < total; ply++) {
    // Bail if the user moved on to a different game.
    if (store.getState().currentGame?.id !== game.id) return;

    const pos = game.positions[ply];
    const result = await engine.analyzePosition(pos.fen, ENGINE_DEPTH);

    // Stockfish reports `score cp / mate` from the side-to-move's POV.
    // Normalize to White's POV so the eval bar moves consistently with
    // material (positive = White better).
    const sideToMove = pos.fen.split(' ')[1];
    const evalWhitePov =
      sideToMove === 'b' ? -result.evalCp : result.evalCp;

    store.getState().updatePosition(ply, {
      engineEval: evalWhitePov,
      engineBestMove: result.bestMove,
      engineBestMoveSan: uciToSan(pos.fen, result.bestMove),
      enginePv: result.pv,
    });

    store.getState().setAnalysisProgress({ done: ply + 1, total });
  }

  store.getState().setAnalysisStatus('engine_done');
  store.getState().setAnalysisProgress(null);
}
