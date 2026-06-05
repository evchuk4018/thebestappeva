import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AssistantMessageActionsProps {
  disabled: boolean;
  messageId: string;
  onCopy: (messageId: string) => Promise<void> | void;
  onRegenerate: (messageId: string) => Promise<void> | void;
}

export function AssistantMessageActions({ disabled, messageId, onCopy, onRegenerate }: AssistantMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function handleCopy() {
    try {
      await onCopy(messageId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-1.5 flex max-w-full flex-wrap items-center gap-1 text-zinc-500">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded-lg p-1.5 hover:bg-[#282825] hover:text-zinc-200"
        aria-label="Copy reply"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onRegenerate(messageId)}
        className="rounded-lg p-1.5 hover:bg-[#282825] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
        aria-label="Regenerate reply"
      >
        <RotateCcw size={13} />
      </button>
      <button
        type="button"
        disabled
        aria-label="Thumbs up"
        className="rounded-lg p-1.5 text-zinc-700 disabled:cursor-default"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        type="button"
        disabled
        aria-label="Thumbs down"
        className="rounded-lg p-1.5 text-zinc-700 disabled:cursor-default"
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}
