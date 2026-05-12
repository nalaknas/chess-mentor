// CHE-13 smoke: context assembly + prompt rendering + JSON parsing.
// No network calls (CHE-14 visual test covers the real round-trip).
import { buildContext } from '../src/llm/context';
import { parseAnalysis } from '../src/llm/client';
import { initialAnalysisPrompt, systemPrompt } from '../src/llm/prompts';
import type { Game } from '../src/types';

// Synthetic mini-game: 1.e4 e5 2.Qh5?? (early-queen blunder).
// The "key moment" is white's 2.Qh5 — engine preferred Nf3.
const FEN_AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const FEN_AFTER_QH5 = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';

const SAMPLE_GAME: Game = {
  id: 'test-game',
  pgn: '1. e4 e5 2. Qh5',
  white: 'Alice',
  black: 'Bob',
  result: '*',
  date: '2026.05.11',
  source: 'paste',
  userColor: 'white',
  importedAt: Date.now(),
  analysisStatus: 'engine_done',
  positions: [
    {
      ply: 0,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      isKeyMoment: false,
      engineEval: 20,
      engineBestMove: 'e2e4',
      engineBestMoveSan: 'e4',
      enginePv: ['e2e4', 'e7e5'],
    },
    {
      ply: 1,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      moveSan: 'e4',
      moveUci: 'e2e4',
      isKeyMoment: false,
      engineEval: 30,
      engineBestMove: 'e7e5',
      engineBestMoveSan: 'e5',
      enginePv: ['e7e5', 'g1f3'],
      evalDrop: -10,
      classification: 'best',
    },
    {
      ply: 2,
      fen: FEN_AFTER_E5,
      moveSan: 'e5',
      moveUci: 'e7e5',
      isKeyMoment: false,
      engineEval: 20,
      engineBestMove: 'g1f3',
      engineBestMoveSan: 'Nf3',
      enginePv: ['g1f3', 'b8c6'],
      evalDrop: 10,
      classification: 'best',
    },
    {
      ply: 3,
      fen: FEN_AFTER_QH5,
      moveSan: 'Qh5',
      moveUci: 'd1h5',
      isKeyMoment: true,
      engineEval: -250,
      engineBestMove: 'b8c6',
      engineBestMoveSan: 'Nc6',
      enginePv: ['b8c6', 'f1c4'],
      evalDrop: 270,
      classification: 'blunder',
    },
  ],
};

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${name}`);
  if (!ok) {
    if (detail !== undefined) console.log('     ', detail);
    failed++;
  }
}

// 1. buildContext returns the right shape for a key moment
const ctx = buildContext({ game: SAMPLE_GAME, ply: 3, userElo: 800 });
check('buildContext returns context for key moment', ctx !== null);

if (ctx) {
  check('teachingElo = userElo + 150', ctx.teachingElo === 950);
  check('fen is from PREVIOUS position (after 1...e5, pre-Qh5)', ctx.fen === FEN_AFTER_E5);
  check('userMove is the ply 3 SAN (Qh5)', ctx.userMove === 'Qh5');
  check('moverColor = white (ply 3 is odd)', ctx.moverColor === 'white');
  check('engineAnalysis pulls from prev position (engine preferred Nf3)', ctx.engineAnalysis.bestMoveSan === 'Nf3');
  check('classification = blunder', ctx.classification === 'blunder');
  check('moveHistory has 3 entries', ctx.moveHistory.length === 3);
}

// 2. buildContext returns null for non-key starting position
const nullCtx = buildContext({ game: SAMPLE_GAME, ply: 0, userElo: 800 });
check('buildContext returns null for ply 0', nullCtx === null);

// 3. systemPrompt renders cleanly
if (ctx) {
  const sys = systemPrompt(ctx);
  check('systemPrompt mentions user ELO', sys.includes('800 ELO'));
  check('systemPrompt mentions teaching ELO', sys.includes('950'));
  check('systemPrompt includes the engine pick (Nf3)', sys.includes('Nf3'));
  check('systemPrompt includes classification (blunder)', sys.includes('blunder'));
  check('systemPrompt lists all theme tags', sys.includes('endgame_technique'));
  check('systemPrompt has the JSON response schema', sys.includes('"explanation"'));

  const initial = initialAnalysisPrompt(ctx);
  check('initialAnalysisPrompt mentions the move (Qh5)', initial.includes('Qh5'));
  check('initialAnalysisPrompt mentions the engine pick (Nf3)', initial.includes('Nf3'));
}

// 4. parseAnalysis happy path
const goodResponse = JSON.stringify({
  explanation: 'Qh5 looks aggressive but loses tempo after ...Nf6, kicking the queen.',
  themeTags: ['premature_attack', 'piece_development'],
  achievableMove: 'Bc4',
});
const parsed = parseAnalysis(goodResponse, 'claude-sonnet-4-5');
check('parseAnalysis happy path: explanation set', parsed.explanation.startsWith('Qh5'));
check('parseAnalysis happy path: 2 themeTags kept', parsed.themeTags.length === 2);
check('parseAnalysis happy path: model echoed back', parsed.model === 'claude-sonnet-4-5');
check('parseAnalysis happy path: achievableMove set', parsed.achievableMove === 'Bc4');

// 5. parseAnalysis tolerates ```json fences (Claude sometimes adds them)
const fencedResponse = '```json\n' + goodResponse + '\n```';
const parsedFenced = parseAnalysis(fencedResponse, 'claude-sonnet-4-5');
check('parseAnalysis strips ```json fences', parsedFenced.explanation === parsed.explanation);

// 6. parseAnalysis drops invalid theme tags
const dirtyTagResponse = JSON.stringify({
  explanation: 'OK explanation.',
  themeTags: ['fork', 'made_up_tag', 'pin', 42],
});
const parsedDirty = parseAnalysis(dirtyTagResponse, 'claude-sonnet-4-5');
check('parseAnalysis filters invalid tags', parsedDirty.themeTags.length === 2);
check('parseAnalysis kept fork + pin', parsedDirty.themeTags.join(',') === 'fork,pin');

// 7. parseAnalysis throws on missing explanation
try {
  parseAnalysis(JSON.stringify({ themeTags: [] }), 'claude-sonnet-4-5');
  check('parseAnalysis throws when explanation missing', false, 'expected throw');
} catch (err) {
  check('parseAnalysis throws when explanation missing', err instanceof Error);
}

// 8. parseAnalysis throws on invalid JSON
try {
  parseAnalysis('not json at all', 'claude-sonnet-4-5');
  check('parseAnalysis throws on malformed JSON', false, 'expected throw');
} catch (err) {
  check('parseAnalysis throws on malformed JSON', err instanceof Error);
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll CHE-13 LLM-pipeline smoke checks passed.');
