import { Clock3, FileText, Mic, Plus } from 'lucide-react';
import { CitationSource, DocVersionRecord } from './docs-types';
import { buildOutlineFromHtml } from './docs-editor-utils';

interface DocsEditorPanelsProps {
  activeHtml: string;
  citations: CitationSource[];
  isListening: boolean;
  sidePanel: 'outline' | 'history' | 'citations' | 'none';
  versions: DocVersionRecord[];
  onAddCitation: () => void;
  onRestoreVersion: (versionId: string) => void;
  onToggleVoice: () => void;
}

export function DocsEditorPanels({
  activeHtml,
  citations,
  isListening,
  sidePanel,
  versions,
  onAddCitation,
  onRestoreVersion,
  onToggleVoice,
}: DocsEditorPanelsProps) {
  const outline = buildOutlineFromHtml(activeHtml);

  if (sidePanel === 'none') return null;

  return (
    <aside className="w-[320px] border-l border-[#1f242d] bg-[#0c0f15] p-4 text-sm text-zinc-300">
      {sidePanel === 'outline' && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Outline</h3>
            <button onClick={onToggleVoice} className={`rounded-full px-3 py-2 text-xs transition ${isListening ? 'bg-red-600 text-white' : 'border border-[#28303c] text-zinc-300 hover:text-white'}`}>
              <Mic size={14} className="mr-2 inline-block" />
              {isListening ? 'Listening' : 'Voice typing'}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {outline.map((item) => (
              <div key={item.id} className="rounded-xl bg-[#11161e] px-3 py-2 text-zinc-300" style={{ marginLeft: `${(item.level - 1) * 12}px` }}>
                {item.text}
              </div>
            ))}
            {!outline.length && <p className="text-zinc-500">Add headings to build the outline.</p>}
          </div>
        </div>
      )}
      {sidePanel === 'history' && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 size={15} /> Version history</h3>
          <div className="mt-4 space-y-2">
            {versions.slice().reverse().map((version) => (
              <button key={version.id} onClick={() => onRestoreVersion(version.id)} className="block w-full rounded-2xl border border-[#28303c] bg-[#11161e] px-3 py-3 text-left transition hover:border-[#3d4758]">
                <p className="font-medium text-white">{version.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-zinc-500">{version.kind}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      {sidePanel === 'citations' && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><FileText size={15} /> Citations</h3>
            <button onClick={onAddCitation} className="rounded-full border border-[#28303c] p-2 text-zinc-300 transition hover:text-white"><Plus size={14} /></button>
          </div>
          <div className="mt-4 space-y-2">
            {citations.map((citation) => (
              <div key={citation.id} className="rounded-2xl border border-[#28303c] bg-[#11161e] px-3 py-3">
                <p className="font-medium text-white">{citation.label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{citation.details}</p>
              </div>
            ))}
            {!citations.length && <p className="text-zinc-500">Add MLA, APA, or Chicago sources here.</p>}
          </div>
        </div>
      )}
    </aside>
  );
}
