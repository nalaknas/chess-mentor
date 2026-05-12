// Conversation request shape + a STUB implementation. CHE-16 will
// replace `requestAssistantTurn` with the real agent loop that calls
// /api/converse, handles tool_use blocks, and runs evaluate_move
// against local Stockfish. The interface lives here so the UI can be
// built and verified against a stable contract first.

import type { ChatMessage } from '../types';
import type { ConversationContext } from './context';

export type ConversationPending = 'idle' | 'thinking' | 'tool-use';

export interface ConverseArgs {
  /** Static context for this position (FEN, eval, engine pick, etc.). */
  context: ConversationContext;
  /** Conversation so far: seed analysis message + any prior follow-ups. */
  history: ChatMessage[];
  /** What the user just typed. */
  newUserMessage: string;
  signal?: AbortSignal;
  /** Notifies the UI when the request transitions between thinking / tool-use / idle. */
  onPending?: (state: ConversationPending) => void;
}

export interface ConverseResult {
  /** Messages to APPEND after the user's message (assistant + any tool turns). */
  assistantMessages: ChatMessage[];
}

const STUB_DELAY_MS = 600;
const STUB_TEXT =
  '(Stubbed response — CHE-16 will wire `/api/converse` + the `evaluate_move` tool loop here. ' +
  'For now this just confirms the chat UI works end-to-end.)';

export async function requestAssistantTurn(
  args: ConverseArgs,
): Promise<ConverseResult> {
  args.onPending?.('thinking');
  await delay(STUB_DELAY_MS, args.signal);
  args.onPending?.('idle');

  return {
    assistantMessages: [
      {
        role: 'assistant',
        content: STUB_TEXT,
        timestamp: Date.now(),
      },
    ],
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
