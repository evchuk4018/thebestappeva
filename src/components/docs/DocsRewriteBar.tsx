interface DocsRewriteBarProps {
  error: string | null;
  isOpen: boolean;
  prompt: string;
  selectedText: string;
  status: 'idle' | 'loading' | 'preview' | 'error';
  onApprove: () => void;
  onClose: () => void;
  onGenerate: () => void;
  onPromptChange: (value: string) => void;
  onQuickAction: (value: string) => void;
  onReject: () => void;
}

const quickActions = ['Grammar', 'Rewrite', 'Shorter', 'Longer'];

function getButtonLabel(status: DocsRewriteBarProps['status']) {
  return status === 'loading' ? 'Rewriting...' : status === 'preview' ? 'Regenerate' : 'Generate';
}

export function DocsRewriteBar({
  error,
  isOpen,
  prompt,
  selectedText,
  status,
  onApprove,
  onClose,
  onGenerate,
  onPromptChange,
  onQuickAction,
  onReject,
}: DocsRewriteBarProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-4xl rounded-[28px] border border-[#312451] bg-[#11131a]/95 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.55)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c4b5fd]">Selected text</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">{selectedText}</p>
          </div>
          <button onClick={onClose} className="rounded-full px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white">
            Close
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => onQuickAction(action)}
              className="rounded-full border border-[#44326d] bg-[#1a1630] px-3 py-1.5 text-xs font-medium text-[#ddd6fe] transition hover:border-[#6d4bc2] hover:text-white"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="sr-only">Rewrite prompt</span>
            <input
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Tell Ollama how to rewrite the selection..."
              className="w-full rounded-2xl border border-[#34294c] bg-[#090b11] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#8b5cf6]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onGenerate}
              disabled={status === 'loading'}
              className="rounded-full bg-[#8b5cf6] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:bg-[#5b4394]"
            >
              {getButtonLabel(status)}
            </button>
            <button
              onClick={onReject}
              disabled={status === 'loading' || status === 'idle'}
              className="rounded-full border border-[#4c326f] px-4 py-2 text-sm text-zinc-200 transition hover:border-[#8b5cf6] hover:text-white disabled:cursor-not-allowed disabled:border-[#2f2940] disabled:text-zinc-600"
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              disabled={status !== 'preview'}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#1b132a] transition hover:bg-[#ede9fe] disabled:cursor-not-allowed disabled:bg-[#272233] disabled:text-zinc-500"
            >
              Approve
            </button>
          </div>
        </div>
        <div className="mt-3 min-h-5 text-xs text-zinc-400">
          {error ? <span className="text-[#fda4af]">{error}</span> : status === 'preview' ? 'Purple text is a pending Ollama rewrite until you approve it.' : 'Press / with text selected to open this rewrite bar.'}
        </div>
      </div>
    </div>
  );
}
