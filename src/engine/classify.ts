// Move classification from engine evals. Evals are White-POV
// centipawns (mate scores already mapped to ±MATE_SCORE — see
// stockfish.ts). evalDrop is positive when the move hurt the side
// that played it, regardless of color.

import type { Classification } from '../types';

export interface ClassifyArgs {
  /** White-POV eval BEFORE the move (centipawns). */
  evalBefore: number;
  /** White-POV eval AFTER the move (centipawns). */
  evalAfter: number;
  /** 1-indexed ply: 1,3,5... = White moved; 2,4,6... = Black moved. */
  ply: number;
}

export interface ClassifyResult {
  /** Centipawns lost from the mover's perspective. Negative = move improved their position. */
  evalDrop: number;
  classification: Classification;
  isKeyMoment: boolean;
}

const CP = {
  best: 5,         // played the engine's pick (or within rounding)
  inaccuracy: 30,  // < this is "good"
  mistake: 80,     // <inaccuracy threshold> .. this is "inaccuracy"
  blunder: 200,    // <mistake threshold> .. this is "mistake"; >= this is "blunder"
} as const;

export function classify({
  evalBefore,
  evalAfter,
  ply,
}: ClassifyArgs): ClassifyResult {
  const isWhiteMove = ply % 2 === 1;
  // Flip so positive = mover lost ground. No special-casing for
  // mate scores needed: they're encoded near ±30000, so transitions
  // into/out of forced mate produce massive drops that land in the
  // blunder bucket naturally.
  const evalDrop = isWhiteMove
    ? evalBefore - evalAfter
    : evalAfter - evalBefore;

  let classification: Classification;
  if (evalDrop < CP.best) {
    classification = 'best';
  } else if (evalDrop < CP.inaccuracy) {
    classification = 'good';
  } else if (evalDrop < CP.mistake) {
    classification = 'inaccuracy';
  } else if (evalDrop < CP.blunder) {
    classification = 'mistake';
  } else {
    classification = 'blunder';
  }

  const isKeyMoment =
    classification === 'inaccuracy' ||
    classification === 'mistake' ||
    classification === 'blunder';

  return { evalDrop, classification, isKeyMoment };
}
