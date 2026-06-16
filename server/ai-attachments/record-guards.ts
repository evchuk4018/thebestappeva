import { AiAttachmentReference, AiDocumentAttachment, AiImageAttachment } from '../../shared/ai-attachments-contract';
import { StoredAiAttachmentRecord, StoredDocumentAttachmentRecord, StoredImageAttachmentRecord } from './types';

export function isDocumentAttachment(attachment: AiAttachmentReference): attachment is AiDocumentAttachment {
  return attachment.kind === 'document';
}

export function isImageAttachment(attachment: AiAttachmentReference): attachment is AiImageAttachment {
  return attachment.kind === 'image';
}

export function isStoredDocumentAttachmentRecord(record: StoredAiAttachmentRecord): record is StoredDocumentAttachmentRecord {
  return record.attachment.kind === 'document';
}

export function isStoredImageAttachmentRecord(record: StoredAiAttachmentRecord): record is StoredImageAttachmentRecord {
  return record.attachment.kind === 'image';
}
