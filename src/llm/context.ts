// Per spec section 7: the static + position-specific context bundle
// that gets sent to Claude. For initial analysis (CHE-13) the
// `messages` and `recentThemes` fields aren't used yet — they come
// into play in Phase 5 (conversational mode) and Phase 6 (theme
// callbacks). They're typed here so the shape stays stable.

import type { Classification, Color, Game, ThemeTag } from '../types';

export interface ConversationContext {
  userElo: number;
  teachingElo: number;

  game: {
    white: string;
    black: string;
    userColor: Color;
  };

  ply: number;
  /** The position the user was about to move FROM (before the mistake). */
  fen: string;
  moveHistory: string[];
  userMove: string;
  /** Who actually played `userMove` (1,3,5,... = white; 2,4,... = black). */
  moverColor: Color;

  engineAnalysis: {
    bestMove: string;
    bestMoveSan: string;
    eval: number;
    pv: string[];
  };

  evalDrop: number;
  classification: Classification;

  recentThemes: ThemeTag[];
}

export interface BuildContextArgs {
  game: Game;
  ply: number;
  userElo: number;
  recentThemes?: ThemeTag[];
}

/**
 * Assemble a ConversationContext for a single key-moment ply.
 * Returns null if the position isn't ready (missing engine data or
 * not a real move).
 */
export function buildContext(args: BuildContextArgs): ConversationContext | null {
  const { game, ply, userElo, recentThemes = [] } = args;
  if (ply <= 0) return null;

  const position = game.positions[ply];
  const prev = game.positions[ply - 1];
  if (!position?.moveSan || !position.classification || !prev) return null;
  if (
    prev.engineEval === undefined ||
    !prev.engineBestMove ||
    !prev.engineBestMoveSan
  ) {
    return null;
  }

  const moveHistory = game.positions
    .slice(1, ply + 1)
    .map((p) => p.moveSan)
    .filter((san): san is string => Boolean(san));

  const moverColor: Color = ply % 2 === 1 ? 'white' : 'black';

  return {
    userElo,
    teachingElo: userElo + 150,
    game: {
      white: game.white,
      black: game.black,
      userColor: game.userColor,
    },
    ply,
    fen: prev.fen,
    moveHistory,
    userMove: position.moveSan,
    moverColor,
    engineAnalysis: {
      bestMove: prev.engineBestMove,
      bestMoveSan: prev.engineBestMoveSan,
      eval: prev.engineEval,
      pv: prev.enginePv ?? [],
    },
    evalDrop: position.evalDrop ?? 0,
    classification: position.classification,
    recentThemes,
  };
}
