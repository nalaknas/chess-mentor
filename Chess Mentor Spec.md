# Chess Mentor — Build Spec

> A personalized chess teacher that analyzes your games at your level and converses with you about them. Built around the insight that a 900-rated player learns best from a slightly-better player, not a grandmaster.

---

## 1. Product Vision

A web app that you'll use on your laptop first, then ship as a real iOS app via Capacitor. The user:

1. Imports their chess games (paste PGN or pull from Lichess/Chess.com)
2. Gets an annotated review of each game — but **calibrated to ~150 ELO above their current level**, in plain teacher-voice English
3. Can **ask follow-up questions** about any move ("why not bishop to b1?") and get grounded, conversational answers
4. (Later) Sees themed weaknesses aggregated across games and gets targeted puzzles to practice them

### Why this product exists

Existing tools fail in opposite directions:

- **Stockfish-based reviews (Chess.com Game Review, Lichess analysis)** are factually correct but pedagogically useless to beginners. Telling an 800-rated player "the correct move was Nf5 because after Qd2, Rxe4, Nxe4, Qxe4, Bxf7+ White has a 1.4 advantage" doesn't help them. The vocabulary is wrong, the depth is wrong, the priorities are wrong.
- **Generic LLM chess analysis** sounds good but hallucinates moves, miscounts material, and can't reliably tell good moves from bad.

This product combines **engine for truth, LLM for translation, ELO calibration for relevance.**

### Pedagogical anchor

Vygotsky's Zone of Proximal Development: you learn fastest from someone slightly ahead of you. A 900-rated player needs to think like an 1100, not a 2700. So the teacher voice always speaks from `user_elo + 150` perspective, with vocabulary, concepts, and priorities appropriate to that tier.

### Target user

A casual Chess.com or Lichess player rated 400–1800 who:
- Plays a few games a week
- Wants to improve but finds Stockfish reviews alienating
- Will paste in or import a recent game and spend 5–15 minutes reviewing
- Eventually wants targeted practice on their specific weaknesses

---

## 2. Core Design Principles

### Three-layer separation of concerns

1. **Engine layer (truth):** Stockfish runs at full strength to find ground-truth best moves and evaluations. Never asks the LLM "is this move good?" — that's the engine's job.
2. **Teaching layer (translation):** Claude takes engine output + position context + user level and produces tier-appropriate English. The LLM is the teacher, not the analyst.
3. **Behavioral model (optional, V3):** Maia 2 predicts what a human at the user's level (or slightly above) would actually play. Useful for "what could you realistically have played?" answers.

### The teacher voice

What makes a tutor sound like a tutor instead of a manual:

- **Concrete, not abstract.** "Look at the c-file — it's wide open and your rook is closest" beats "exploit the open file."
- **One idea per turn.** Real teachers pick the most important concept and let you ask about the rest. Avoid the wall-of-text impulse.
- **Asks back sometimes.** Socratic moments make ideas stick. "Before I answer — what's defending f7?"
- **Honest but warm.** "That's a natural-looking move, but here's the trap..." not "Incorrect."
- **Reuses prior context.** "Remember that pin from move 9? Same idea here." This requires real memory across turns.
- **Anchored to user's ELO.** "A player at your level wouldn't be expected to see this yet — what's worth focusing on is..."
- **Plain language.** No "prophylaxis" or "Zwischenzug" unless the user already used the term. "Slow it down before attacking" works.

### What we never do

- Never claim a move is good/bad without engine confirmation
- Never invent variations or principal lines
- Never give grandmaster-level analysis to a beginner
- Never lecture for more than ~120 words without inviting a question

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React + Vite + TypeScript | Fast dev loop, good for PWAs and Capacitor |
| Board UI | `chessground` (Lichess's board) | Best-in-class, handles arrows, highlights, promotion dialogs |
| Chess logic | `chess.js` | PGN parsing, move legality, FEN handling |
| Engine | `stockfish.wasm` (via `lila-stockfish-web` or `stockfish.js`) | Runs in browser, ~1MB, full strength |
| State | Zustand | Lightweight, ergonomic, no boilerplate |
| Local persistence | Dexie (IndexedDB wrapper) | Early phases — keeps everything on-device |
| Cloud persistence | Supabase (Postgres + Auth) | Added in Phase 4+ for cross-device sync and to keep API keys server-side |
| Styling | Tailwind CSS | Fast iteration, mobile-friendly |
| Hosting | **Vercel** | Edge functions for LLM proxy, easy custom headers, you already know it |
| LLM | Anthropic Claude API | Recommended starting model: `claude-sonnet-4-5` or current Sonnet — see https://docs.claude.com/en/api/overview for current models |
| Native shell (later) | **Capacitor** | Wraps the same React codebase as an iOS app; no rewrite needed |

### Stack decisions explained

**Why Vercel, not Cloudflare Workers.** Vercel handles everything we need (edge functions, the COOP/COEP headers Stockfish requires) and you already know it. Cloudflare is a great platform to learn eventually, but mid-MVP is not the time.

**Why Supabase, added lazily.** For "just me on my laptop" MVP, IndexedDB is enough. The moment you want games on both laptop and phone, Supabase becomes the cross-device store. Adding it around Phase 4 also lets the Claude API key live server-side from the start, which is a security win.

**Why Capacitor, not React Native.** End goal is a real iOS app. Capacitor wraps the same React codebase in a native WebView shell — same code serves laptop browser and App Store. React Native would mean rewriting. PWA-to-home-screen is fine for early testing but Capacitor is the actual ship path.

### What we explicitly DON'T need (V2)

- No native iOS *yet* — web app first, Capacitor wrap when the app is mature
- No Maia 2 — Stockfish is enough for V2; Maia is a V3 refinement
- No real-time / live game review — analyze completed games only
- No social / sharing features

---

## 4. Architecture

### High level

```
┌───────────────────────────────────────────────────────────────┐
│                Browser (PWA) / Capacitor WebView              │
│                                                               │
│   ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│   │  Board UI    │  │  Analysis UI   │  │ Conversation UI  │  │
│   │ (chessground)│  │ (move list +   │  │ (per-position    │  │
│   │              │  │  evals)        │  │  chat thread)    │  │
│   └──────┬───────┘  └───────┬────────┘  └────────┬─────────┘  │
│          │                  │                    │            │
│          └──────────────────┼────────────────────┘            │
│                             │                                 │
│                    ┌────────▼────────┐                        │
│                    │  Zustand Store  │                        │
│                    └────────┬────────┘                        │
│                             │                                 │
│         ┌───────────────────┼───────────────────┐             │
│         │                   │                   │             │
│   ┌─────▼─────┐      ┌──────▼──────┐    ┌───────▼────────┐    │
│   │ chess.js  │      │ Stockfish   │    │ Dexie/IndexedDB│    │
│   │  (PGN,    │      │ (WebWorker) │    │ (Phase 1–3)    │    │
│   │  legality)│      │             │    │                │    │
│   └───────────┘      └─────────────┘    └────────────────┘    │
│                                                               │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               │   HTTPS
                               ▼
                  ┌────────────────────────┐
                  │  Vercel Edge Function  │
                  │  - Claude API proxy    │
                  │  - Lichess/CC import   │
                  │    (CORS proxy)        │
                  └────┬───────────────┬───┘
                       │               │
                       ▼               ▼
            ┌──────────────────┐  ┌──────────────────┐
            │  Anthropic API   │  │  Supabase        │
            │  (Claude)        │  │  (Phase 4+)      │
            │                  │  │  Auth + Postgres │
            └──────────────────┘  └──────────────────┘
```

### Data flow: analyzing a game

```
User imports/pastes PGN
   ↓
chess.js parses → array of positions (FEN per move)
   ↓
For each position:
   Stockfish.wasm evaluates at depth 18 → { bestMove, eval, pv }
   ↓
   Compare user's actual move vs bestMove
   ↓
   If eval drop > 50cp → flag as "key moment"
   ↓
For each key moment:
   Bundle context (FEN, history, engine output, user_elo)
   ↓
   POST to /api/analyze → forwarded to Claude API
   ↓
   Claude returns: { explanation, themeTags[], teacherVoice }
   ↓
Store all analyses in IndexedDB keyed by (game_id, move_index)
   ↓
UI renders move list with annotations + opens to game review
```

### Data flow: conversational turn

```
User clicks a flagged move → opens conversation pane for that position
   ↓
First message auto-populated with Claude's initial analysis
   ↓
User types: "Why not Bb1?"
   ↓
Client sends to /api/converse:
   - System prompt (teacher voice, locked to user's ELO)
   - Conversation history for this position
   - Position context bundle (FEN, history, prior engine analysis)
   - Tool definition: evaluate_move(fen, move)
   ↓
Claude responds — possibly calling evaluate_move("Bb1")
   ↓
If tool call: client runs Stockfish on that move locally,
              returns { eval, pv, refutation } back to Claude
   ↓
Claude produces final teacher-voice answer
   ↓
Append to conversation history, render in UI
```

---

## 5. Data Models

### TypeScript types

```typescript
// User profile (single-user app for V2)
interface UserProfile {
  id: 'default';
  displayName?: string;
  currentElo: number;          // user-entered, can update
  teachingElo: number;         // derived: currentElo + 150
  preferredColor?: 'white' | 'black';
  createdAt: number;
}

// Game = a complete chess game imported or pasted
interface Game {
  id: string;                  // uuid
  pgn: string;                 // original PGN
  white: string;
  black: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  date: string;
  source: 'paste' | 'lichess' | 'chesscom';
  userColor: 'white' | 'black';
  importedAt: number;
  // analysis status
  analysisStatus: 'pending' | 'engine_done' | 'fully_analyzed' | 'error';
  // engine pass output, one per ply
  positions: Position[];
}

interface Position {
  ply: number;                 // half-move number
  fen: string;
  moveSan?: string;            // the move played to reach this position
  moveUci?: string;
  // engine output
  engineEval?: number;         // centipawns from white's perspective
  engineBestMove?: string;     // UCI
  engineBestMoveSan?: string;
  enginePv?: string[];         // principal variation in UCI
  evalDrop?: number;           // for key moments: how much user lost (cp)
  isKeyMoment: boolean;
  classification?: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
}

// Analysis = Claude's teacher-voice take on a key moment
interface Analysis {
  id: string;
  gameId: string;
  ply: number;
  // generated content
  explanation: string;         // 2-4 sentences, teacher voice
  themeTags: ThemeTag[];       // e.g. ['pin', 'hanging_piece']
  achievableMove?: string;     // what a user_elo+150 player would play (if different from best)
  achievableExplanation?: string;
  generatedAt: number;
  model: string;               // e.g. "claude-sonnet-4-5"
}

// Conversation = multi-turn chat about a specific position
interface Conversation {
  id: string;
  gameId: string;
  ply: number;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: {
    name: 'evaluate_move';
    input: { fen: string; move: string };
    result?: { eval: number; pv: string[]; refutation?: string };
  };
  timestamp: number;
}

// ThemeTag = one of a fixed taxonomy (see section 9)
type ThemeTag =
  | 'pin' | 'fork' | 'skewer' | 'discovered_attack' | 'double_attack'
  | 'hanging_piece' | 'back_rank' | 'weak_king' | 'overloaded_piece'
  | 'trapped_piece' | 'weak_square' | 'bad_bishop' | 'good_knight'
  | 'open_file' | 'pawn_break' | 'pawn_structure' | 'passed_pawn'
  | 'premature_attack' | 'missed_defense' | 'opening_principle'
  | 'piece_development' | 'king_safety' | 'simplification' | 'endgame_technique'
  | 'time_trouble' | 'calculation_error';
```

### Storage strategy

- **Dexie schema:**
  - `userProfile` (single row)
  - `games` (indexed by id, importedAt)
  - `analyses` (indexed by gameId, ply)
  - `conversations` (indexed by gameId, ply)
- All data lives client-side. No server DB in V2.
- Export/import as JSON for backup or device migration.

---

## 6. The Analysis Pipeline

### Step 1: Parse PGN

Use `chess.js`. **Watch out for non-standard headers from Chess.com** — strip any tag that isn't in this allowed list before parsing:

```
Event, Site, Date, Round, White, Black, Result, WhiteElo, BlackElo, TimeControl, ECO
```

Output: an array of `Position` objects, one per ply.

### Step 2: Engine pass

Spin up Stockfish in a Web Worker. For each position:

- Set position via UCI `position fen <FEN>`
- Run `go depth 18` (or `movetime 1000` — pick one and stick with it)
- Parse `info` lines for evaluation and PV
- Parse `bestmove` line for the engine's pick

Store results in the Position objects.

### Step 3: Classify each move

Compare evaluation before and after the user's move (from the user's side):

| eval drop (cp) | classification |
|---|---|
| < 30 | best / good |
| 30–80 | inaccuracy |
| 80–200 | mistake |
| > 200 | blunder |
| Mate missed/walked into | blunder |

Mark inaccuracy/mistake/blunder as `isKeyMoment: true`.

### Step 4: Claude pass on key moments

For each key moment, POST to your edge function with the context bundle (see section 8). Claude returns explanation + theme tags. Store as Analysis records.

### Step 5: UI presentation

- Move list shows all moves with color-coded annotation icons
- Key moments are clickable → open the conversation pane
- Board updates to that position; arrows show engine's best move

---

## 7. The Conversation Loop

### Context bundle (what Claude sees every turn)

```typescript
interface ConversationContext {
  // Static — set once when conversation opens
  userElo: number;
  teachingElo: number;
  game: {
    white: string;
    black: string;
    userColor: 'white' | 'black';
  };

  // Position-specific
  ply: number;
  fen: string;
  moveHistory: string[];       // SAN moves up to this point
  userMove: string;            // what the user actually played
  engineAnalysis: {
    bestMove: string;
    bestMoveSan: string;
    eval: number;
    pv: string[];
  };
  evalDrop: number;            // how bad was the user's move
  classification: 'inaccuracy' | 'mistake' | 'blunder';

  // Conversation history (this position only)
  messages: ChatMessage[];

  // Carry-over from earlier in the game
  recentThemes: ThemeTag[];    // last 1-2 themes discussed, for callbacks
}
```

### Tool: `evaluate_move`

The LLM has access to one tool. The client executes it locally with Stockfish.wasm.

```json
{
  "name": "evaluate_move",
  "description": "Evaluate what happens if a specific move is played from the current position. Use this when the user asks about an alternative move, or when you want to verify a line before explaining it.",
  "input_schema": {
    "type": "object",
    "properties": {
      "fen": { "type": "string", "description": "Position to evaluate from" },
      "move": { "type": "string", "description": "Move in SAN or UCI" }
    },
    "required": ["fen", "move"]
  }
}
```

Tool result shape:

```json
{
  "legal": true,
  "evalAfter": -120,
  "evalDelta": -180,
  "bestResponse": "Nxe4",
  "pv": ["Nxe4", "Qd7", "Nxc3"],
  "shortAssessment": "loses material to a knight fork"
}
```

### Multi-turn flow

```
[message 1] assistant: <auto-populated initial analysis>
[message 2] user: "Why not Bb1?"
[message 3] assistant: <thinks> I should check Bb1 before answering.
                       <tool_use: evaluate_move(fen, "Bb1")>
[message 4] tool: { legal: true, evalAfter: -90, bestResponse: "Nxe4", ... }
[message 5] assistant: "Bb1 looks tempting because it eyes the long diagonal,
                       but after Bb1 Black plays Nxe4 — the knight hops away
                       with tempo and the bishop is staring at granite.
                       Want me to show what that line looks like?"
```

### Conversation memory across positions

When the user advances to the next key moment, **start a fresh conversation thread** but pass `recentThemes` (last 1–2 themes discussed) so Claude can make callbacks: "Remember that pin from move 9? Same idea here on move 14." Do NOT carry the full message history — context bloats and Claude starts repeating itself.

---

## 8. The Teacher Voice (Prompts)

### System prompt template

```
You are a chess coach teaching a player rated {userElo} ELO. You speak from
the perspective of a {teachingElo}-rated player — knowledgeable enough to guide,
but close enough to relate.

# Core rules

1. EVERY claim about whether a move is good or bad must be grounded in the
   engine analysis provided. Never invent evaluations or variations.
2. Use the evaluate_move tool whenever the user asks about an alternative
   move or you want to verify a line. Don't guess.
3. Speak like a chess teacher, not a manual. Concrete language ("the c-file is
   wide open and your rook is right there") beats abstract ("exploit the open file").
4. ONE idea per turn. Pick the most important concept; let the user ask about
   the rest. Hard cap: 120 words per response unless the user asks for depth.
5. Sometimes turn it around. If a position has a clear teaching moment,
   ask the user: "Before I explain — what do you think the right move is, and why?"
6. Stay anchored to {teachingElo}. Don't reach for grandmaster concepts the
   user can't use yet. Examples of concepts to AVOID at sub-1500:
   prophylaxis, Zwischenzug, opposite-colored bishop endgames, deep prophylactic ideas.
7. Be warm but honest. "That's a natural-looking move, but here's the trap..."
   not "Incorrect." Never condescend.
8. When relevant, reference recent themes: {recentThemes}. Callbacks help learning stick.

# What you know about this position

- Game: {white} vs {black}, user played {userColor}
- Move: {ply}, position FEN: {fen}
- User played: {userMove}
- Engine says best was: {engineBestMoveSan} (eval: {eval})
- Eval drop from user's move: {evalDrop} cp ({classification})
- Principal variation: {pv}

# Response format

Plain prose. No headers, no lists, no markdown unless naturally helpful.
End with either (a) a natural pause that invites a question, or
(b) a Socratic question back if the position warrants it.
```

### Examples of good vs bad responses

**Bad (lecture mode):**
> Your move of Nxe5 was a blunder because it loses material to the following sequence: Bxf7+ Kxf7 Qh5+ g6 Qxe5. You should have played Bd3 to develop the bishop and prepare castling. This follows opening principle #3 of piece development.

**Good (teacher mode):**
> That knight take walks into a nasty surprise — after Bxf7+ Kxf7, the queen comes to h5 with check and grabs your knight. Did you see the bishop on c4 when you played it? In positions like this, before any capture, always ask: "who's looking at f7?"

**Bad (too abstract):**
> You missed the principle of king safety. White's king was uncastled and you should have exploited this.

**Good (concrete):**
> Look at the white king — still on e1, no defenders nearby, and your queen and bishop are both pointing at that whole area. There was a tactic here. Want a hint, or do you want to find it?

### Initial analysis prompt (for the auto-populated first message)

When a key moment is first flagged, generate the opening analysis with this prompt variant:

```
Open the conversation by:
1. Acknowledging the move plainly (no judgment yet)
2. Stating what happened (the engine's preferred move or the consequence)
3. Naming ONE concrete reason the move missed the mark
4. Inviting a follow-up: "Want to see the line?" or "Want to know what you might
   have played instead?"

Keep it under 80 words.
```

---

## 9. Theme Taxonomy

A fixed taxonomy that Claude picks from when tagging mistakes. Keeping the list small and stable lets weakness aggregation work meaningfully.

### Tactical (pattern-based)
- `pin` — piece stuck because moving exposes more valuable piece
- `fork` — one piece attacks two
- `skewer` — pin in reverse, more valuable piece in front
- `discovered_attack` — moving one piece reveals an attack from another
- `double_attack` — two threats at once
- `hanging_piece` — undefended piece left attackable
- `back_rank` — mate/threat on the 1st/8th rank
- `overloaded_piece` — defender doing too many jobs
- `trapped_piece` — piece with no safe squares
- `weak_king` — king exposed, attackable

### Positional
- `weak_square` — square that can't be defended by a pawn
- `bad_bishop` — bishop blocked by own pawns
- `good_knight` / `outpost` — well-placed knight, often on a weak square
- `open_file` — file with no pawns, target for rooks
- `pawn_break` — pawn move that opens lines / changes structure
- `pawn_structure` — broader structural issue (doubled, isolated, etc.)
- `passed_pawn` — pawn with no enemy pawns ahead on adjacent files

### Strategic / decision-making
- `premature_attack` — attacking before development is complete
- `missed_defense` — failing to address opponent's threat
- `opening_principle` — basic opening violation (early queen, blocked center, etc.)
- `piece_development` — slow or unbalanced development
- `king_safety` — castling timing, pawn shelter
- `simplification` — when trading favors one side
- `endgame_technique` — endgame-specific errors
- `time_trouble` — likely time pressure blunder (flag, don't analyze deeply)
- `calculation_error` — visualization or counting mistake

### How tagging works

Claude includes 1–3 tags per analysis in its JSON response. Tags accumulate across games to build the user's weakness profile.

---

## 10. Engine Integration (Stockfish.wasm)

### Loading

Use `stockfish.wasm` from npm or the Lichess fork `lila-stockfish-web`. Initialize in a Web Worker so the main thread stays responsive.

```typescript
const stockfish = new Worker('/stockfish.js');

stockfish.postMessage('uci');
stockfish.postMessage('ucinewgame');
stockfish.postMessage('isready');
```

### Querying a position

```typescript
function analyzePosition(fen: string, depth = 18): Promise<EngineResult> {
  return new Promise((resolve) => {
    let bestMove = '';
    let evalCp = 0;
    let pv: string[] = [];

    const onMessage = (e: MessageEvent) => {
      const line = e.data;
      if (line.startsWith('info') && line.includes(' pv ')) {
        // parse depth, score cp, pv
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)$/);
        if (cpMatch) evalCp = parseInt(cpMatch[1]);
        if (mateMatch) evalCp = parseInt(mateMatch[1]) > 0 ? 30000 : -30000;
        if (pvMatch) pv = pvMatch[1].split(' ');
      }
      if (line.startsWith('bestmove')) {
        bestMove = line.split(' ')[1];
        stockfish.removeEventListener('message', onMessage);
        resolve({ bestMove, evalCp, pv });
      }
    };

    stockfish.addEventListener('message', onMessage);
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
  });
}
```

### Calibration (not used in V2, but good to know)

Stockfish UCI options for weakening:
- `setoption name UCI_LimitStrength value true`
- `setoption name UCI_Elo value 1400` (min ~1320, max ~3190)
- `setoption name Skill Level value <0-20>` — alternative

**V2 does NOT weaken Stockfish.** We use it at full strength to find truth. Calibration is only relevant if we later add a "play against bot at my level" feature.

### Eval interpretation

- Centipawns (cp): 100 cp = 1 pawn of advantage
- Mate scores: encoded specially (we map to ±30000)
- Always from White's perspective in UCI output — flip sign for Black to get "user's perspective"

---

## 11. LLM Integration (Anthropic API)

### Vercel Edge Function shape

Goes in `/api/converse.ts` if you're using the `pages` router, or `/app/api/converse/route.ts` for the app router. The `ANTHROPIC_API_KEY` lives in Vercel's environment variables — never exposed to the client.

```typescript
// /api/converse.ts (Vercel)
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { systemPrompt, messages, tools } = await req.json();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',  // or current Sonnet; check https://docs.claude.com
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools,
    }),
  });

  return response;
}
```

### vercel.json (cross-origin headers for Stockfish)

Stockfish.wasm requires SharedArrayBuffer, which requires these headers. Put this at the root of your project:

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
    ]
  }]
}
```

You'll need the same headers in Vite's dev server too — add them to `vite.config.ts` under `server.headers`.

### Multi-turn with tool-use

The agent loop:

1. Client sends messages + tool definitions to edge function
2. Edge function calls Claude API
3. Claude responds — if `stop_reason === 'tool_use'`, the response includes a tool_use block
4. Client extracts tool call, runs Stockfish locally
5. Client appends tool_result to messages and POSTs again
6. Repeat until `stop_reason === 'end_turn'`
7. Render final assistant message

### Models to consider

- **Sonnet** — recommended default. Smart enough for nuanced teaching, fast enough for conversation.
- **Haiku** — for theme tagging only (cheap classification), if cost matters
- **Opus** — overkill for V2, but if you find Sonnet missing nuance, try it

Current model names and pricing: https://docs.claude.com/en/api/overview

---

## 12. UI/UX Sketch

### Screens

**1. Home / library**
- List of imported games (most recent first)
- "Import game" CTA → either paste PGN or enter Lichess username
- User ELO display + edit
- (V3) "Weaknesses" tab and "Puzzles" tab

**2. Game review**
- Chess board (chessground), takes most of the screen on mobile
- Move list below or to the side, with classification badges
- Key moments highlighted (yellow/red dots)
- Tapping a move → board jumps, eval bar updates, conversation pane appears

**3. Conversation pane**
- Slides in from bottom (mobile) or right (desktop)
- Shows messages, board stays visible
- Text input + "send"
- Visual hint when Claude is using a tool ("checking the engine...")

### Mobile-first layout

```
┌──────────────────────┐
│  ▲ Game header       │
│  White vs Black      │
│  ─────────────────── │
│                      │
│      [Board]         │
│                      │
│  ─────────────────── │
│  ◀ 12. Nxe5 ▶  -2.1  │ ← move strip, swipeable
│  ─────────────────── │
│  Claude: That knight │
│  take walks into a   │
│  nasty surprise...   │
│                      │
│  [You: Why not Bb1?] │
│  ─────────────────── │
│  [type a question..] │
└──────────────────────┘
```

### Key interactions

- Swipe left/right on move strip → navigate moves
- Tap a key moment → conversation opens
- Long-press a square → "what about a piece here?" prompts Claude
- Tap engine arrow → "explain this move" prompts Claude

---

## 13. V2 Scope

### IN scope

1. **PGN paste import** with Chess.com header cleaning
2. **Lichess username import** via Lichess API
3. **Full Stockfish.wasm analysis** of every game on import
4. **Key moment classification** (inaccuracy/mistake/blunder)
5. **Claude-generated teacher-voice analysis** for each key moment
6. **Multi-turn conversational mode** per position with `evaluate_move` tool
7. **Theme tagging** stored per analysis
8. **Local persistence** via IndexedDB (Phases 1–6)
9. **Vercel deployment** with API keys safely server-side (Phase 7)
10. **Supabase auth + cross-device sync** (Phase 8)
11. **Capacitor iOS build** shipped to TestFlight (Phase 9)

### OUT of scope (V3+)

- Maia 2 integration
- Chess.com import (slower, stricter API — defer)
- Socratic quiz mode (system supports it, UI ships later)
- Weakness dashboard with theme aggregation
- Lichess puzzle DB integration for targeted practice
- Live game review (mid-game coaching)
- App Store public release (TestFlight only for V2)

---

## 14. Build Phases

Build strictly phase by phase. Each phase must work end-to-end before starting the next. Each phase ends with a manual test of the new functionality on a real PGN.

> **MVP target:** Phases 1–6 give you a usable web app on your laptop. Phase 7 deploys to Vercel + adds Lichess. Phase 8 introduces Supabase. Phase 9 wraps in Capacitor for iOS. Stop wherever the product is good enough.

### Phase 1 — Scaffolding & board
- Vite + React + TypeScript + Tailwind project, running locally
- chessground integrated, can display arbitrary FEN
- chess.js loaded, basic move list rendering
- PGN paste input → parsed → moves render → board navigates
- **Test:** paste the sample PGN in section 16, click through moves, see board update.

### Phase 2 — Engine
- Stockfish.wasm in a Web Worker
- `analyzePosition(fen)` function returning { bestMove, eval, pv }
- Cross-origin headers set in `vite.config.ts` (see section 11)
- On PGN import, run engine on every position, store in Zustand
- Eval bar component
- **Test:** paste sample PGN, see evals show up next to every move within ~30s.

### Phase 3 — Key moment detection
- Classify each move (best/good/inaccuracy/mistake/blunder) by eval drop
- Mark them on the move list with color
- Clicking a key moment → board jumps + side pane opens (empty for now)
- IndexedDB persistence via Dexie (so reloads keep your analyzed games)
- **Test:** sample PGN's known blunder is correctly flagged; reload page, games still there.

### Phase 4 — Claude analysis (local dev, no deploy yet)
- Run a tiny local Express or Vite middleware proxy holding your Anthropic API key in a `.env` file
- On key moment, POST context bundle to `/api/analyze`, get back analysis JSON
- Display in side pane
- Persist analyses to IndexedDB
- **Test:** key moment shows teacher-voice explanation; explanation references the actual position, not generic.

### Phase 5 — Conversational mode
- Convert side pane into a chat UI (input + message list)
- Multi-turn API loop with tool-use
- `evaluate_move` tool wired to local Stockfish
- Conversation history per (gameId, ply) in IndexedDB
- **Test:** ask "why not Bb1?" — Claude calls the tool, the response is grounded in actual engine output.

### Phase 6 — Theme tagging + teacher voice polish
- Claude returns `themeTags[]` in JSON
- Tag chips render below the explanation
- Iterate on the system prompt with real games — keep the responses that feel right, refine the ones that don't
- **Test:** analyze 3–5 of your own games. Voice feels like a teacher, not a manual.

> At this point you have a working MVP on your laptop. Stop here for a few days and use it on real games before pushing further.

### Phase 7 — Deploy to Vercel + Lichess import
- Move the API key to Vercel environment variables, deploy the Edge Functions
- Add `vercel.json` with cross-origin headers
- "Import from Lichess" input → username → `https://lichess.org/api/games/user/{username}?max=10&pgnInJson=true`
- List recent games, user picks one to analyze
- **Test:** Vercel-deployed site analyzes a freshly-imported Lichess game end-to-end.

### Phase 8 — Supabase: auth + cross-device sync
- Create Supabase project, set up tables mirroring the TypeScript models in section 5
- Add magic-link auth (single user; no need for fancy onboarding)
- On login, sync IndexedDB → Postgres (one-way upload for existing data)
- New games/analyses/conversations write to Postgres directly, IndexedDB becomes a cache
- **Test:** analyze a game on laptop, open the same URL on phone Safari, see it there.

### Phase 9 — Capacitor: ship to iOS
- `npm install @capacitor/core @capacitor/cli @capacitor/ios`
- `npx cap init` then `npx cap add ios`
- Configure splash, icons, deep links
- Build for iOS, test on device via TestFlight
- **Test:** install on your phone via TestFlight, analyze a game, all features work in the native shell.

### Future / V3
- Maia 2 integration for behavioral modeling
- Socratic quiz mode
- Lichess puzzle DB integration → themed practice
- Chess.com import
- Weakness dashboard with theme aggregation across all games

---

## 15. Lessons & Pitfalls from V1

These tripped up the previous build attempt — avoid them:

### PGN parsing
- **Chess.com PGNs have extra headers** (`Termination`, `EndTime`, `Link`, `CurrentPosition`, `StartTime`, etc.) that strict chess.js versions choke on. Strip them before parsing.
- **Result format:** Chess.com sometimes uses `1-0`, sometimes `1.0`. Normalize.
- **Comments and clock annotations** in PGN like `{[%clk 0:09:58.5]}` need to be stripped or chess.js may misparse.

### Build incrementally
- The V1 attempt got stuck trying to add a board + arrows + custom rendering all at once. Don't do that.
- Each phase ends with a green build and a manual smoke test. No "I'll fix it in the next phase."

### Stockfish in browser
- Stockfish.wasm needs cross-origin isolation headers (`Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`) for SharedArrayBuffer. Set them in `vite.config.ts` for local dev and in `vercel.json` for production (both shown in section 11).
- If those headers are hard to set, use the non-SharedArrayBuffer "lite" build — slower but works everywhere.

### Token & cost management
- Don't ship the entire game's PGN with every conversational turn — only the moves up to the current position.
- Cache analyses. Don't re-call Claude on already-analyzed positions.
- Use Haiku for theme tagging if you find cost is an issue; reserve Sonnet for conversational turns.

### LLM grounding
- The biggest failure mode: Claude makes up moves. Mitigate by:
  - Always passing engine output in the context
  - The system prompt explicitly forbids inventing variations
  - Use `evaluate_move` tool for any "what if" reasoning

### UX
- Conversational mode shouldn't take over the whole screen — the user wants to see the board.
- "Claude is thinking..." indicator matters; multi-turn tool-use can take 3–6 seconds.

---

## 16. Sample Test PGN

Use this for smoke testing each phase. It's a real beginner-level game with a clear blunder around move 19.

```
[Event "Live Chess"]
[Site "Chess.com"]
[Date "2025.10.16"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[WhiteElo "447"]
[BlackElo "442"]
[ECO "C50"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. O-O d6 6. Ng5 Be6 7. Nxe6 fxe6 8.
Bxe6 Nd4 9. Bc4 a6 10. Bg5 b5 11. Bxf6 Qxf6 12. Bb3 Ne6 13. c4 Qg6 14. Nc3 Nf4
15. g3 Nh3+ 16. Kh1 Bxf2 17. cxb5 Bd4 18. Bf7+ Qxf7 19. Rxf7 Kxf7 20. Qf1+ Ke8
21. Qxh3 Rf8 22. Rf1 Bxc3 23. bxc3 Rxf1+ 24. Qxf1 Kd7 25. c4 c5 26. a4 a5 27.
Qb1 Rf8 28. b6 Kc8 29. b7+ Kb8 30. g4 Rf3 31. Kg2 Rxd3 32. h4 h6 33. h5 g5 34.
hxg6 Rd4 35. g7 Rxe4 36. Qxe4 1-0
```

---

## 17. References & Links

### Libraries
- **chessground** (Lichess board): https://github.com/lichess-org/chessground
- **chess.js**: https://github.com/jhlywa/chess.js
- **stockfish.wasm**: https://github.com/lichess-org/stockfish.wasm or https://github.com/nmrugg/stockfish.js
- **lila-stockfish-web** (modern Lichess fork): https://github.com/lichess-org/lila-stockfish-web
- **Dexie**: https://dexie.org
- **Zustand**: https://github.com/pmndrs/zustand

### Platform
- **Vercel** (hosting + Edge Functions): https://vercel.com/docs
- **Vercel cross-origin headers** (for Stockfish): https://vercel.com/docs/edge-network/headers
- **Supabase** (auth + Postgres): https://supabase.com/docs
- **Capacitor** (web → iOS): https://capacitorjs.com/docs

### APIs
- **Anthropic Claude API**: https://docs.claude.com/en/api/overview
- **Anthropic tool use**: https://docs.claude.com/en/docs/build-with-claude/tool-use
- **Lichess game export API**: https://lichess.org/api#tag/Games/operation/apiGamesUser
- **Lichess puzzle DB** (V3): https://database.lichess.org/#puzzles — ~4M tagged puzzles, free download
- **Chess.com Published Data API** (V3): https://www.chess.com/news/view/published-data-api

### Engines & models (V3)
- **Maia Chess** (1100–1900 separate models): https://github.com/CSSLab/maia-chess
- **Maia 2** (unified, 600–2600): https://github.com/CSSLab/maia2

### Background
- Maia paper (KDD 2020): https://arxiv.org/abs/2006.01855
- Maia-2 paper (NeurIPS 2024): https://www.cs.toronto.edu/~ashton/pubs/maia2-neurips2024.pdf

---

## 18. Definition of Done

### MVP (Phases 1–6, laptop-only)
You can call this done and start using it daily when:

1. You can paste any Chess.com or Lichess PGN and get an analyzed game review within ~60 seconds
2. Key moments are correctly flagged (best / good / inaccuracy / mistake / blunder)
3. Each key moment has a teacher-voice analysis under 100 words that references the actual position — not generic advice
4. You can ask "why not [move]?" on any key moment and get a grounded, engine-verified answer
5. Theme tags are stored per analysis
6. Everything persists across page reloads via IndexedDB

### V2 ship (Phases 7–9, deployed + iOS)
The product is "shipped" when:

7. Deployed to Vercel with API key safely server-side
8. Lichess username import works for the last 10+ games
9. Supabase sync means games are available across laptop + phone
10. Capacitor build installs on your phone via TestFlight and all features work

### V3 starts...
...after using V2 for a couple of weeks on real games. Only then do we know what the teacher voice gets right, what theme tags are over- or under-used, and where puzzle practice would help most.
