// CHE-16 smoke: just verify the EVALUATE_MOVE_TOOL definition has
// the shape Anthropic expects. The full executor needs a browser
// (chess.js + Stockfish worker) so it's verified via the manual
// browser test instead.
import { EVALUATE_MOVE_TOOL } from '../src/llm/tools';

const required = ['name', 'description', 'input_schema'] as const;
let failed = 0;

for (const key of required) {
  const has = key in EVALUATE_MOVE_TOOL;
  console.log(`${has ? 'ok' : 'FAIL'}  tool has \`${key}\``);
  if (!has) failed++;
}

const schema = (EVALUATE_MOVE_TOOL as { input_schema: { type?: string; properties?: Record<string, unknown>; required?: string[] } }).input_schema;
console.log(`${schema.type === 'object' ? 'ok' : 'FAIL'}  input_schema.type === 'object'`);
if (schema.type !== 'object') failed++;

const props = schema.properties ?? {};
for (const field of ['fen', 'move'] as const) {
  const has = field in props;
  console.log(`${has ? 'ok' : 'FAIL'}  input_schema.properties.${field}`);
  if (!has) failed++;
}

const requiredFields = schema.required ?? [];
for (const field of ['fen', 'move'] as const) {
  const has = requiredFields.includes(field);
  console.log(`${has ? 'ok' : 'FAIL'}  ${field} is in required[]`);
  if (!has) failed++;
}

// Round-trip through JSON.stringify (what the agent loop does)
try {
  const serialized = JSON.stringify(EVALUATE_MOVE_TOOL);
  const parsed = JSON.parse(serialized);
  const okShape =
    parsed.name === 'evaluate_move' &&
    parsed.input_schema?.type === 'object';
  console.log(`${okShape ? 'ok' : 'FAIL'}  JSON.stringify round-trip preserves shape`);
  if (!okShape) failed++;
} catch (e) {
  console.log(`FAIL  JSON.stringify threw: ${e}`);
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll tool-definition checks passed.');
