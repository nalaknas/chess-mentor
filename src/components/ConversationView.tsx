// Glues the cached initial analysis (AnalysisCard) to a follow-up
// chat thread. CHE-17 adds IndexedDB persistence + recentThemes
// carry-over from earlier key moments in the same game.

import { useEffect, useRef, useState } from 'react';
import {
  type ConversationPending,
  requestAssistantTurn,
} from '../llm/converse';
import { buildContext } from '../llm/context';
import {
  conversationId,
  getAnalysis,
  getConversation,
  recentThemesForPly,
  saveConversation,
} from '../persistence';
import type { ChatMessage, Conversation, Game, ThemeTag } from '../types';
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
  // The cached initial analysis text — passed to Claude so follow-ups
  // are coherent with the seed message.
  const [seedAnalysis, setSeedAnalysis] = useState<string | undefined>();
  // Themes from the most recent earlier key moment (spec section 7).
  const [recentThemes, setRecentThemes] = useState<ThemeTag[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  // Restore conversation, seed analysis, and recentThemes when ply
  // changes. The three fetches run in parallel.
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setPending('idle');
    setError(null);
    setSeedAnalysis(undefined);
    setRecentThemes([]);

    let cancelled = false;
    void (async () => {
      const [cachedAnalysis, conv, themes] = await Promise.all([
        getAnalysis(game.id, ply),
        getConversation(game.id, ply),
        recentThemesForPly(game.id, ply),
      ]);
      if (cancelled) return;
      setSeedAnalysis(cachedAnalysis?.explanation);
      if (conv) setMessages(conv.messages);
      setRecentThemes(themes);
    })();
    return () => {
      cancelled = true;
    };
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
      const context = buildContext({ game, ply, userElo, recentThemes });
      if (!context) {
        setError('Position not ready — engine analysis still pending?');
        return;
      }

      const result = await requestAssistantTurn({
        context,
        seedAnalysis,
        history: messages,
        newUserMessage: text,
        signal: controller.signal,
        onPending: setPending,
      });

      if (controller.signal.aborted) return;

      const finalMessages = [...messages, userMsg, ...result.assistantMessages];
      setMessages(finalMessages);

      // Persist the conversation so it survives navigation + reload.
      const persisted: Conversation = {
        id: conversationId(game.id, ply),
        gameId: game.id,
        ply,
        messages: finalMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveConversation(persisted);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setPending('idle');
    }
  };

  return (
    <div className="flex flex-1 flex-col md:min-h-0">
      {/* Scrollable middle region: seed analysis + chat thread.
          `min-h-0` is required so the flex child can shrink below
          its content height and let `overflow-y-auto` engage. */}
      <div className="space-y-3 border-t border-stone-200 p-3 md:flex-1 md:min-h-0 md:overflow-y-auto">
        <AnalysisCard
          game={game}
          ply={ply}
          userElo={userElo}
          recentThemes={recentThemes}
        />

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
      </div>

      {/* Fixed input region — pinned to the bottom of the side pane. */}
      <div className="flex-shrink-0 border-t border-stone-200 p-3">
        <ChatInput
          onSend={onSend}
          disabled={pending !== 'idle'}
        />
      </div>
    </div>
  );
}
