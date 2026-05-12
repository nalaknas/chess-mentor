import { useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  disabled?: boolean;
  onSend: (value: string) => void;
  placeholder?: string;
}

export function ChatInput({
  disabled = false,
  onSend,
  placeholder = 'Ask a follow-up… (e.g. "why not Bb1?")',
}: ChatInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className="flex-1 resize-none rounded-md border border-stone-300 bg-white p-2 text-sm focus:border-amber-500 focus:outline-none disabled:bg-stone-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="rounded-md bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        Send
      </button>
    </div>
  );
}
