#!/usr/bin/env node
// Copy the Stockfish wasm engine into public/ so Vite serves it
// at predictable URLs. Re-run automatically after `npm install` via
// the "postinstall" hook in package.json.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBLIC_DIR = resolve('public');
const SRC_DIR = resolve('node_modules/stockfish/bin');

const FILES = ['stockfish-18-lite.js', 'stockfish-18-lite.wasm'];

if (!existsSync(SRC_DIR)) {
  console.warn('[copy-stockfish] node_modules/stockfish not found; skipping.');
  process.exit(0);
}

mkdirSync(PUBLIC_DIR, { recursive: true });
for (const name of FILES) {
  copyFileSync(resolve(SRC_DIR, name), resolve(PUBLIC_DIR, name));
  console.log(`[copy-stockfish] public/${name}`);
}
