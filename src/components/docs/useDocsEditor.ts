import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor } from '@tiptap/react';
import { defaultPageSettings } from './docs-data';
import { docsEditorExtensions } from './docs-editor-extensions';
import { buildEditorSnapshot, getActiveTab } from './docs-editor-utils';
import { docsRepository } from './docs-repository';
import { docsVersionService } from './docs-version-service';
import { CitationSource, DocBundle, DocRecord, DocTabRecord, DocVersionKind } from './docs-types';
import { createId } from './docs-utils';

type SidePanel = 'outline' | 'history' | 'citations' | 'none';
type SaveState = 'idle' | 'saving' | 'saved';

export function useDocsEditor() {
  const navigate = useNavigate();
  const { docId = '' } = useParams();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [bundle, setBundle] = useState<DocBundle | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>('outline');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [revisionKey, setRevisionKey] = useState(0);

  const editor = useEditor({
    extensions: docsEditorExtensions,
    immediatelyRender: false,
    content: '<p>Loading document…</p>',
    onUpdate: () => {
      setSaveState('idle');
      setRevisionKey((current) => current + 1);
    },
    editorProps: {
      attributes: {
        class: 'docs-prose min-h-[960px] focus:outline-none',
      },
    },
  });

  const activeTab = useMemo(
    () => bundle ? getActiveTab(bundle.tabs, bundle.doc.activeTabId) : null,
    [bundle],
  );

  const performSave = useEffectEvent(async (kind: DocVersionKind = 'auto', label?: string) => {
    if (!bundle || !editor || !activeTab) return;

    const nextTab = buildEditorSnapshot(editor, activeTab);
    const nextTabs = bundle.tabs.map((tab) => tab.id === nextTab.id ? nextTab : tab);
    const nextDoc: DocRecord = {
      ...bundle.doc,
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    setSaveState('saving');
    await docsRepository.saveDoc(nextDoc);
    await docsRepository.saveTab(nextTab);
    await docsVersionService.createVersion(nextDoc, nextTab, kind, label);
    const versions = await docsVersionService.listVersions(nextDoc.id);
    setBundle({ ...bundle, doc: nextDoc, tabs: nextTabs, versions });
    setSaveState('saved');
  });

  useEffect(() => {
    let canceled = false;

    async function load() {
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
    if (!editor || !bundle || revisionKey === 0) return;
    const timeout = window.setTimeout(() => { void performSave('auto'); }, 10000);
    return () => window.clearTimeout(timeout);
  }, [bundle, editor, performSave, revisionKey]);

  useEffect(() => {
    const flush = () => { void performSave('auto'); };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [performSave]);

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
    if (bundle) void docsRepository.saveCitations(bundle.doc.id, citations);
  }

  function switchTab(tabId: string) {
    if (!bundle || !editor || !activeTab) return;
    const persisted = buildEditorSnapshot(editor, activeTab);
    const nextTabs = bundle.tabs.map((tab) => tab.id === persisted.id ? persisted : tab);
    setBundle({ ...bundle, doc: { ...bundle.doc, activeTabId: tabId }, tabs: nextTabs });
  }

  function addTab() {
    if (!bundle) return;
    const nextTab: DocTabRecord = {
      id: createId('tab'),
      docId: bundle.doc.id,
      parentTabId: null,
      title: `Tab ${bundle.tabs.length + 1}`,
      order: bundle.tabs.length,
      outlineVisible: true,
      content: '<h1>New tab</h1><p>Start writing.</p>',
      contentFormat: 'html',
      textContent: 'New tab Start writing.',
    };
    setBundle({ ...bundle, doc: { ...bundle.doc, activeTabId: nextTab.id }, tabs: [...bundle.tabs, nextTab] });
    void docsRepository.saveTabs([...bundle.tabs, nextTab]);
  }

  async function restoreVersion(versionId: string) {
    if (!bundle || !editor) return;
    const version = bundle.versions.find((entry) => entry.id === versionId);
    if (!version) return;
    const targetTab = bundle.tabs.find((tab) => tab.id === version.tabId) ?? bundle.tabs[0];
    if (!targetTab) return;
    const content = version.contentFormat === 'json' ? JSON.parse(version.content) : version.content;
    editor.commands.setContent(content);
    setBundle({
      ...bundle,
      doc: { ...bundle.doc, activeTabId: targetTab.id },
      tabs: bundle.tabs.map((tab) => tab.id === targetTab.id ? { ...tab, content: version.content, contentFormat: version.contentFormat, textContent: editor.getText() } : tab),
    });
    await performSave('restore', `Restored • ${version.label}`);
  }

  function insertChip(type: 'person' | 'date' | 'dropdown' | 'variable' | 'file') {
    if (!editor) return;
    const content = {
      person: '<span data-chip="person" style="background:#172554;color:#bfdbfe;padding:2px 8px;border-radius:999px;">@person</span>',
      date: `<span data-chip="date" style="background:#1f2937;color:#fde68a;padding:2px 8px;border-radius:999px;">${new Date().toLocaleDateString()}</span>`,
      dropdown: '<span data-chip="dropdown" style="background:#3f1d1d;color:#fecaca;padding:2px 8px;border-radius:999px;">Status ▾</span>',
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
    saveState,
    sidePanel,
    setSidePanel,
    addTab,
    insertBlock,
    insertChip,
    performSave,
    restoreVersion,
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
