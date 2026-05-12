// CHE-9 smoke: verify classification thresholds and mate handling.
import { classify } from '../src/engine/classify';

type Row = [string, ReturnType<typeof classify>['classification'], boolean];

const cases: Array<{ name: string; before: number; after: number; ply: number; expect: Row }> = [
  // ply 1 = White moved. evalDrop = before - after.
  { name: 'White best (drop 0)',        before:   30, after:   30, ply: 1, expect: ['White best (drop 0)',        'best',        false] },
  { name: 'White good (drop 20)',       before:   50, after:   30, ply: 1, expect: ['White good (drop 20)',       'good',        false] },
  { name: 'White inaccuracy (drop 50)', before:   80, after:   30, ply: 1, expect: ['White inaccuracy (drop 50)', 'inaccuracy',  true]  },
  { name: 'White mistake (drop 120)',   before:  150, after:   30, ply: 1, expect: ['White mistake (drop 120)',   'mistake',     true]  },
  { name: 'White blunder (drop 300)',   before:  300, after:    0, ply: 1, expect: ['White blunder (drop 300)',   'blunder',     true]  },

  // ply 2 = Black moved. evalDrop = after - before (positive = Black got worse).
  { name: 'Black best',                 before:    0, after:    0, ply: 2, expect: ['Black best',                 'best',        false] },
  { name: 'Black blunder (drop 250)',   before: -100, after:  150, ply: 2, expect: ['Black blunder (drop 250)',   'blunder',     true]  },
  { name: 'Black improvement (drop -100)', before: 0, after: -100, ply: 2, expect: ['Black improvement (drop -100)', 'best',     false] },

  // CHE-52: mate transitions
  // White had mate-in-3 (+29997), now no mate (+0) -> drop ~29997 -> blunder.
  { name: 'White missed mate',          before: 29997, after:     0, ply: 1, expect: ['White missed mate',         'blunder',     true]  },
  // White was even (0), walks into mate-in-3 for Black (-29997) -> drop ~29997 -> blunder.
  { name: 'White walked into mate',     before:     0, after: -29997, ply: 1, expect: ['White walked into mate',    'blunder',     true]  },
  // Black had mate-in-3 (-29997), now no mate (0) for Black means white got better -> Black drop ~29997 -> blunder.
  { name: 'Black missed mate',          before: -29997, after:    0, ply: 2, expect: ['Black missed mate',         'blunder',     true]  },
  // Both positions mate-winning for white, just slower mate (29997 -> 29995) -> small drop -> best.
  { name: 'White slower mate',          before: 29997, after: 29995, ply: 1, expect: ['White slower mate',         'best',        false] },
];

let failed = 0;
for (const c of cases) {
  const got = classify({ evalBefore: c.before, evalAfter: c.after, ply: c.ply });
  const [, expectedClass, expectedKey] = c.expect;
  const pass = got.classification === expectedClass && got.isKeyMoment === expectedKey;
  console.log(
    `${pass ? 'ok' : 'FAIL'}  ${c.name.padEnd(35)} drop=${String(got.evalDrop).padStart(6)} class=${got.classification.padEnd(10)} key=${got.isKeyMoment}`,
  );
  if (!pass) {
    console.log(`     expected class=${expectedClass} key=${expectedKey}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll CHE-9 classification cases passed.');
