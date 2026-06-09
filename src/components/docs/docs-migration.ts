import Dexie, { type Table } from 'dexie';
import { defaultDocPreferences } from './docs-data';
import { fetchDocsMigrationStatus, importDocsMigration } from './docs-api';
import type {
  DocCitationRecord,
  DocPreferences,
  DocRecord,
  DocTabRecord,
  DocVersionDetail,
  DocsMigrationImportRequest,
} from '../../../shared/docs-contract';

const databaseName = 'docs-workspace';
const preferencesKey = 'docs-home-preferences';
const sourceKeyStorageKey = 'docs-migration-source-key';

interface LegacyDocTabRecord extends Omit<DocTabRecord, 'createdAt' | 'updatedAt'> {
  createdAt?: string;
  updatedAt?: string;
}

interface LegacyDocsDatabase extends Dexie {
  docs: Table<DocRecord, string>;
  tabs: Table<LegacyDocTabRecord, string>;
  versions: Table<DocVersionDetail, string>;
  citations: Table<DocCitationRecord, string>;
}

interface DocsMigrationServices {
  cleanupLegacyData(): Promise<void>;
  fetchStatus(sourceKey: string): Promise<{ migrated: boolean }>;
  importData(payload: DocsMigrationImportRequest): Promise<void>;
  loadLegacyData(sourceKey: string): Promise<DocsMigrationImportRequest | null>;
  readSourceKey(): string | null;
  removeSourceKey(): void;
  writeSourceKey(sourceKey: string): void;
}

let migrationPromise: Promise<void> | null = null;

class BrowserLegacyDocsDatabase extends Dexie implements LegacyDocsDatabase {
  docs!: Table<DocRecord, string>;
  tabs!: Table<LegacyDocTabRecord, string>;
  versions!: Table<DocVersionDetail, string>;
  citations!: Table<DocCitationRecord, string>;

  constructor() {
    super(databaseName);
    this.version(1).stores({
      docs: 'id, updatedAt, lastOpenedAt, trashedAt, starred',
      tabs: 'id, docId, order, parentTabId',
      versions: 'id, docId, createdAt, kind',
      citations: 'id, docId',
    });
  }
}

async function loadLegacyData(sourceKey: string): Promise<DocsMigrationImportRequest | null> {
  const database = new BrowserLegacyDocsDatabase();
  const [docs, tabs, versions, citations] = await Promise.all([
    database.docs.toArray(),
    database.tabs.toArray(),
    database.versions.toArray(),
    database.citations.toArray(),
  ]);
  const storedPreferences = window.localStorage.getItem(preferencesKey);
  const preferences = storedPreferences ? { ...defaultDocPreferences, ...(JSON.parse(storedPreferences) as Partial<DocPreferences>) } : null;
  if (!docs.length && !tabs.length && !versions.length && !citations.length && !storedPreferences) return null;

  return {
    sourceKey,
    docs,
    tabs: tabs.map((tab) => {
      const doc = docs.find((entry) => entry.id === tab.docId);
      const timestamp = doc?.updatedAt ?? doc?.createdAt ?? new Date().toISOString();
      return { ...tab, createdAt: tab.createdAt ?? timestamp, updatedAt: tab.updatedAt ?? timestamp };
    }),
    versions,
    citations,
    preferences,
  };
}

async function cleanupLegacyData() {
  await Dexie.delete(databaseName);
  window.localStorage.removeItem(preferencesKey);
}

function browserServices(): DocsMigrationServices {
  return {
    cleanupLegacyData,
    fetchStatus: fetchDocsMigrationStatus,
    importData: async (payload) => { await importDocsMigration(payload); },
    loadLegacyData,
    readSourceKey: () => window.localStorage.getItem(sourceKeyStorageKey),
    removeSourceKey: () => window.localStorage.removeItem(sourceKeyStorageKey),
    writeSourceKey: (sourceKey) => window.localStorage.setItem(sourceKeyStorageKey, sourceKey),
  };
}

export async function migrateLegacyDocsStorage(services: DocsMigrationServices = browserServices()) {
  const existingSourceKey = services.readSourceKey();
  const sourceKey = existingSourceKey ?? `docs-migration-${crypto.randomUUID()}`;
  if (!existingSourceKey) services.writeSourceKey(sourceKey);

  const legacyData = await services.loadLegacyData(sourceKey);
  if (!legacyData) {
    services.removeSourceKey();
    return;
  }

  const status = await services.fetchStatus(sourceKey);
  if (status.migrated) {
    await services.cleanupLegacyData();
    services.removeSourceKey();
    return;
  }

  await services.importData(legacyData);
  await services.cleanupLegacyData();
  services.removeSourceKey();
}

export function ensureDocsMigration() {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyDocsStorage().catch((error) => {
      migrationPromise = null;
      console.error('Docs migration failed.', error);
      throw error;
    });
  }

  return migrationPromise;
}

export const docsMigrationKeys = {
  preferencesKey,
  sourceKeyStorageKey,
};
