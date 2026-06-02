import { FilePlus2 } from 'lucide-react';
import { DocTemplate } from './docs-types';

interface DocsTemplateGalleryProps {
  templates: DocTemplate[];
  onCreate: (templateId?: string) => void;
}

export function DocsTemplateGallery({ templates, onCreate }: DocsTemplateGalleryProps) {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-[#101216] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Start</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Choose a document template</h2>
        </div>
        <button onClick={() => onCreate('blank')} className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500">
          <FilePlus2 size={16} className="mr-2 inline-block" />
          New document
        </button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onCreate(template.id)}
            className="rounded-[22px] border border-zinc-800 bg-[linear-gradient(180deg,#151922,#0d1016)] p-4 text-left transition hover:-translate-y-1 hover:border-red-500/50 hover:shadow-[0_18px_50px_rgba(185,28,28,0.22)]"
          >
            <div className="flex h-44 flex-col rounded-[18px] border border-zinc-700 bg-[#0a0b0e] p-4 text-zinc-200">
              <p className="text-[11px] uppercase tracking-[0.3em] text-red-300">{template.category}</p>
              <h3 className="mt-4 text-xl font-semibold text-white">{template.name}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{template.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
