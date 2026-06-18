import { useEffect, useMemo, useState } from 'react';
import { deleteAiAttachment, loadAiAttachmentHealth, parseAiAttachmentFile } from '../../lib/ai-attachments-storage';
import { AiAttachmentHealth, AiAttachmentReference, AiParsedAttachment } from './types';
import { normalizeAttachmentFile } from './attachment-file';

type PendingAttachmentStatus = 'uploading' | 'ready' | 'error';

export interface PendingAttachment {
  attachment?: AiParsedAttachment;
  error?: string;
  fileName: string;
  localId: string;
  status: PendingAttachmentStatus;
}

function createLocalId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toReference(attachment: AiParsedAttachment): AiAttachmentReference {
  if (attachment.kind === 'image') {
    return {
      id: attachment.id,
      kind: 'image',
      fileName: attachment.fileName,
      mediaType: attachment.mediaType,
      fileSize: attachment.fileSize,
      width: attachment.width,
      height: attachment.height,
      summary: attachment.summary,
      summaryModel: attachment.summaryModel,
      summaryStatus: attachment.summaryStatus,
      summaryMetadata: attachment.summaryMetadata,
      analysisStatus: attachment.analysisStatus,
      analysisVersion: attachment.analysisVersion,
      analysisUpdatedAt: attachment.analysisUpdatedAt,
    };
  }

  return {
    id: attachment.id,
    kind: 'document',
    fileName: attachment.fileName,
    mediaType: attachment.mediaType,
    fileSize: attachment.fileSize,
    parser: attachment.parser,
    title: attachment.title,
    textChars: attachment.textChars,
    chunkCount: attachment.chunkCount,
    warningCount: attachment.warningCount,
    pageCount: attachment.pageCount,
    pdfReaderMode: attachment.pdfReaderMode,
  };
}

export function useAiAttachments() {
  const [parserHealth, setParserHealth] = useState<AiAttachmentHealth | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refreshHealth() {
      try {
        const nextHealth = await loadAiAttachmentHealth();
        if (!cancelled) {
          setParserHealth(nextHealth);
        }
      } catch (error) {
        if (!cancelled) {
          setParserHealth({
            available: false,
            parser: 'docling',
            message: 'The local Docling parser is unavailable.',
            details: error instanceof Error ? error.message : 'Unable to check parser health.',
          });
        }
      }
    }

    void refreshHealth();
    window.addEventListener('focus', refreshHealth);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshHealth);
    };
  }, []);

  async function addFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files).map(normalizeAttachmentFile);
    if (!nextFiles.length) {
      return;
    }

    const placeholders = nextFiles.map((file) => ({
      fileName: file.name,
      localId: createLocalId(),
      status: 'uploading' as const,
    }));
    setPendingAttachments((current) => [...current, ...placeholders]);

    await Promise.all(
      nextFiles.map(async (file, index) => {
        const localId = placeholders[index].localId;
        try {
          const attachment = await parseAiAttachmentFile(file);
          setPendingAttachments((current) =>
            current.map((item) => (item.localId === localId ? { ...item, attachment, status: 'ready' } : item)),
          );
          if (attachment.kind === 'document') {
            setParserHealth({
              available: true,
              parser: 'docling',
              message: 'The local Docling parser is available.',
            });
          }
        } catch (error) {
          setPendingAttachments((current) =>
            current.map((item) =>
              item.localId === localId
                ? { ...item, error: error instanceof Error ? error.message : 'Unable to parse this attachment.', status: 'error' }
                : item,
            ),
          );
        }
      }),
    );
  }

  async function removePendingAttachment(localId: string) {
    const attachment = pendingAttachments.find((item) => item.localId === localId)?.attachment;
    setPendingAttachments((current) => current.filter((item) => item.localId !== localId));
    if (attachment) {
      await deleteAiAttachment(attachment.id).catch(() => undefined);
    }
  }

  function clearReadyAttachments() {
    setPendingAttachments((current) => current.filter((item) => item.status !== 'ready'));
  }

  const readyAttachmentRefs = useMemo(
    () => pendingAttachments.flatMap((item) => (item.attachment ? [toReference(item.attachment)] : [])),
    [pendingAttachments],
  );

  return {
    clearReadyAttachments,
    hasAttachmentErrors: pendingAttachments.some((item) => item.status === 'error'),
    isUploadingAttachments: pendingAttachments.some((item) => item.status === 'uploading'),
    parserHealth,
    pendingAttachments,
    readyAttachmentRefs,
    addFiles,
    removePendingAttachment,
  };
}
