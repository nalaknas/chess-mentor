// Multi-turn conversation with Claude, with `evaluate_move` as a
// local tool. The agent loop:
//   1. POST to /api/converse with current messages + tool defs.
//   2. If response has tool_use blocks → run them locally → append
//      tool_result blocks → loop.
//   3. Otherwise → extract final text → return to UI.
// Hard caps:
//   - MAX_ITERATIONS (5) prevents infinite tool-use loops.
//   - max_tokens (1024) bounds each turn.
//   - AbortSignal cancels in-flight requests when the user navigates.

import type { ChatMessage } from '../types';
import type { ConversationContext } from './context';
import { systemPrompt } from './prompts';
import { EVALUATE_MOVE_TOOL, executeEvaluateMove } from './tools';

export type ConversationPending = 'idle' | 'thinking' | 'tool-use';

export interface ConverseArgs {
  context: ConversationContext;
  /** Optional initial assistant message — usually the cached AnalysisCard text. */
  seedAnalysis?: string;
  /** Visible thread so far (user/assistant text turns only — no tool blocks). */
  history: ChatMessage[];
  newUserMessage: string;
  signal?: AbortSignal;
  onPending?: (state: ConversationPending) => void;
}

export interface ConverseResult {
  assistantMessages: ChatMessage[];
}

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 1024;
const MAX_ITERATIONS = 5;

// ─── Anthropic wire types (subset we use) ──────────────────────────

interface TextBlock {
  type: 'text';
  text: string;
}
interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

// ─── Main entry point ──────────────────────────────────────────────

export async function requestAssistantTurn(
  args: ConverseArgs,
): Promise<ConverseResult> {
  const { context, seedAnalysis, history, newUserMessage, signal, onPending } = args;

  const messages: AnthropicMessage[] = [];
  if (seedAnalysis) {
    messages.push({ role: 'assistant', content: seedAnalysis });
  }
  for (const m of history) {
    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: m.content });
    }
  }
  messages.push({ role: 'user', content: newUserMessage });

  const system = systemPrompt(context, { withTool: true, jsonResponse: false });
  let finalText = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    onPending?.('thinking');
    const response = await postConverse({ system, messages, signal });

    // Append the assistant's response to the running message log.
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'tool_use') {
      onPending?.('tool-use');
      const toolResults: ContentBlock[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        if (block.name !== 'evaluate_move') {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
            is_error: true,
          });
          continue;
        }
        const input = block.input as { fen?: unknown; move?: unknown };
        if (typeof input.fen !== 'string' || typeof input.move !== 'string') {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({
              error: 'evaluate_move requires string `fen` and `move` arguments',
            }),
            is_error: true,
          });
          continue;
        }
        try {
          const result = await executeEvaluateMove({
            fen: input.fen,
            move: input.move,
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // end_turn, max_tokens, stop_sequence — done. Use this turn's text.
    finalText = extractText(response.content);
    break;
  }

  onPending?.('idle');

  if (!finalText) {
    finalText =
      "I got tangled up checking that — could you rephrase or ask a more specific question?";
  }

  return {
    assistantMessages: [
      {
        role: 'assistant',
        content: finalText,
        timestamp: Date.now(),
      },
    ],
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

async function postConverse(args: {
  system: string;
  messages: AnthropicMessage[];
  signal?: AbortSignal;
}): Promise<AnthropicResponse> {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: args.system,
    messages: args.messages,
    tools: [EVALUATE_MOVE_TOOL],
  };
  const res = await fetch('/api/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: args.signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `/api/converse returned ${res.status}: ${truncate(text, 200)}`,
    );
  }
  try {
    return JSON.parse(text) as AnthropicResponse;
  } catch {
    throw new Error('Anthropic response was not valid JSON');
  }
}

function extractText(content: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text) parts.push(block.text);
  }
  return parts.join('\n\n').trim();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
