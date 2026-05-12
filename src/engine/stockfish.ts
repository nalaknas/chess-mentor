// Thin wrapper around the Stockfish.wasm worker (multi-threaded lite
// build, served from /public). Exposes a promise-based
// analyzePosition() and queues requests so one engine instance can be
// shared across the app.

export interface EngineResult {
  bestMove: string;
  evalCp: number;
  pv: string[];
  depth: number;
}

const WORKER_URL = '/stockfish-18-lite-single.js';
const MATE_SCORE = 30000;

class StockfishEngine {
  private worker: Worker | null = null;
  private listeners: Array<(line: string) => void> = [];
  private queue: Promise<unknown> = Promise.resolve();
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.worker = new Worker(WORKER_URL);
      this.worker.onmessage = (e: MessageEvent<string>) => {
        for (const l of this.listeners.slice()) l(e.data);
      };
      await this.waitFor('uciok', () => this.send('uci'));
      await this.waitFor('readyok', () => this.send('isready'));
    })();
    return this.initPromise;
  }

  analyzePosition(fen: string, depth = 18): Promise<EngineResult> {
    return this.enqueue(async () => {
      await this.init();
      return this.runAnalysis(fen, depth);
    });
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.listeners = [];
  }

  private send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => task());
    this.queue = next.catch(() => {});
    return next;
  }

  private waitFor(token: string, trigger: () => void): Promise<void> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        if (line.includes(token)) {
          this.listeners = this.listeners.filter((l) => l !== listener);
          resolve();
        }
      };
      this.listeners.push(listener);
      trigger();
    });
  }

  private runAnalysis(fen: string, depth: number): Promise<EngineResult> {
    return new Promise((resolve) => {
      let evalCp = 0;
      let pv: string[] = [];
      let curDepth = 0;

      const listener = (line: string) => {
        if (line.startsWith('info')) {
          const dm = line.match(/\bdepth (\d+)\b/);
          if (dm) curDepth = parseInt(dm[1], 10);

          const cpm = line.match(/\bscore cp (-?\d+)/);
          const mm = line.match(/\bscore mate (-?\d+)/);
          if (cpm) {
            evalCp = parseInt(cpm[1], 10);
          } else if (mm) {
            // Map mate-in-N to a score near ±MATE_SCORE; closer mates
            // get larger magnitudes so they sort correctly.
            const n = parseInt(mm[1], 10);
            evalCp = n > 0 ? MATE_SCORE - n : -MATE_SCORE - n;
          }

          const pvm = line.match(/ pv ([^\n]+)$/);
          if (pvm) pv = pvm[1].trim().split(/\s+/);
        } else if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/);
          const bestMove = parts[1] && parts[1] !== '(none)' ? parts[1] : '';
          this.listeners = this.listeners.filter((l) => l !== listener);
          resolve({ bestMove, evalCp, pv, depth: curDepth });
        }
      };

      this.listeners.push(listener);
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }
}

let _engine: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!_engine) _engine = new StockfishEngine();
  return _engine;
}

export function isMateScore(cp: number): boolean {
  return Math.abs(cp) >= MATE_SCORE - 1000;
}

export function matePliesFrom(cp: number): number {
  return cp > 0 ? MATE_SCORE - cp : -MATE_SCORE - cp;
}
