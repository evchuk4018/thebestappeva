import { Paperclip } from 'lucide-react';
import { AiAttachmentReference } from './types';

interface MessageAttachmentListProps {
  attachments: AiAttachmentReference[];
}

function formatImageAttachmentDetail(attachment: Extract<AiAttachmentReference, { kind: 'image' }>) {
  const preview = attachment.summary.slice(0, 40);
  const suffix = attachment.summary.length > 40 ? '...' : '';
  const fallback = attachment.summaryMetadata?.fallbackUsed ? 'online->local fallback | ' : '';
  return `${attachment.id} | ${fallback}${preview}${suffix}`;
}

export function MessageAttachmentList({ attachments }: MessageAttachmentListProps) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-2 rounded-xl border border-[#353531] bg-[#181816] px-3 py-2 text-[11px] text-zinc-300">
          <Paperclip size={12} className="text-[#e2875e]" />
          <span className="max-w-52 truncate">{attachment.fileName}</span>
          <span className="text-zinc-500">{attachment.kind === 'image'
            ? formatImageAttachmentDetail(attachment)
            : attachment.pdfReaderMode === 'tool'
              ? `${attachment.pageCount ?? '?'} pages | PDF reader`
              : attachment.pdfReaderMode === 'inline'
                ? `${attachment.pageCount} pages | loaded`
                : `${attachment.chunkCount} chunks`}</span>
        </div>
      ))}
    </div>
  );
}
