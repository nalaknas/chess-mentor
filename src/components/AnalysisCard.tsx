import { useEffect, useRef, useState } from 'react';
import { buildContext } from '../llm/context';
import { LlmError, requestInitialAnalysis } from '../llm/client';
import { analysisId, getAnalysis, saveAnalysis } from '../persistence';
import type { Analysis, Game } from '../types';

interface AnalysisCardProps {
  game: Game;
  ply: number;
  userElo: number;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; analysis: Analysis }
  | { kind: 'error'; message: string };

export function AnalysisCard({ game, ply, userElo }: AnalysisCardProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  // Bump to force a retry on the same (gameId, ply) after an error.
  const [retryNonce, setRetryNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const cached = await getAnalysis(game.id, ply);
        if (cancelled) return;
        if (cached) {
          setState({ kind: 'ready', analysis: cached });
          return;
        }

        const ctx = buildContext({ game, ply, userElo });
        if (!ctx) {
          setState({
            kind: 'error',
            message: 'Position not ready for analysis (engine output missing).',
          });
          return;
        }

        setState({ kind: 'loading' });
        const result = await requestInitialAnalysis(ctx, {
          signal: controller.signal,
        });
        if (cancelled) return;

        const record: Analysis = {
          id: analysisId(game.id, ply),
          gameId: game.id,
          ply,
          explanation: result.explanation,
          themeTags: result.themeTags,
          achievableMove: result.achievableMove,
          achievableExplanation: result.achievableExplanation,
          generatedAt: Date.now(),
          model: result.model,
        };
        await saveAnalysis(record);
        if (cancelled) return;
        setState({ kind: 'ready', analysis: record });
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        const message =
          err instanceof LlmError
            ? `${err.message}${err.raw ? ` — ${truncate(err.raw, 120)}` : ''}`
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ kind: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [game.id, ply, userElo, retryNonce]);

  return (
    <div className="border-t border-stone-200 pt-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
        Coach
      </div>
      {state.kind === 'loading' && (
        <div className="text-sm text-stone-500">
          <span className="inline-block animate-pulse">Thinking…</span>
        </div>
      )}
      {state.kind === 'idle' && (
        <div className="text-sm text-stone-400">Checking cache…</div>
      )}
      {state.kind === 'error' && (
        <div className="space-y-2 text-sm">
          <div className="text-red-600">{state.message}</div>
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-100"
          >
            Retry
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <AnalysisBody analysis={state.analysis} />
      )}
    </div>
  );
}

function AnalysisBody({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="whitespace-pre-line leading-relaxed text-stone-800">
        {analysis.explanation}
      </p>

      {analysis.achievableMove && (
        <div className="rounded-md bg-stone-50 p-2 text-xs text-stone-700">
          <span className="font-medium">Try:</span>{' '}
          <span className="font-mono">{analysis.achievableMove}</span>
          {analysis.achievableExplanation && (
            <span> — {analysis.achievableExplanation}</span>
          )}
        </div>
      )}

      {analysis.themeTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.themeTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
