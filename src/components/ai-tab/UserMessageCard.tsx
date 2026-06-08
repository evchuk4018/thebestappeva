import { Check, Copy, Pencil, RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MessageAttachmentList } from './MessageAttachmentList';
import { getUserMessageVersionInfo } from './message-branches';
import { UserMessage } from './types';

interface UserMessageCardProps {
  disabled: boolean;
  message: UserMessage;
  onCopy: (messageId: string) => Promise<void> | void;
  onEdit: (messageId: string, nextContent: string) => Promise<void> | void;
  onSwitchVersion: (messageId: string, direction: 'previous' | 'next') => void;
}

export function UserMessageCard({ disabled, message, onCopy, onEdit, onSwitchVersion }: UserMessageCardProps) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isEditing, setIsEditing] = useState(false);
  const { activeIndex, total } = getUserMessageVersionInfo(message);
  const canResend = Boolean(draft.trim()) && draft.trim() !== message.content.trim() && !disabled;

  useEffect(() => {
    if (!isEditing) {
      setDraft(message.content);
    }
  }, [isEditing, message.content]);

  async function handleCopy() {
    try {
      await onCopy(message.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  async function handleResend() {
    if (!canResend) {
      return;
    }

    setIsEditing(false);
    await onEdit(message.id, draft);
  }

  return (
    <div className="flex max-w-full flex-col items-end">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium text-zinc-500">
        <span>john skibidi</span>
        <span className="h-1 w-1 rounded-full bg-zinc-600" />
        <span>User</span>
      </div>

      <div className="max-w-[85%] rounded-2xl border border-[#2f2f2b]/80 bg-[#21211f]/60 p-4 text-left text-sm leading-relaxed text-zinc-100 shadow-sm">
        {isEditing ? (
          <textarea
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-24 w-full resize-y border-none bg-transparent text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        ) : (
          <div>
            <p className="whitespace-pre-line">{message.content}</p>
            <MessageAttachmentList attachments={message.attachments ?? []} />
          </div>
        )}
      </div>

      <div className="mt-1.5 flex max-w-[85%] flex-wrap items-center justify-end gap-1 text-zinc-500">
        {total > 1 && (
          <div className="mr-1 flex items-center overflow-hidden rounded-lg border border-[#2f2f2b] bg-[#1a1a18] text-[10px] text-zinc-400">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSwitchVersion(message.id, 'previous')}
              aria-label="Previous edit"
              className="px-1.5 py-1 hover:bg-[#282825] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
            >
              {'<'}
            </button>
            <span className="min-w-8 border-x border-[#2f2f2b] px-1.5 py-1 text-center">{activeIndex + 1}/{total}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSwitchVersion(message.id, 'next')}
              aria-label="Next edit"
              className="px-1.5 py-1 hover:bg-[#282825] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
            >
              {'>'}
            </button>
          </div>
        )}

        {isEditing ? (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg p-1.5 hover:bg-[#282825] hover:text-zinc-200"
              aria-label="Cancel edit"
            >
              <X size={13} />
            </button>
            <button
              type="button"
              disabled={!canResend}
              onClick={() => void handleResend()}
              className="rounded-lg p-1.5 hover:bg-[#282825] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
              aria-label="Resend edited prompt"
            >
              {disabled ? <RotateCcw size={13} /> : <Send size={13} />}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsEditing(true)}
              className="rounded-lg p-1.5 hover:bg-[#282825] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
              aria-label="Edit prompt"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-lg p-1.5 hover:bg-[#282825] hover:text-zinc-200"
              aria-label="Copy prompt"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
