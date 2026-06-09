import { useEffect, useState } from 'react';
import {
  ArtifactRecord,
  ArtifactSearchResponse,
  ArtifactSummary,
  createArtifact,
  exportArtifactToDoc,
  listArtifacts,
  loadArtifact,
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
      return;
    }
    try {
      setIsLoading(true);
      const artifact = await loadArtifact(chatId, activeArtifactId);
      setActiveArtifact(artifact);
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
    runSearch: async (artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid'): Promise<ArtifactSearchResponse | null> => {
      if (!chatId) return null;
      return searchArtifact(chatId, artifactId, query, mode);
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
