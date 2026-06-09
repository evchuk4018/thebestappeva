import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ArtifactCards } from './artifacts/ArtifactCards';
import { AssistantMessageActions } from './AssistantMessageActions';
import { AssistantMessageContent } from './AssistantMessageContent';
import { AssistantTracePanel } from './AssistantTracePanel';
import { AssistantMessage } from './types';

interface AssistantMessageCardProps {
  disabled: boolean;
  isStreaming?: boolean;
  message: AssistantMessage;
  onCopy: (messageId: string) => Promise<void> | void;
  onOpenArtifact: (artifactId: string) => void;
  onRegenerate: (messageId: string) => Promise<void> | void;
}

export function AssistantMessageCard({ disabled, isStreaming = false, message, onCopy, onOpenArtifact, onRegenerate }: AssistantMessageCardProps) {
  const [showThinking, setShowThinking] = useState(false);
  const hasTrace = Boolean(message.trace?.length);
  const isError = message.status === 'error';
  const isCancelled = message.status === 'cancelled';
  const cardClassName = isError
    ? 'rounded-2xl border border-[#5a2c2c] bg-[#2a1717] p-4 text-[#ffd9d9]'
    : isCancelled
      ? 'rounded-2xl border border-[#6a4a2d] bg-[#2d2218] p-4 text-[#f5dec8]'
      : 'rounded-2xl border border-transparent bg-transparent p-4';
  const metaLabel = isError ? 'Local model error' : isCancelled ? 'Stopped reply' : isStreaming ? 'Generating reply' : 'Local model';

  useEffect(() => {
    if (hasTrace && (isStreaming || !message.content.trim())) {
      setShowThinking(true);
    }
  }, [hasTrace, isStreaming, message.content]);

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
        {hasTrace && (
          <div className="w-full rounded-2xl border border-[#2f2f2b] bg-[#171715]">
            <button
              type="button"
              onClick={() => setShowThinking((current) => !current)}
              aria-expanded={showThinking}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-zinc-400"
            >
              <span>Thinking Progress</span>
              <ChevronDown size={14} className={`transition ${showThinking ? 'rotate-180' : ''}`} />
            </button>
            {showThinking && message.trace && <AssistantTracePanel steps={message.trace} />}
          </div>
        )}

        <div className={cardClassName}>
          {isError && <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#ffb3b3]">Failed reply</p>}
          {isCancelled && <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#f0bb8f]">Stopped reply</p>}
          <AssistantMessageContent content={message.content} />
          <ArtifactCards cards={message.artifactCards ?? []} onOpen={onOpenArtifact} />
        </div>

        <AssistantMessageActions disabled={disabled} messageId={message.id} onCopy={onCopy} onRegenerate={onRegenerate} />
      </div>
    </div>
  );
}
