import { useEffect, useState } from 'react';
import {
  ArtifactRecord,
  ArtifactSummary,
  ArtifactVersionRecord,
  createArtifact,
  exportArtifactToDoc,
  getArtifactOutline,
  listArtifactVersions,
  listArtifacts,
  loadArtifact,
  restoreArtifactVersion,
  searchArtifact,
  updateArtifact,
  updateArtifactTable,
} from '../../../lib/ai-artifacts-storage';

interface UseAiArtifactsOptions {
  activeArtifactId: string | null;
  chatId: string | null;
  chatUpdatedAt?: string;
}

export function useAiArtifacts({ activeArtifactId, chatId, chatUpdatedAt }: UseAiArtifactsOptions) {
  const [activeArtifact, setActiveArtifact] = useState<ArtifactRecord | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [outline, setOutline] = useState<Awaited<ReturnType<typeof getArtifactOutline>> | null>(null);
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchArtifact>> | null>(null);
  const [versions, setVersions] = useState<ArtifactVersionRecord[]>([]);

  async function refreshArtifacts(includePreview = true) {
    if (!chatId) {
      setArtifacts([]);
      return;
    }
    try {
      setArtifacts(await listArtifacts(chatId, includePreview));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load artifacts.');
    }
  }

  async function refreshActiveArtifact() {
    if (!chatId || !activeArtifactId) {
      setActiveArtifact(null);
      setOutline(null);
      setVersions([]);
      return;
    }
    try {
      setIsLoading(true);
      const [artifact, nextOutline, nextVersions] = await Promise.all([
        loadArtifact(chatId, activeArtifactId),
        getArtifactOutline(chatId, activeArtifactId),
        listArtifactVersions(chatId, activeArtifactId),
      ]);
      setActiveArtifact(artifact);
      setOutline(nextOutline);
      setVersions(nextVersions);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the active artifact.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshArtifacts();
  }, [chatId, chatUpdatedAt]);

  useEffect(() => {
    void refreshActiveArtifact();
  }, [chatId, activeArtifactId]);

  return {
    activeArtifact,
    artifacts,
    error,
    isLoading,
    outline,
    searchResults,
    versions,
    createArtifact: async (request: { title: string; type: string; content: string }) => {
      if (!chatId) return null;
      const artifact = await createArtifact(chatId, request);
      await refreshArtifacts();
      return artifact;
    },
    exportArtifact: async (artifactId: string, mode: 'create_new' | 'update_linked' | 'create_or_update_linked', title?: string) => {
      if (!chatId) return null;
      const result = await exportArtifactToDoc(chatId, artifactId, mode, title);
      await Promise.all([refreshArtifacts(), refreshActiveArtifact()]);
      return result;
    },
    refreshArtifacts,
    refreshActiveArtifact,
    restoreVersion: async (artifactId: string, versionId: string) => {
      if (!chatId) return null;
      const artifact = await restoreArtifactVersion(chatId, artifactId, versionId);
      await Promise.all([refreshArtifacts(), refreshActiveArtifact()]);
      return artifact;
    },
    runSearch: async (artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid') => {
      if (!chatId) return null;
      const result = await searchArtifact(chatId, artifactId, query, mode);
      setSearchResults(result);
      return result;
    },
    saveArtifact: async (request: Parameters<typeof updateArtifact>[1]) => {
      if (!chatId) return null;
      const result = await updateArtifact(chatId, request);
      await Promise.all([refreshArtifacts(), refreshActiveArtifact()]);
      return result;
    },
    updateTable: async (request: Parameters<typeof updateArtifactTable>[1]) => {
      if (!chatId) return null;
      const result = await updateArtifactTable(chatId, request);
      await Promise.all([refreshArtifacts(), refreshActiveArtifact()]);
      return result;
    },
  };
}
