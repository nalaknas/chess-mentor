// Phase 1 smoke test (CHE-39): parse the sample PGN from spec section 16
// and verify the move list lines up.
import { parsePgn } from '../src/pgn';

const SAMPLE = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2025.10.16"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[WhiteElo "447"]
[BlackElo "442"]
[ECO "C50"]
[Termination "Player1 won by resignation"]
[EndTime "12:34:56"]
[Link "https://www.chess.com/game/live/12345"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. O-O d6 6. Ng5 Be6 7. Nxe6 fxe6 8.
Bxe6 Nd4 9. Bc4 a6 10. Bg5 b5 11. Bxf6 Qxf6 12. Bb3 Ne6 13. c4 Qg6 14. Nc3 Nf4
15. g3 Nh3+ 16. Kh1 Bxf2 17. cxb5 Bd4 18. Bf7+ Qxf7 19. Rxf7 Kxf7 20. Qf1+ Ke8
21. Qxh3 Rf8 22. Rf1 Bxc3 23. bxc3 Rxf1+ 24. Qxf1 Kd7 25. c4 c5 26. a4 a5 27.
Qb1 Rf8 28. b6 Kc8 29. b7+ Kb8 30. g4 Rf3 31. Kg2 Rxd3 32. h4 h6 33. h5 g5 34.
hxg6 Rd4 35. g7 Rxe4 36. Qxe4 1-0`;

const { headers, positions } = parsePgn(SAMPLE);

const expectations: Array<[string, unknown, unknown]> = [
  ['headers.Result', headers.Result, '1-0'],
  ['headers.White', headers.White, 'Player1'],
  ['headers.ECO', headers.ECO, 'C50'],
  ['Termination stripped', !!headers.Termination, false],
  ['EndTime stripped', !!headers.EndTime, false],
  ['Link stripped', !!headers.Link, false],
  ['positions.length (71 plies + start)', positions.length, 72],
  ['ply 1 = e4', positions[1].moveSan, 'e4'],
  ['ply 2 = e5', positions[2].moveSan, 'e5'],
  ['ply 37 = Rxf7 (move 19)', positions[37].moveSan, 'Rxf7'],
  ['last move = Qxe4', positions[71].moveSan, 'Qxe4'],
  [
    'starting FEN',
    positions[0].fen.split(' ')[0],
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  ],
];

let failed = 0;
for (const [name, actual, expected] of expectations) {
  const pass = actual === expected;
  console.log(`${pass ? 'ok' : 'FAIL'}  ${name}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  if (!pass) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll Phase 1 PGN smoke checks passed.');
