import type { ConversationPending } from '../llm/converse';

const LABEL: Record<Exclude<ConversationPending, 'idle'>, string> = {
  thinking: 'Coach is thinking…',
  'tool-use': 'Checking the engine…',
};

interface PendingIndicatorProps {
  state: Exclude<ConversationPending, 'idle'>;
}

export function PendingIndicator({ state }: PendingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-stone-500">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
      <span className="animate-pulse">{LABEL[state]}</span>
    </div>
  );
}
