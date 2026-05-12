import { isMateScore, matePliesFrom } from './engine/stockfish';

export function formatEval(cp: number | undefined): string {
  if (cp === undefined) return '';
  if (isMateScore(cp)) {
    const plies = Math.abs(matePliesFrom(cp));
    return `${cp > 0 ? '' : '-'}M${plies}`;
  }
  const pawns = cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}
