import { loadAiPdfPage, loadAiPdfPageImage, loadAiPdfPages, searchAiPdf } from '../../../lib/ai-attachments-storage';
import { getModelCapabilities } from '../ollama-client';
import { AiAttachmentReference, AiMessage } from '../types';
import { ToolExecutionResult, ToolRegistryEntry } from './types';

function isPdf(attachment: AiAttachmentReference): attachment is Extract<AiAttachmentReference, { kind: 'document' }> {
  if (attachment.kind !== 'document') {
    return false;
  }
  return attachment.fileName.toLowerCase().endsWith('.pdf') || attachment.mediaType === 'application/pdf';
}

export function isLongPdfAttachment(attachment: AiAttachmentReference) {
  if (!isPdf(attachment)) {
    return false;
  }

  const pdfAttachment = attachment;
  if (attachment.pdfReaderMode) {
    return pdfAttachment.pdfReaderMode === 'tool';
  }

  return pdfAttachment.pageCount == null || pdfAttachment.pageCount > 3;
}

export function collectLongPdfAttachments(messages: AiMessage[]) {
  const attachments = messages.flatMap((message) => (message.kind === 'user' ? message.attachments ?? [] : []));
  return [...new Map(attachments.filter(isLongPdfAttachment).map((attachment) => [attachment.id, attachment])).values()];
}

function requireString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`pdf_reader requires a non-empty \`${name}\` argument.`);
  }

  return value.trim();
}

function requirePageNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('pdf_reader requires `pageNumber` as a positive integer.');
  }

  return value;
}

function optionalPageNumber(value: unknown, name: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`pdf_reader requires \`${name}\` as a positive integer when provided.`);
  }

  return value;
}

function optionalLimit(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(10, Math.round(value))) : 10;
}

function requireAttachment(attachments: AiAttachmentReference[], attachmentId: unknown) {
  const id = requireString(attachmentId, 'attachmentId');
  const attachment = attachments.find((candidate) => candidate.id === id);
  if (!attachment) {
    throw new Error(`PDF "${id}" is not available in this chat.`);
  }

  return attachment;
}

function result(
  toolId: string,
  functionName: string,
  summary: string,
  data: Record<string, unknown>,
): ToolExecutionResult {
  return { toolId, functionName, ok: true, summary, data };
}

export function createPdfReaderTool(attachments: AiAttachmentReference[]): ToolRegistryEntry {
  return {
    definition: {
      id: 'pdf-reader',
      label: 'PDF Reader',
      alias: '/pdf-reader',
      description: 'Reads long PDFs attached to this chat. Use read_pdf_pages first for complete document audits.',
      enabledByDefault: false,
      automatic: true,
      functions: [
        {
          name: 'search_pdf',
          description: 'Search an attached PDF for a specific non-empty word or phrase and return page-numbered snippets.',
          parameters: [
            { name: 'attachmentId', type: 'string', description: 'Attachment ID shown in the PDF summary.', required: true },
            { name: 'query', type: 'string', description: 'Case-insensitive word or phrase to search for.', required: true },
            { name: 'limit', type: 'number', description: 'Maximum matches to return, from 1 to 10.' },
          ],
        },
        {
          name: 'read_pdf_pages',
          description: 'Read a consecutive page range. For a complete audit, call this first without page bounds; at most 25 pages are returned.',
          parameters: [
            { name: 'attachmentId', type: 'string', description: 'Attachment ID shown in the PDF summary.', required: true },
            { name: 'startPage', type: 'number', description: 'Optional one-based first page; defaults to page 1.' },
            { name: 'endPage', type: 'number', description: 'Optional one-based last page; defaults to the document end, capped to 25 pages.' },
          ],
        },
        {
          name: 'read_pdf_page',
          description: 'Load extracted text and Markdown from one page of an attached PDF.',
          parameters: [
            { name: 'attachmentId', type: 'string', description: 'Attachment ID shown in the PDF summary.', required: true },
            { name: 'pageNumber', type: 'number', description: 'One-based PDF page number.', required: true },
          ],
        },
        {
          name: 'view_pdf_page',
          description: 'Render one PDF page and inspect it visually; page text is returned as a fallback.',
          parameters: [
            { name: 'attachmentId', type: 'string', description: 'Attachment ID shown in the PDF summary.', required: true },
            { name: 'pageNumber', type: 'number', description: 'One-based PDF page number.', required: true },
          ],
        },
      ],
    },
    async execute(invocation, context) {
      const attachment = requireAttachment(attachments, invocation.args.attachmentId);

      if (invocation.functionName === 'search_pdf') {
        const query = requireString(invocation.args.query, 'query');
        const payload = await searchAiPdf(attachment.id, query, optionalLimit(invocation.args.limit));
        return result(
          invocation.toolId,
          invocation.functionName,
          `Found ${payload.matchCount} match${payload.matchCount === 1 ? '' : 'es'} for "${query}" in ${attachment.fileName}.`,
          { attachmentId: attachment.id, fileName: attachment.fileName, ...payload },
        );
      }

      if (invocation.functionName === 'read_pdf_pages') {
        const startPage = optionalPageNumber(invocation.args.startPage, 'startPage');
        const endPage = optionalPageNumber(invocation.args.endPage, 'endPage');
        if (startPage && endPage && endPage < startPage) {
          throw new Error('pdf_reader requires `endPage` to be greater than or equal to `startPage`.');
        }

        const payload = await loadAiPdfPages(attachment.id, startPage, endPage);
        const firstPage = payload.pages[0]?.pageNumber;
        const lastPage = payload.pages.at(-1)?.pageNumber;
        const range = firstPage && lastPage ? `pages ${firstPage}-${lastPage}` : 'no pages';
        return result(
          invocation.toolId,
          invocation.functionName,
          `Loaded ${range} of ${payload.pageCount} from ${attachment.fileName}.`,
          { attachmentId: attachment.id, fileName: attachment.fileName, ...payload },
        );
      }

      const pageNumber = requirePageNumber(invocation.args.pageNumber);
      if (invocation.functionName === 'read_pdf_page') {
        const payload = await loadAiPdfPage(attachment.id, pageNumber);
        return result(invocation.toolId, invocation.functionName, `Loaded page ${pageNumber} of ${attachment.fileName}.`, {
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          ...payload,
        });
      }

      const payload = await loadAiPdfPageImage(attachment.id, pageNumber);
      const capabilities = context.model ? await getModelCapabilities(context.model, context.provider ?? 'ollama') : [];
      if (!capabilities.includes('vision')) {
        const message = `The selected model cannot inspect page images because it does not support vision. Extracted page text is included instead.`;
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: false,
          summary: message,
          error: message,
          data: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            pageNumber,
            text: payload.text,
          },
        };
      }

      return {
        ...result(invocation.toolId, invocation.functionName, `Rendered page ${pageNumber} of ${attachment.fileName}.`, {
          attachmentId: attachment.id,
          cached: payload.cached,
          fileName: attachment.fileName,
          pageNumber,
          text: payload.text,
        }),
        transientImages: [payload.base64Data],
      };
    },
  };
}
