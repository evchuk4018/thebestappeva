import { Editor, EditorContent } from '@tiptap/react';
import { DocLayoutMode, DocPageSettings } from './docs-types';

interface DocsEditorCanvasProps {
  editor: Editor | null;
  layoutMode: DocLayoutMode;
  pageSettings: DocPageSettings;
  zoom: number;
}

export function DocsEditorCanvas({ editor, layoutMode, pageSettings, zoom }: DocsEditorCanvasProps) {
  return (
    <div className="flex-1 overflow-auto bg-[#05070b] px-10 py-6">
      <div className="sticky top-0 z-10 mx-auto mb-4 flex max-w-[816px] items-center border-b border-[#1d2230] pb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
        <span className="w-12">0</span>
        {Array.from({ length: 17 }, (_, index) => <span key={index} className="flex-1 text-center">{index + 1}</span>)}
      </div>
      <div className={`${layoutMode === 'pages' ? 'mx-auto max-w-[816px]' : 'mx-auto max-w-[1080px]'}`} style={{ zoom: `${zoom}%` }}>
        <div
          className="rounded-sm border border-[#1b2130] shadow-[0_40px_90px_rgba(0,0,0,0.55)]"
          style={{
            backgroundColor: pageSettings.pageColor,
            minHeight: layoutMode === 'pages' ? 1056 : 920,
            padding: `${pageSettings.margins.top / 1.5}px ${pageSettings.margins.right / 1.5}px ${pageSettings.margins.bottom / 1.5}px ${pageSettings.margins.left / 1.5}px`,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
