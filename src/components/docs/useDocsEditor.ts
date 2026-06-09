import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor } from '@tiptap/react';
import { defaultPageSettings } from './docs-data';
import { docsEditorExtensions } from './docs-editor-extensions';
import { buildEditorSnapshot, getActiveTab } from './docs-editor-utils';
import { docsRepository } from './docs-repository';
import { CitationSource, DocBundle, DocRecord, DocTabRecord, VersionSaveOptions } from './docs-types';
import { createId } from './docs-utils';

type SidePanel = 'outline' | 'history' | 'citations' | 'none';
type SaveState = 'idle' | 'saving' | 'saved';

interface UseDocsEditorOptions {
  beforeDocumentReset?: () => void;
  pausePersistence?: boolean;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useDocsEditor(options: UseDocsEditorOptions = {}) {
  const navigate = useNavigate();
  const { docId = '' } = useParams();
  const beforeDocumentResetRef = useRef<(() => void) | undefined>(options.beforeDocumentReset);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [bundle, setBundle] = useState<DocBundle | null>(null);
  const [pausePersistence, setPausePersistence] = useState(Boolean(options.pausePersistence));
  const [sidePanel, setSidePanel] = useState<SidePanel>('outline');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [revisionKey, setRevisionKey] = useState(0);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: docsEditorExtensions,
    immediatelyRender: false,
    content: '<p>Loading document...</p>',
    onUpdate: () => {
      setSaveState('idle');
      setRevisionKey((current) => current + 1);
    },
    editorProps: { attributes: { class: 'docs-prose min-h-[960px] focus:outline-none' } },
  });

  const activeTab = useMemo(
    () => bundle ? getActiveTab(bundle.tabs, bundle.doc.activeTabId) : null,
    [bundle],
  );

  const performSave = useEffectEvent(async (options: VersionSaveOptions = { kind: 'auto' }, requestOptions?: { keepalive?: boolean }) => {
    if (!bundle || !editor || !activeTab) return;
    const nextTab = buildEditorSnapshot(editor, activeTab);
    const nextDoc: DocRecord = { ...bundle.doc, updatedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() };

    try {
      setSaveState('saving');
      const nextBundle = await docsRepository.saveDoc({ doc: nextDoc, tab: nextTab, version: options }, requestOptions);
      setBundle(nextBundle);
      setPersistenceError(null);
      setSaveState('saved');
    } catch (error) {
      setPersistenceError(toErrorMessage(error, 'Unable to save this document.'));
      setSaveState('idle');
    }
  });

  useEffect(() => {
    beforeDocumentResetRef.current = options.beforeDocumentReset;
  }, [options.beforeDocumentReset]);

  useEffect(() => {
    setPausePersistence(Boolean(options.pausePersistence));
  }, [options.pausePersistence]);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const nextBundle = await docsRepository.getDocBundle(docId);
        if (!nextBundle) {
          navigate('/docs');
          return;
        }
        if (canceled) return;
        setBundle({
          ...nextBundle,
          doc: { ...nextBundle.doc, pageSettings: nextBundle.doc.pageSettings ?? defaultPageSettings },
        });
        setPersistenceError(null);
      } catch (error) {
        if (!canceled) setPersistenceError(toErrorMessage(error, 'Unable to load this document.'));
      }
    }

    void load();
    return () => { canceled = true; };
  }, [docId, navigate]);

  useEffect(() => {
    if (!editor || !activeTab) return;
    const content = activeTab.contentFormat === 'json' ? JSON.parse(activeTab.content) : activeTab.content;
    editor.commands.setContent(content);
  }, [activeTab?.id, editor]);

  useEffect(() => {
    if (!editor || !bundle || revisionKey === 0 || pausePersistence) return;
    const timeout = window.setTimeout(() => { void performSave({ kind: 'auto' }); }, 10000);
    return () => window.clearTimeout(timeout);
  }, [bundle, editor, pausePersistence, performSave, revisionKey]);

  useEffect(() => {
    if (pausePersistence) return;
    const flush = () => { void performSave({ kind: 'auto' }, { keepalive: true }); };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [pausePersistence, performSave]);

  function updateDoc(updater: (doc: DocRecord) => DocRecord) {
    setBundle((current) => current ? { ...current, doc: updater(current.doc) } : current);
    setRevisionKey((current) => current + 1);
  }

  function updateTabs(updater: (tabs: DocTabRecord[]) => DocTabRecord[]) {
    setBundle((current) => current ? { ...current, tabs: updater(current.tabs) } : current);
    setRevisionKey((current) => current + 1);
  }

  function updateCitations(citations: CitationSource[]) {
    setBundle((current) => current ? { ...current, citations } : current);
    if (!bundle) return;
    void docsRepository.saveCitations(bundle.doc.id, citations)
      .then((nextCitations) => {
        setBundle((current) => current ? { ...current, citations: nextCitations } : current);
        setPersistenceError(null);
      })
      .catch((error) => setPersistenceError(toErrorMessage(error, 'Unable to save document citations.')));
  }

  function switchTab(tabId: string) {
    if (!bundle || !editor || !activeTab) return;
    beforeDocumentResetRef.current?.();
    const persisted = buildEditorSnapshot(editor, activeTab);
    const nextDoc = { ...bundle.doc, activeTabId: tabId, updatedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() };
    setBundle({ ...bundle, doc: nextDoc, tabs: bundle.tabs.map((tab) => tab.id === persisted.id ? persisted : tab) });
    void docsRepository.saveDoc({ doc: nextDoc, tab: persisted }).catch((error) => setPersistenceError(toErrorMessage(error, 'Unable to switch tabs.')));
  }

  function addTab() {
    if (!bundle) return;
    beforeDocumentResetRef.current?.();
    const now = new Date().toISOString();
    const nextTab: DocTabRecord = { id: createId('tab'), docId: bundle.doc.id, parentTabId: null, title: `Tab ${bundle.tabs.length + 1}`, order: bundle.tabs.length, outlineVisible: true, content: '<h1>New tab</h1><p>Start writing.</p>', contentFormat: 'html', textContent: 'New tab Start writing.', createdAt: now, updatedAt: now };
    const nextDoc = { ...bundle.doc, activeTabId: nextTab.id, updatedAt: now, lastOpenedAt: now };
    setBundle({ ...bundle, doc: nextDoc, tabs: [...bundle.tabs, nextTab] });
    void docsRepository.saveDoc({ doc: nextDoc, tab: nextTab }).catch((error) => setPersistenceError(toErrorMessage(error, 'Unable to add a new tab.')));
  }

  async function restoreVersion(versionId: string) {
    if (!bundle) return;
    beforeDocumentResetRef.current?.();
    try {
      const nextBundle = await docsRepository.restoreVersion(bundle.doc.id, versionId);
      setBundle(nextBundle);
      setPersistenceError(null);
      setSaveState('saved');
    } catch (error) {
      setPersistenceError(toErrorMessage(error, 'Unable to restore this version.'));
    }
  }

  async function loadMoreVersions() {
    if (!bundle?.nextVersionCursor) return;
    try {
      const nextPage = await docsRepository.loadMoreVersions(bundle.doc.id, bundle.nextVersionCursor);
      setBundle({ ...bundle, versions: [...bundle.versions, ...nextPage.versions], nextVersionCursor: nextPage.nextCursor });
    } catch (error) {
      setPersistenceError(toErrorMessage(error, 'Unable to load more version history.'));
    }
  }

  function insertChip(type: 'person' | 'date' | 'dropdown' | 'variable' | 'file') {
    if (!editor) return;
    const content = {
      person: '<span data-chip="person" style="background:#172554;color:#bfdbfe;padding:2px 8px;border-radius:999px;">@person</span>',
      date: `<span data-chip="date" style="background:#1f2937;color:#fde68a;padding:2px 8px;border-radius:999px;">${new Date().toLocaleDateString()}</span>`,
      dropdown: '<span data-chip="dropdown" style="background:#3f1d1d;color:#fecaca;padding:2px 8px;border-radius:999px;">Status v</span>',
      variable: '<span data-chip="variable" style="background:#1f2937;color:#c4b5fd;padding:2px 8px;border-radius:999px;">{{variable}}</span>',
      file: '<span data-chip="file" style="background:#0f3d2e;color:#bbf7d0;padding:2px 8px;border-radius:999px;">Linked file</span>',
    };
    editor.chain().focus().insertContent(content[type]).run();
  }

  function insertBlock(type: 'meeting' | 'roadmap' | 'email' | 'tracker') {
    if (!editor) return;
    const blocks = {
      meeting: '<h2>Meeting notes</h2><p><strong>Agenda</strong></p><ul><li>Topic</li></ul><p><strong>Action items</strong></p><ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Owner follow-up</p></div></li></ul>',
      roadmap: '<h2>Roadmap</h2><table><tr><th>Milestone</th><th>Status</th></tr><tr><td>Alpha</td><td>Planned</td></tr></table>',
      email: '<h2>Email draft</h2><p><strong>Subject:</strong> Update</p><p>Hello,</p><p></p><p>Best,</p>',
      tracker: '<h2>Review tracker</h2><table><tr><th>Reviewer</th><th>Status</th><th>Notes</th></tr><tr><td>Name</td><td>Pending</td><td></td></tr></table>',
    };
    editor.chain().focus().insertContent(blocks[type]).run();
  }

  function toggleVoiceTyping() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !editor) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).map((result) => result[0].transcript).join(' ');
      editor.chain().focus().insertContent(`${transcript} `).run();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }

  return {
    activeTab,
    bundle,
    editor,
    isListening,
    loadMoreVersions,
    persistenceError,
    saveState,
    sidePanel,
    setSidePanel,
    addTab,
    insertBlock,
    insertChip,
    performSave,
    restoreVersion,
    setPausePersistence,
    switchTab,
    toggleVoiceTyping,
    updateCitations,
    updateDoc,
    updateTabs,
  };
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }
}
