# Teacher voice — good vs bad examples

Distilled from the CHE-19 A/B harness run on 3 real positions (see
`scripts/voice-ab.ts`, regenerate with `npx tsx scripts/voice-ab.ts`).
This is the spec §8 "lock in patterns" record for the production
prompt.

---

## ✅ Good — opening inaccuracy (d3 vs exd5)

> "d3 is a quiet move that doesn't punish Black's early d5. When Black
> attacks your e4 pawn, you had a chance to grab it first with exd5.
> Instead, d3 just supports the pawn defensively. The engine shows
> that after exd5 Qxd5 Nc3, you develop your knight with tempo by
> attacking the queen — gaining time and control of the center. Want
> to see how that line plays out?"

**Why it works**

- Names the consequence in plain English ("doesn't punish") before
  prescribing.
- States the better move with a *short concrete line* (Qxd5 Nc3).
- Surfaces the actual *idea* — "develop with tempo by attacking the
  queen" — not just the move.
- Ends with a soft invitation, not a demand.

---

## ✅ Good — empathy opener on a blunder (new in CHE-19)

> "Tough one — this kind of position trips a lot of players up. Qf1+
> forces the king to move, but it lets Black off the hook. The engine
> prefers Qh5+, which after Kxh5 lets your b-pawn race to f7 and
> promote in a few moves."

**Why it works**

- Single short empathy line acknowledges difficulty without coddling.
- *Then* gets surgical. Concrete (Qh5+, Kxh5, f7, promotion).
- Note: empathy openers only fire on `classification === 'blunder'`
  per the prompt rule — inaccuracies and mistakes don't warrant them
  and feel artificial if you add them everywhere.

---

## ❌ Bad — hallucinated piece (the failure that killed Variant B)

> "After Kf8 (or any king move), you can grab the **bishop on f7** with
> check. Your queen on f1 just doesn't threaten anything concrete."

**Why it fails**

In the FEN, **f7 holds the Black king**, not a bishop. There is no
bishop on f7. This is exactly the "hallucinated moves / miscounted
material" failure mode the spec calls out in §1 ("LLM chess analysis
that hallucinates moves").

**Root cause from the A/B**: this came from Variant B, which had a
tighter 60-80 word cap. Shrinking the budget pushed the model to take
visual shortcuts and invent details that fit the narrative.

**Mitigation in production prompt**: keep the 120-word cap from rule
#3 — don't trade words for pressure to be terse. The engine grounding
in the system context is what prevents this; the word budget should
be loose enough that the model can quote what it sees verbatim.

---

## ❌ Bad — abstract instead of concrete (a hypothetical, not from this A/B)

> "You missed the principle of king safety. White's king was uncastled
> and you should have exploited this."

**Why it fails**

- No squares, no pieces, no moves. "Exploit" without a how.
- A 950-rated player needs a square to look at and a move to consider,
  not a category to internalize.

**Production rule that catches this**: rule #2 — "Concrete language
('the c-file is wide open and your rook is right there') beats
abstract ('exploit the open file')."

---

## How to regenerate this

```sh
npx tsx scripts/voice-ab.ts
open voice-ab-results.md
```

`scripts/voice-ab.ts` reads `ANTHROPIC_API_KEY` from `.env.local`
and runs both the current production prompt and a tightened variant
side-by-side on 3 hand-picked fixture positions. Update the fixtures
in that file when you want to spot-check a specific position.
