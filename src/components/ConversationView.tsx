// Glues the cached initial analysis (AnalysisCard) to a follow-up
// chat thread. CHE-15 wires the UI; the send handler routes through
// `requestAssistantTurn`, which is stubbed today and gets wired to
// /api/converse + the evaluate_move tool loop in CHE-16.
//
// Conversation state is per-position and scoped to this component —
// switching plies clears the thread. CHE-17 will persist conversations
// to IndexedDB so they survive navigation.

import { useEffect, useRef, useState } from 'react';
import {
  type ConversationPending,
  requestAssistantTurn,
} from '../llm/converse';
import { buildContext } from '../llm/context';
import type { ChatMessage, Game } from '../types';
import { AnalysisCard } from './AnalysisCard';
import { ChatInput } from './ChatInput';
import { ChatMessageBubble } from './ChatMessageBubble';
import { PendingIndicator } from './PendingIndicator';

interface ConversationViewProps {
  game: Game;
  ply: number;
  userElo: number;
}

export function ConversationView({ game, ply, userElo }: ConversationViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ConversationPending>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  // Reset the thread when we move to a different key moment. CHE-17
  // will swap this for a load-from-IndexedDB hydration.
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setPending('idle');
    setError(null);
  }, [game.id, ply]);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Auto-scroll to bottom on new messages or pending changes.
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending]);

  const onSend = async (text: string) => {
    if (pending !== 'idle') return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const context = buildContext({ game, ply, userElo });
      if (!context) {
        setError('Position not ready — engine analysis still pending?');
        return;
      }

      const result = await requestAssistantTurn({
        context,
        history: [...messages, userMsg],
        newUserMessage: text,
        signal: controller.signal,
        onPending: setPending,
      });

      // Belt + suspenders: bail if the position changed mid-flight.
      if (controller.signal.aborted) return;

      setMessages((prev) => [...prev, ...result.assistantMessages]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setPending('idle');
    }
  };

  return (
    <div className="space-y-3">
      <AnalysisCard game={game} ply={ply} userElo={userElo} />

      {(messages.length > 0 || pending !== 'idle' || error) && (
        <div className="space-y-2 border-t border-stone-200 pt-3">
          {messages.map((msg, i) => (
            <ChatMessageBubble key={`${msg.timestamp}-${i}`} message={msg} />
          ))}
          {pending !== 'idle' && <PendingIndicator state={pending} />}
          {error && (
            <div className="text-xs text-red-600">
              Something went wrong: {error}
            </div>
          )}
          <div ref={scrollAnchorRef} />
        </div>
      )}

      <div className="border-t border-stone-200 pt-3">
        <ChatInput
          onSend={onSend}
          disabled={pending !== 'idle'}
        />
      </div>
    </div>
  );
}
