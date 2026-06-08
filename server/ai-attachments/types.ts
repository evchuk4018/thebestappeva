import { AiParsedAttachment } from '../../shared/ai-attachments-contract';

export interface StoredAiAttachmentChunk {
  id: string;
  heading: string | null;
  text: string;
}

export interface StoredAiAttachmentPage {
  markdown: string;
  pageNumber: number;
  text: string;
}

export interface StoredAiAttachmentRecord {
  attachment: AiParsedAttachment;
  markdown: string;
  text: string;
  chunks: StoredAiAttachmentChunk[];
  pages?: StoredAiAttachmentPage[];
  sourceExtension: string;
}

export interface ParsedDocumentPage {
  markdown: string;
  pageNumber: number;
  text: string;
}

export interface ParsedDocumentPayload {
  title: string;
  markdown: string;
  text: string;
  pages?: ParsedDocumentPage[];
  warnings: string[];
  stats: {
    pageCount: number | null;
    sheetCount: number | null;
  };
}
