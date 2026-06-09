import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultDocPreferences, docTemplates } from './docs-data';
import { importDocx } from './docs-import-export';
import { docsRepository, ensureSeedDoc } from './docs-repository';
import { filterDocs } from './docs-search';
import { DocPreferences } from './docs-types';

export function useDocsHome() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([] as Awaited<ReturnType<typeof docsRepository.listDocs>>);
  const [query, setQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [preferences, setPreferences] = useState<DocPreferences>(defaultDocPreferences);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);

  async function refresh() {
    try {
      await ensureSeedDoc();
      const [nextDocs, nextPreferences] = await Promise.all([
        docsRepository.listDocs(),
        docsRepository.loadPreferences(),
      ]);
      setDocs(nextDocs);
      setPreferences(nextPreferences);
      setPreferencesReady(true);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load docs.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    void docsRepository.savePreferences(preferences).catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save docs preferences.');
    });
  }, [preferences, preferencesReady]);

  const visibleDocs = useMemo(
    () => filterDocs(docs, query, preferences, showTrash),
    [docs, preferences, query, showTrash],
  );

  async function openNewDoc(templateId = 'blank') {
    try {
      setBusy(true);
      const bundle = await docsRepository.createDoc(templateId);
      navigate(`/docs/${bundle.doc.id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create a new document.');
    } finally {
      setBusy(false);
    }
  }

  async function openImportedDoc(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const imported = await importDocx(file);
      const bundle = await docsRepository.createImportedDoc(imported.title, imported.html);
      navigate(`/docs/${bundle.doc.id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to import the document.');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(docId: string, action: 'star' | 'trash' | 'restore' | 'delete' | 'duplicate') {
    try {
      setBusy(true);
      if (action === 'star') await docsRepository.toggleStar(docId);
      if (action === 'trash') await docsRepository.trashDoc(docId);
      if (action === 'restore') await docsRepository.restoreDoc(docId);
      if (action === 'delete') await docsRepository.deleteDoc(docId);
      if (action === 'duplicate') {
        const bundle = await docsRepository.duplicateDoc(docId);
        if (bundle) navigate(`/docs/${bundle.doc.id}`);
      }
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update the document.');
    } finally {
      setBusy(false);
    }
  }

  async function renameDoc(docId: string, title: string) {
    try {
      await docsRepository.renameDoc(docId, title);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to rename the document.');
    }
  }

  return {
    busy,
    docTemplates,
    error,
    preferences,
    query,
    showTrash,
    visibleDocs,
    setQuery,
    setShowTrash,
    setPreferences,
    refresh,
    goHome: () => navigate('/'),
    navigateToDoc: (docId: string) => navigate(`/docs/${docId}`),
    openImportedDoc,
    openNewDoc,
    renameDoc,
    runAction,
  };
}
