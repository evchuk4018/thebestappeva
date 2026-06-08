import { LoaderCircle, Paperclip, TriangleAlert, X } from 'lucide-react';
import { PendingAttachment } from './useAiAttachments';

interface PendingAttachmentTrayProps {
  attachments: PendingAttachment[];
  onRemove: (localId: string) => Promise<void> | void;
}

export function PendingAttachmentTray({ attachments, onRemove }: PendingAttachmentTrayProps) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.localId}
          className={`flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            attachment.status === 'error'
              ? 'border-[#653737] bg-[#2b1b1b] text-[#f4c5c5]'
              : 'border-[#343430] bg-[#181816] text-zinc-300'
          }`}
        >
          {attachment.status === 'uploading' ? <LoaderCircle size={13} className="animate-spin text-[#e2875e]" /> : attachment.status === 'error' ? <TriangleAlert size={13} /> : <Paperclip size={13} />}
          <span className="max-w-52 truncate">{attachment.fileName}</span>
          {attachment.status === 'ready' && attachment.attachment && (
            <span className="text-[10px] text-zinc-500">
              {attachment.attachment.pdfReaderMode === 'tool'
                ? `${attachment.attachment.pageCount ?? '?'} pages | PDF reader`
                : attachment.attachment.pdfReaderMode === 'inline'
                  ? `${attachment.attachment.pageCount} pages | loaded`
                  : `${attachment.attachment.chunkCount} chunks`}
            </span>
          )}
          {attachment.status === 'error' && attachment.error && (
            <span className="max-w-44 truncate text-[10px] text-[#dfa7a7]">{attachment.error}</span>
          )}
          <button type="button" onClick={() => void onRemove(attachment.localId)} className="rounded-full p-0.5 hover:bg-white/5">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
