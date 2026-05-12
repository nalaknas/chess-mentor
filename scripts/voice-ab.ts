// CHE-19 voice A/B harness. Runs two prompt variants on the same
// real key-moment positions and writes results side-by-side to
// voice-ab-results.md for human review.
//
// Reads ANTHROPIC_API_KEY from .env.local. Costs ~$0.05/run with
// sonnet-4-5 (3 fixtures × 2 variants × ~500 input + ~150 output).
//
// Usage:
//   npx tsx scripts/voice-ab.ts
//   open voice-ab-results.md

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import type { ConversationContext } from '../src/llm/context';
import { initialAnalysisPrompt, systemPrompt } from '../src/llm/prompts';
import { parseAnalysis } from '../src/llm/client';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 600;

// ─── Env loading ───────────────────────────────────────────────────

function loadEnv(): string {
  if (!existsSync('.env.local')) {
    throw new Error('.env.local not found — needed for ANTHROPIC_API_KEY');
  }
  const text = readFileSync('.env.local', 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing in .env.local');
  return key;
}

// ─── Fixtures ──────────────────────────────────────────────────────
//
// Three real key moments from the games we've tested. Each is a
// position where the engine has a clear preferred alternative.
// Chosen to span: early opening inaccuracy, mid-game mistake, mate
// transition.

interface Fixture {
  name: string;
  ctx: ConversationContext;
}

const FIXTURES: Fixture[] = [
  // 1. cvm559 vs sankasarbad — move 2 d3 was an inaccuracy
  //    (engine wanted exd5, winning the central pawn).
  {
    name: 'Opening inaccuracy: d3 instead of exd5',
    ctx: {
      userElo: 800,
      teachingElo: 950,
      game: { white: 'sankasarbad', black: 'cvm559', userColor: 'white' },
      ply: 3,
      fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
      moveHistory: ['e4', 'd5', 'd3'],
      userMove: 'd3',
      moverColor: 'white',
      engineAnalysis: {
        bestMove: 'e4d5',
        bestMoveSan: 'exd5',
        eval: 70,
        pv: ['e4d5', 'd8d5', 'b1c3', 'd5d8'],
      },
      evalDrop: 68,
      classification: 'inaccuracy',
      recentThemes: [],
    },
  },
  // 2. Spec sample (sankasarbad vs AgustinHiro) — Black's 6...Be6
  //    blunder, Bg4 was preferred.
  {
    name: 'Mid-game blunder: Be6 instead of Bg4',
    ctx: {
      userElo: 800,
      teachingElo: 950,
      game: { white: 'sankasarbad', black: 'AgustinHiro', userColor: 'black' },
      ply: 12,
      fen: 'r1bqkb1r/ppp2ppp/2np1n2/4p1N1/2B1P3/3P4/PPP2PPP/RNBQ1RK1 b kq - 1 6',
      moveHistory: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'O-O', 'd6', 'Ng5', 'Be6'],
      userMove: 'Be6',
      moverColor: 'black',
      engineAnalysis: {
        bestMove: 'c8g4',
        bestMoveSan: 'Bg4',
        eval: -30,
        pv: ['c8g4', 'g5f3', 'g4f3', 'd1f3'],
      },
      evalDrop: 202,
      classification: 'blunder',
      recentThemes: ['piece_development'],
    },
  },
  // 3. Spec sample — White's 20.Qf1+ blunder; Qh5+ kept the attack.
  {
    name: 'Late-game blunder: Qf1+ instead of Qh5+',
    ctx: {
      userElo: 800,
      teachingElo: 950,
      game: { white: 'sankasarbad', black: 'AgustinHiro', userColor: 'white' },
      ply: 39,
      fen: '8/p1p2k1p/3p2p1/1P6/2P1P3/3b2P1/PP3P1P/R3Q1Kn w - - 2 20',
      moveHistory: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'O-O', 'd6', 'Ng5', 'Be6', 'Nxe6', 'fxe6', 'Bxe6', 'Nd4', 'Bc4', 'a6', 'Bg5', 'b5', 'Bxf6', 'Qxf6', 'Bb3', 'Ne6', 'c4', 'Qg6', 'Nc3', 'Nf4', 'g3', 'Nh3+', 'Kh1', 'Bxf2', 'cxb5', 'Bd4', 'Bf7+', 'Qxf7', 'Rxf7', 'Kxf7', 'Qf1+'],
      userMove: 'Qf1+',
      moverColor: 'white',
      engineAnalysis: {
        bestMove: 'e1h5',
        bestMoveSan: 'Qh5+',
        eval: 550,
        pv: ['e1h5', 'g6h5', 'b3f7'],
      },
      evalDrop: 310,
      classification: 'blunder',
      recentThemes: ['weak_king', 'hanging_piece'],
    },
  },
];

// ─── Variant B — tightened teacher ─────────────────────────────────
//
// Designed contrast against the current (variant A) prompt:
//  - Tighter word cap (~80 words instead of 120)
//  - MUST name at least one specific square
//  - Open with empathy for blunders, not just description
//  - May end with a Socratic question instead of a follow-up invite

function variantBSystemPrompt(ctx: ConversationContext): string {
  // Start from the production prompt and append a "voice override"
  // section. That way variant B inherits all the engine grounding
  // + theme tagging behavior — only the *style* differs.
  const base = systemPrompt(ctx, { withTool: false, jsonResponse: true });
  return `${base}

# Voice override (variant B)

REPLACE rule 3 ("ONE idea per turn, 120 word cap") with:
- Aim for 60–80 words in \`explanation\`. Cut anything that doesn't directly help the user fix the same mistake next time.
- Reference at least one specific square by name (e.g., "your bishop on c4 stopped attacking f7"). No generic talk about "the kingside" or "the center" without a square.
- For \`classification === 'blunder'\`, OPEN with a single line of empathy ("Tough one — this kind of position trips a lot of players up.") before getting into the why.
- End EITHER with a soft follow-up invitation OR a Socratic question back ("Before going on, what's defending h7 here?"). Pick whichever creates a stronger learning moment.`;
}

// ─── Anthropic call ────────────────────────────────────────────────

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

async function callAnthropic(
  apiKey: string,
  system: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as AnthropicResponse;
  for (const block of json.content) {
    if (block.type === 'text' && block.text) return block.text;
  }
  throw new Error('No text block in response');
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const apiKey = loadEnv();
  const lines: string[] = [
    '# Voice A/B results',
    '',
    `Model: \`${MODEL}\``,
    `Variants:`,
    '- **A** — current production prompt (`src/llm/prompts.ts`).',
    '- **B** — tightened teacher: 60–80 word cap, must name a square, empathy opener on blunders, may swap follow-up invitation for a Socratic question.',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ];

  for (const f of FIXTURES) {
    console.log(`\n=== ${f.name} ===`);
    const userPrompt = initialAnalysisPrompt(f.ctx);

    const [aText, bText] = await Promise.all([
      callAnthropic(apiKey, systemPrompt(f.ctx, { withTool: false, jsonResponse: true }), userPrompt),
      callAnthropic(apiKey, variantBSystemPrompt(f.ctx), userPrompt),
    ]);

    const aParsed = safeParse(aText);
    const bParsed = safeParse(bText);

    const aWords = aParsed.explanation.split(/\s+/).filter(Boolean).length;
    const bWords = bParsed.explanation.split(/\s+/).filter(Boolean).length;

    lines.push(`## ${f.name}`);
    lines.push('');
    lines.push(`**Position**: ${f.ctx.userMove} (${f.ctx.classification}, lost ${f.ctx.evalDrop}cp). Engine preferred **${f.ctx.engineAnalysis.bestMoveSan}**.`);
    lines.push('');
    lines.push('### Variant A — production prompt');
    lines.push('');
    lines.push(`*${aWords} words; tags: ${aParsed.themeTags.join(', ') || '(none)'}*`);
    lines.push('');
    lines.push('> ' + aParsed.explanation.replace(/\n/g, '\n> '));
    if (aParsed.achievableMove) {
      lines.push('');
      lines.push(`*Try: **${aParsed.achievableMove}** — ${aParsed.achievableExplanation ?? ''}*`);
    }
    lines.push('');
    lines.push('### Variant B — tightened teacher');
    lines.push('');
    lines.push(`*${bWords} words; tags: ${bParsed.themeTags.join(', ') || '(none)'}*`);
    lines.push('');
    lines.push('> ' + bParsed.explanation.replace(/\n/g, '\n> '));
    if (bParsed.achievableMove) {
      lines.push('');
      lines.push(`*Try: **${bParsed.achievableMove}** — ${bParsed.achievableExplanation ?? ''}*`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  writeFileSync('voice-ab-results.md', lines.join('\n'));
  console.log('\nWrote voice-ab-results.md');
}

function safeParse(raw: string): {
  explanation: string;
  themeTags: string[];
  achievableMove?: string;
  achievableExplanation?: string;
} {
  try {
    const parsed = parseAnalysis(raw, MODEL);
    return parsed;
  } catch (e) {
    return {
      explanation: `(PARSE FAILED: ${e instanceof Error ? e.message : e})\n\nRaw:\n${raw}`,
      themeTags: [],
    };
  }
}

// Suppress unused-import warning for Chess (kept available for future
// fixtures that need on-the-fly position derivation).
void Chess;

main().catch((err) => {
  console.error('voice-ab failed:', err);
  process.exit(1);
});
