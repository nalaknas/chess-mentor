import type { ChatMessage } from '../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-amber-100 px-3 py-2 text-sm text-amber-950">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    // Tool-call summaries (Phase 5 / CHE-16 will populate these).
    return (
      <div className="text-xs italic text-stone-500">
        {message.toolCall ? (
          <>
            <span className="font-mono">{message.toolCall.name}</span>
            {' → '}
            <span>
              {message.toolCall.result?.refutation ??
                (message.toolCall.result
                  ? `eval ${message.toolCall.result.eval}`
                  : 'pending')}
            </span>
          </>
        ) : (
          message.content
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-line text-sm leading-relaxed text-stone-800">
        {message.content}
      </div>
    </div>
  );
}
