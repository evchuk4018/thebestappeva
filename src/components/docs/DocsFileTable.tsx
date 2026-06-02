import { Copy, FolderOpen, RotateCcw, Star, Trash2 } from 'lucide-react';
import { DocSearchIndexEntry } from './docs-types';
import { formatRelativeDate } from './docs-utils';

interface DocsFileTableProps {
  docs: DocSearchIndexEntry[];
  showTrash: boolean;
  onDuplicate: (docId: string) => void;
  onOpen: (docId: string) => void;
  onRename: (docId: string, title: string) => void;
  onRestore: (docId: string) => void;
  onStar: (docId: string) => void;
  onTrash: (docId: string) => void;
  onDelete: (docId: string) => void;
}

export function DocsFileTable({
  docs,
  showTrash,
  onDuplicate,
  onOpen,
  onRename,
  onRestore,
  onStar,
  onTrash,
  onDelete,
}: DocsFileTableProps) {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-[#101216] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">{showTrash ? 'Trash' : 'Recent files'}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{docs.length} documents</h2>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-[#0b0d11] text-xs uppercase tracking-[0.28em] text-zinc-500">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Preview</th>
              <th className="px-5 py-4">Opened</th>
              <th className="px-5 py-4">Updated</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-[#12151b]">
            {docs.map((doc) => (
              <tr key={doc.id} className="text-sm text-zinc-300">
                <td className="px-5 py-4">
                  <button onClick={() => onOpen(doc.id)} className="font-medium text-white transition hover:text-red-300">
                    {doc.title}
                  </button>
                </td>
                <td className="max-w-[420px] px-5 py-4 text-zinc-500">{doc.preview || 'No preview yet.'}</td>
                <td className="px-5 py-4 text-zinc-400">{formatRelativeDate(doc.lastOpenedAt)}</td>
                <td className="px-5 py-4 text-zinc-400">{formatRelativeDate(doc.updatedAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onOpen(doc.id)} className="rounded-full border border-zinc-700 p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white"><FolderOpen size={15} /></button>
                    {!showTrash && <button onClick={() => onStar(doc.id)} className={`rounded-full border p-2 transition ${doc.starred ? 'border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'}`}><Star size={15} /></button>}
                    {!showTrash && <button onClick={() => onDuplicate(doc.id)} className="rounded-full border border-zinc-700 p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white"><Copy size={15} /></button>}
                    {!showTrash && <button onClick={() => onRename(doc.id, window.prompt('Rename document', doc.title) ?? doc.title)} className="rounded-full border border-zinc-700 px-3 py-2 text-xs transition hover:border-zinc-500 hover:text-white">Rename</button>}
                    {showTrash ? (
                      <button onClick={() => onRestore(doc.id)} className="rounded-full border border-zinc-700 p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white"><RotateCcw size={15} /></button>
                    ) : (
                      <button onClick={() => onTrash(doc.id)} className="rounded-full border border-zinc-700 p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white"><Trash2 size={15} /></button>
                    )}
                    {showTrash && <button onClick={() => onDelete(doc.id)} className="rounded-full border border-red-500/40 p-2 text-red-300 transition hover:bg-red-500/10"><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-zinc-500">No documents match your current view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
