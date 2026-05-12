// The single tool Claude can call during a conversation: ask Stockfish
// "what happens if this move is played from this position?" Returns
// shaped results — legal/illegal, eval after, the engine's response,
// short PV. Spec section 7.

import { Chess } from 'chess.js';
import { getEngine, isMateScore, matePliesFrom } from '../engine/stockfish';
import { uciToSan } from '../engine/utils';

const TOOL_DEPTH = 15; // ~3-4× faster than depth 18 and still strong.
const MATE_SCORE = 30000;

export const EVALUATE_MOVE_TOOL = {
  name: 'evaluate_move' as const,
  description:
    "Evaluate what happens after a specific move is played from the given position. " +
    'Use this whenever the user asks "what about X?" or "why not Y?" or any time you ' +
    'want to verify a concrete line before explaining it. NEVER guess at evaluations — ' +
    'always call this tool first.',
  input_schema: {
    type: 'object',
    properties: {
      fen: {
        type: 'string',
        description: 'The position to evaluate FROM (the FEN before the candidate move is played).',
      },
      move: {
        type: 'string',
        description: 'The candidate move in SAN (preferred, e.g. "Nf3", "Bb1", "O-O") or UCI ("g1f3", "e1g1").',
      },
    },
    required: ['fen', 'move'],
  },
};

export interface EvaluateMoveInput {
  fen: string;
  move: string;
}

export interface EvaluateMoveResult {
  legal: boolean;
  error?: string;
  /** SAN of the move actually applied (canonicalized from sloppy input). */
  moveSan?: string;
  /** White-POV centipawns at the position AFTER the move. */
  evalAfter?: number;
  /** Pretty label for evalAfter ("+0.8", "-M3"). */
  evalAfterLabel?: string;
  /** Mover's POV delta: positive = move worsened the mover's position. */
  evalDelta?: number;
  /** SAN of the engine's preferred response from the resulting position. */
  bestResponse?: string;
  /** Short PV in SAN, up to 4 plies. */
  pv?: string[];
  /** One-line summary of what just happened. */
  shortAssessment?: string;
}

export async function executeEvaluateMove(
  input: EvaluateMoveInput,
): Promise<EvaluateMoveResult> {
  // 1. Validate + apply the move
  let chess: Chess;
  let applied: ReturnType<Chess['move']>;
  try {
    chess = new Chess(input.fen);
  } catch (err) {
    return {
      legal: false,
      error: `Invalid FEN: ${err instanceof Error ? err.message : err}`,
    };
  }

  try {
    applied = parseMove(chess, input.move);
  } catch {
    return {
      legal: false,
      error: `"${input.move}" is not a legal move from this position`,
    };
  }
  if (!applied) {
    return {
      legal: false,
      error: `"${input.move}" is not a legal move from this position`,
    };
  }

  // 2. Get eval BEFORE the move (so we can compute delta). Faster than
  //    a full depth-18 pass since the position is likely already cached
  //    by the engine, but we call it explicitly to be safe.
  const engine = getEngine();
  const before = await engine.analyzePosition(input.fen, TOOL_DEPTH);

  // 3. Get eval AFTER the move
  const newFen = chess.fen();
  const after = await engine.analyzePosition(newFen, TOOL_DEPTH);

  // 4. Normalize both evals to White's POV
  const sideAtBefore = input.fen.split(' ')[1]; // who was about to move
  const sideAtAfter = newFen.split(' ')[1];
  const evalBeforeWhite = sideAtBefore === 'b' ? -before.evalCp : before.evalCp;
  const evalAfterWhite = sideAtAfter === 'b' ? -after.evalCp : after.evalCp;

  // 5. Compute delta from MOVER's POV. The mover is `sideAtBefore`.
  const evalDelta =
    sideAtBefore === 'w'
      ? evalBeforeWhite - evalAfterWhite
      : evalAfterWhite - evalBeforeWhite;

  // 6. Engine's best response + short PV in SAN
  const bestResponseSan = after.bestMove
    ? uciToSan(newFen, after.bestMove)
    : undefined;
  const pvSan = pvToSan(newFen, after.pv).slice(0, 4);

  return {
    legal: true,
    moveSan: applied.san,
    evalAfter: evalAfterWhite,
    evalAfterLabel: formatEval(evalAfterWhite),
    evalDelta,
    bestResponse: bestResponseSan,
    pv: pvSan,
    shortAssessment: describeOutcome(evalDelta, evalAfterWhite),
  };
}

// ─── Internals ─────────────────────────────────────────────────────

function parseMove(chess: Chess, raw: string): ReturnType<Chess['move']> {
  const trimmed = raw.trim();
  // UCI: 4-5 chars matching [a-h][1-8][a-h][1-8][qrbn]?
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(trimmed)) {
    return chess.move({
      from: trimmed.slice(0, 2),
      to: trimmed.slice(2, 4),
      promotion: trimmed.length > 4 ? trimmed[4].toLowerCase() : undefined,
    });
  }
  // SAN (chess.js handles most casings + variants natively)
  return chess.move(trimmed);
}

function pvToSan(startingFen: string, uciPv: string[]): string[] {
  if (!uciPv.length) return [];
  try {
    const chess = new Chess(startingFen);
    const out: string[] = [];
    for (const uci of uciPv) {
      if (uci.length < 4) break;
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!move) break;
      out.push(move.san);
    }
    return out;
  } catch {
    return [];
  }
}

function formatEval(cp: number): string {
  if (isMateScore(cp)) {
    const plies = Math.abs(matePliesFrom(cp));
    return `${cp > 0 ? '' : '-'}M${plies}`;
  }
  const pawns = cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

function describeOutcome(delta: number, evalAfterWhite: number): string {
  if (isMateScore(evalAfterWhite)) {
    const winning = evalAfterWhite > 0;
    return winning ? 'leads to a forced mate for White' : 'gets mated';
  }
  if (Math.abs(delta) < 30) return 'about even with the engine line';
  if (delta >= 200) return 'loses material or runs into a tactic';
  if (delta >= 80) return 'gives up an important advantage';
  if (delta >= 30) return 'slightly weaker than the engine line';
  if (delta <= -200) return 'is actually winning material';
  if (delta <= -80) return 'is an improvement on the engine line';
  return 'about even with the engine line';
}
// Hint about MATE_SCORE so the symbol is referenced (kept for clarity
// even though isMateScore wraps the threshold check internally).
void MATE_SCORE;
