import { Chess } from 'chess.js';

export function uciToSan(fen: string, uci: string): string | undefined {
  if (!uci || uci.length < 4) return undefined;
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    return move?.san;
  } catch {
    return undefined;
  }
}
