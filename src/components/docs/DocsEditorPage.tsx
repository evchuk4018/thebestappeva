import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { docsRepository } from './docs-repository';
import { exportDocx, exportPdf } from './docs-import-export';
import { DocsEditorCanvas } from './DocsEditorCanvas';
import { DocsEditorHeader } from './DocsEditorHeader';
import { DocsEditorMenuBar } from './DocsEditorMenuBar';
import { DocsEditorPanels } from './DocsEditorPanels';
import { DocsEditorSidebar } from './DocsEditorSidebar';
import { DocsEditorToolbar } from './DocsEditorToolbar';
import { useDocsEditor } from './useDocsEditor';
import { createId } from './docs-utils';

export default function DocsEditorPage() {
  const navigate = useNavigate();
  const docs = useDocsEditor();
  const activeHtml = useMemo(() => {
    if (!docs.activeTab) return '';
    if (docs.activeTab.contentFormat === 'html') return docs.activeTab.content;
    return docs.editor?.getHTML() ?? '';
  }, [docs.activeTab, docs.editor, docs.saveState]);

  if (!docs.bundle) {
    return <div className="flex h-full items-center justify-center bg-[#07090d] text-zinc-400">Loading document…</div>;
  }

  async function handleMenuAction(action: string) {
    if (action === 'File') await docs.performSave('named', `Named version • ${new Date().toLocaleTimeString()}`);
    if (action === 'Edit') {
      const query = window.prompt('Find text');
      if (!query || !docs.editor) return;
      const replacement = window.prompt(`Replace "${query}" with`, query);
      if (replacement === null) return;
      docs.editor.commands.setContent(docs.editor.getHTML().split(query).join(replacement));
    }
    if (action === 'View') docs.setSidePanel(docs.sidePanel === 'outline' ? 'none' : 'outline');
    if (action === 'Insert') docs.insertBlock('meeting');
    if (action === 'Format') docs.editor?.chain().focus().toggleBold().run();
    if (action === 'Tools') docs.setSidePanel('history');
    if (action === 'Extensions') docs.setSidePanel('citations');
    if (action === 'Help') window.alert('Single-user Docs workspace. Use File for save/export, Tools for history, Extensions for citations.');
  }

  function handleImageUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') docs.editor?.chain().focus().setImage({ src: reader.result }).run();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0d12] text-white">
      <DocsEditorHeader
        doc={docs.bundle.doc}
        saveState={docs.saveState}
        onBack={() => navigate('/docs')}
        onToggleStar={() => void docsRepository.toggleStar(docs.bundle!.doc.id).then(() => docs.updateDoc((doc) => ({ ...doc, starred: !doc.starred })))}
        onTitleChange={(title) => docs.updateDoc((doc) => ({ ...doc, title }))}
      />
      <DocsEditorMenuBar activePanel={docs.sidePanel} onAction={(action) => void handleMenuAction(action)} />
      <DocsEditorToolbar
        editor={docs.editor}
        layoutMode={docs.bundle.doc.layoutMode}
        zoom={docs.bundle.doc.zoom}
        onBlockInsert={docs.insertBlock}
        onChipInsert={docs.insertChip}
        onImageUpload={handleImageUpload}
        onLayoutModeChange={(mode) => docs.updateDoc((doc) => ({ ...doc, layoutMode: mode }))}
        onZoomChange={(zoom) => docs.updateDoc((doc) => ({ ...doc, zoom }))}
      />
      <div className="flex min-h-0 flex-1">
        <DocsEditorSidebar activeTabId={docs.bundle.doc.activeTabId} tabs={docs.bundle.tabs} onAddTab={docs.addTab} onSelectTab={docs.switchTab} />
        <DocsEditorCanvas editor={docs.editor} layoutMode={docs.bundle.doc.layoutMode} pageSettings={docs.bundle.doc.pageSettings} zoom={docs.bundle.doc.zoom} />
        <DocsEditorPanels
          activeHtml={activeHtml}
          citations={docs.bundle.citations}
          isListening={docs.isListening}
          sidePanel={docs.sidePanel}
          versions={docs.bundle.versions}
          onAddCitation={() => {
            const label = window.prompt('Citation title');
            if (!label) return;
            const details = window.prompt('Citation details', 'Author. Title. Publisher, 2026.') ?? '';
            docs.updateCitations([...docs.bundle!.citations, { id: createId('citation'), label, details }]);
          }}
          onRestoreVersion={(versionId) => void docs.restoreVersion(versionId)}
          onToggleVoice={docs.toggleVoiceTyping}
        />
      </div>
      <div className="flex items-center justify-between border-t border-[#1f242d] bg-[#0d1117] px-4 py-2 text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <button onClick={() => void docs.performSave('named', 'Named version')} className="transition hover:text-white">Save version</button>
          <button onClick={() => void exportDocx(docs.bundle!)} className="transition hover:text-white">Export .docx</button>
          <button onClick={() => exportPdf(docs.bundle!)} className="transition hover:text-white">Print / PDF</button>
        </div>
        <div>{docs.editor?.storage.characterCount.words() ?? 0} words</div>
      </div>
    </div>
  );
}
