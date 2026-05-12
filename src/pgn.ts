import { Chess } from 'chess.js';
import type { GameResult, Position } from './types';

const ALLOWED_HEADERS = new Set([
  'Event',
  'Site',
  'Date',
  'Round',
  'White',
  'Black',
  'Result',
  'WhiteElo',
  'BlackElo',
  'TimeControl',
  'ECO',
]);

const RESULT_NORMALIZATION: Record<string, GameResult> = {
  '1.0': '1-0',
  '0.0': '0-1',
  '0.5': '1/2-1/2',
  '½-½': '1/2-1/2',
  '1/2': '1/2-1/2',
};

export function cleanPgn(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^\[([A-Za-z]+)\s+"(.*)"\]\s*$/);
    if (headerMatch) {
      const [, tag, valueRaw] = headerMatch;
      if (!ALLOWED_HEADERS.has(tag)) continue;
      let value = valueRaw;
      if (tag === 'Result') value = RESULT_NORMALIZATION[value] ?? value;
      out.push(`[${tag} "${value}"]`);
      continue;
    }
    out.push(line);
  }

  // Strip movetext annotations: {...} comments (incl. clock), and $N NAGs.
  let body = out.join('\n');
  body = body.replace(/\{[^}]*\}/g, '');
  body = body.replace(/\$\d+/g, '');
  body = body.replace(/[ \t]+/g, ' ');

  return body.trim();
}

export interface ParsedPgn {
  headers: Record<string, string>;
  positions: Position[];
}

export function parsePgn(raw: string): ParsedPgn {
  const cleaned = cleanPgn(raw);
  const chess = new Chess();
  chess.loadPgn(cleaned);

  const headers = chess.header() as Record<string, string>;
  const history = chess.history({ verbose: true });

  const replay = new Chess();
  const positions: Position[] = [
    { ply: 0, fen: replay.fen(), isKeyMoment: false },
  ];

  history.forEach((move, i) => {
    replay.move(move.san);
    positions.push({
      ply: i + 1,
      fen: replay.fen(),
      moveSan: move.san,
      moveUci: `${move.from}${move.to}${move.promotion ?? ''}`,
      isKeyMoment: false,
    });
  });

  return { headers, positions };
}
