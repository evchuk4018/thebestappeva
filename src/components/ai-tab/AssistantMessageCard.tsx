import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { AssistantMessage } from './types';

interface AssistantMessageCardProps {
  message: AssistantMessage;
}

export function AssistantMessageCard({ message }: AssistantMessageCardProps) {
  const [showThinking, setShowThinking] = useState(false);
  const hasThinking = Boolean(message.thinking?.trim());
  const isError = message.status === 'error';
  const cardClassName = isError
    ? 'rounded-2xl border border-[#5a2c2c] bg-[#2a1717] p-4 text-[#ffd9d9]'
    : 'rounded-2xl border border-transparent bg-transparent p-4';
  const metaLabel = isError ? 'Local model error' : 'Local model';

  return (
    <div className="flex max-w-full flex-col items-start">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="text-[#e2875e]">*</span>
          <span>{message.model ?? 'Ollama'}</span>
        </span>
        <span className="h-1 w-1 rounded-full bg-zinc-600" />
        <span>{metaLabel}</span>
      </div>

      <div className="flex max-w-full flex-col gap-3 rounded-2xl border border-transparent bg-transparent text-left text-sm leading-relaxed text-zinc-200 shadow-sm">
        {hasThinking && (
          <div className="w-full rounded-2xl border border-[#2f2f2b] bg-[#171715]">
            <button
              type="button"
              onClick={() => setShowThinking((current) => !current)}
              aria-expanded={showThinking}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-zinc-400"
            >
              <span>Thinking</span>
              <ChevronDown size={14} className={`transition ${showThinking ? 'rotate-180' : ''}`} />
            </button>
            {showThinking && (
              <div className="border-t border-[#2a2a27] px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{message.thinking}</p>
              </div>
            )}
          </div>
        )}

        <div className={cardClassName}>
          {isError && <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#ffb3b3]">Failed reply</p>}
          <p className="whitespace-pre-line">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
