import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultDocPreferences, docTemplates } from './docs-data';
import { importDocx } from './docs-import-export';
import { docsRepository, ensureSeedDoc } from './docs-repository';
import { filterDocs } from './docs-search';
import { DocPreferences } from './docs-types';

const preferencesKey = 'docs-home-preferences';

function readPreferences() {
  const stored = window.localStorage.getItem(preferencesKey);
  if (!stored) return defaultDocPreferences;

  try {
    return { ...defaultDocPreferences, ...(JSON.parse(stored) as Partial<DocPreferences>) };
  } catch {
    return defaultDocPreferences;
  }
}

export function useDocsHome() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([] as Awaited<ReturnType<typeof docsRepository.listDocs>>);
  const [query, setQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await ensureSeedDoc();
    setDocs(await docsRepository.listDocs());
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  }, [preferences]);

  const visibleDocs = useMemo(
    () => filterDocs(docs, query, preferences, showTrash),
    [docs, preferences, query, showTrash],
  );

  async function openNewDoc(templateId = 'blank') {
    setBusy(true);
    const bundle = await docsRepository.createDoc(templateId);
    navigate(`/docs/${bundle.doc.id}`);
  }

  async function openImportedDoc(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const imported = await importDocx(file);
    const bundle = await docsRepository.createImportedDoc(imported.title, imported.html);
    navigate(`/docs/${bundle.doc.id}`);
  }

  async function runAction(docId: string, action: 'star' | 'trash' | 'restore' | 'delete' | 'duplicate') {
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
    setBusy(false);
  }

  async function renameDoc(docId: string, title: string) {
    await docsRepository.renameDoc(docId, title);
    await refresh();
  }

  return {
    busy,
    docTemplates,
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
