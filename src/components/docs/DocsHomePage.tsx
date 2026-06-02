import { DocsFileTable } from './DocsFileTable';
import { DocsHomeHeader } from './DocsHomeHeader';
import { DocsTemplateGallery } from './DocsTemplateGallery';
import { useDocsHome } from './useDocsHome';

export default function DocsHomePage() {
  const docs = useDocsHome();

  return (
    <div className="min-h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.18),transparent_30%),linear-gradient(180deg,#060709_0%,#0d1117_100%)] px-6 py-8 text-white">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        <DocsHomeHeader
          busy={docs.busy}
          preferences={docs.preferences}
          query={docs.query}
          showTrash={docs.showTrash}
          onBack={docs.goHome}
          onImport={docs.openImportedDoc}
          onPreferencesChange={docs.setPreferences}
          onQueryChange={docs.setQuery}
          onToggleTrash={() => docs.setShowTrash(!docs.showTrash)}
        />
        <DocsTemplateGallery templates={docs.docTemplates} onCreate={docs.openNewDoc} />
        <DocsFileTable
          docs={docs.visibleDocs}
          showTrash={docs.showTrash}
          onDelete={(docId) => void docs.runAction(docId, 'delete')}
          onDuplicate={(docId) => void docs.runAction(docId, 'duplicate')}
          onOpen={docs.navigateToDoc}
          onRename={(docId, title) => void docs.renameDoc(docId, title)}
          onRestore={(docId) => void docs.runAction(docId, 'restore')}
          onStar={(docId) => void docs.runAction(docId, 'star')}
          onTrash={(docId) => void docs.runAction(docId, 'trash')}
        />
      </div>
    </div>
  );
}
