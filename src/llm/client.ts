// Client-side glue: takes a ConversationContext, sends it through the
// /api/analyze proxy, and returns a parsed + validated InitialAnalysis
// response. The proxy already adds the auth header — the client never
// sees the API key.

import type { ThemeTag } from '../types';
import type { ConversationContext } from './context';
import { initialAnalysisPrompt, systemPrompt } from './prompts';
import { isThemeTag } from './theme-tags';

export const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 600;

export interface InitialAnalysis {
  explanation: string;
  themeTags: ThemeTag[];
  achievableMove?: string;
  achievableExplanation?: string;
  /** Echoes back the model name for the persisted Analysis record. */
  model: string;
}

export class LlmError extends Error {
  readonly status: number | undefined;
  readonly raw: string | undefined;

  constructor(message: string, status?: number, raw?: string) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
    this.raw = raw;
  }
}

interface RequestOptions {
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function requestInitialAnalysis(
  context: ConversationContext,
  options: RequestOptions = {},
): Promise<InitialAnalysis> {
  const model = options.model ?? DEFAULT_MODEL;
  const body = {
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: systemPrompt(context),
    messages: [{ role: 'user', content: initialAnalysisPrompt(context) }],
  };

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new LlmError(`Analyze proxy returned ${res.status}`, res.status, text);
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new LlmError('Anthropic response was not valid JSON', res.status, text);
  }

  const raw = extractText(envelope);
  if (!raw) {
    throw new LlmError(
      'Anthropic response had no text content',
      res.status,
      text,
    );
  }

  return parseAnalysis(raw, model);
}

// ─── Internals ─────────────────────────────────────────────────────

interface AnthropicEnvelope {
  content?: Array<{ type: string; text?: string }>;
}

function extractText(envelope: unknown): string | null {
  const e = envelope as AnthropicEnvelope;
  if (!e?.content?.length) return null;
  for (const block of e.content) {
    if (block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

/**
 * Parse Claude's response into a validated InitialAnalysis. Accepts a
 * raw JSON object or one wrapped in ```json fences (Claude sometimes
 * adds them despite instructions).
 */
export function parseAnalysis(raw: string, model: string): InitialAnalysis {
  const json = stripFences(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new LlmError(
      `Could not parse analysis JSON: ${err instanceof Error ? err.message : err}`,
      undefined,
      raw,
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new LlmError('Analysis JSON was not an object', undefined, raw);
  }

  const obj = parsed as Record<string, unknown>;
  const explanation = obj.explanation;
  if (typeof explanation !== 'string' || !explanation.trim()) {
    throw new LlmError('Analysis missing `explanation`', undefined, raw);
  }

  const themeTagsRaw = Array.isArray(obj.themeTags) ? obj.themeTags : [];
  const themeTags = themeTagsRaw.filter(isThemeTag);

  const achievableMove =
    typeof obj.achievableMove === 'string' && obj.achievableMove.trim()
      ? obj.achievableMove.trim()
      : undefined;
  const achievableExplanation =
    typeof obj.achievableExplanation === 'string' &&
    obj.achievableExplanation.trim()
      ? obj.achievableExplanation.trim()
      : undefined;

  return {
    explanation: explanation.trim(),
    themeTags,
    achievableMove,
    achievableExplanation,
    model,
  };
}

function stripFences(s: string): string {
  // Handle the common ```json … ``` and ``` … ``` cases.
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : s;
}
