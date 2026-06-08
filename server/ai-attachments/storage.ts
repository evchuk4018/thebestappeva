import fs from 'node:fs/promises';
import path from 'node:path';
import { AiParsedAttachment } from '../../shared/ai-attachments-contract';
import { serverConfig } from '../config';
import { HttpError } from '../http';
import { StoredAiAttachmentRecord } from './types';

function getRecordPath(id: string) {
  return path.join(serverConfig.aiAttachmentStoragePath, `${id}.json`);
}

function getSourcePath(id: string, extension: string) {
  return path.join(serverConfig.aiAttachmentStoragePath, `${id}${extension}`);
}

function getPageCacheDir(id: string) {
  return path.join(serverConfig.aiAttachmentStoragePath, `${id}-pages`);
}

function getPageImagePath(id: string, pageNumber: number) {
  return path.join(getPageCacheDir(id), `${pageNumber}.png`);
}

export async function ensureAttachmentStorage() {
  await fs.mkdir(serverConfig.aiAttachmentStoragePath, { recursive: true });
}

export async function saveAttachmentSource(id: string, extension: string, fileBuffer: Buffer) {
  await ensureAttachmentStorage();
  const sourcePath = getSourcePath(id, extension);
  await fs.writeFile(sourcePath, fileBuffer);
  return sourcePath;
}

export function getAttachmentSourcePath(id: string, extension: string) {
  return getSourcePath(id, extension);
}

export async function saveAttachmentRecord(record: StoredAiAttachmentRecord) {
  await ensureAttachmentStorage();
  await fs.writeFile(getRecordPath(record.attachment.id), JSON.stringify(record, null, 2), 'utf8');
}

export async function readAttachmentRecord(id: string): Promise<StoredAiAttachmentRecord> {
  try {
    const raw = await fs.readFile(getRecordPath(id), 'utf8');
    return JSON.parse(raw) as StoredAiAttachmentRecord;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new HttpError(404, `No attachment with id "${id}" was found.`);
    }

    throw error;
  }
}

export async function deleteAttachmentRecord(id: string, sourceExtension: string) {
  await Promise.allSettled([
    fs.unlink(getRecordPath(id)),
    fs.unlink(getSourcePath(id, sourceExtension)),
    fs.rm(getPageCacheDir(id), { recursive: true, force: true }),
  ]);
}

export async function readCachedPdfPageImage(id: string, pageNumber: number) {
  try {
    return await fs.readFile(getPageImagePath(id, pageNumber));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function saveCachedPdfPageImage(id: string, pageNumber: number, image: Buffer) {
  await fs.mkdir(getPageCacheDir(id), { recursive: true });
  await fs.writeFile(getPageImagePath(id, pageNumber), image);
}

export function toParsedAttachment(record: StoredAiAttachmentRecord): AiParsedAttachment {
  return record.attachment;
}
