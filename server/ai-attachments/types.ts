import { AiParsedAttachment } from '../../shared/ai-attachments-contract';

export interface StoredAiAttachmentChunk {
  id: string;
  heading: string | null;
  text: string;
}

export interface StoredAiAttachmentRecord {
  attachment: AiParsedAttachment;
  markdown: string;
  text: string;
  chunks: StoredAiAttachmentChunk[];
  sourceExtension: string;
}

export interface ParsedDocumentPayload {
  title: string;
  markdown: string;
  text: string;
  warnings: string[];
  stats: {
    pageCount: number | null;
    sheetCount: number | null;
  };
}
