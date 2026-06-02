import { Editor } from '@tiptap/react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Highlighter, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered, Minus, Redo2, Strikethrough, Table2, Underline, Undo2 } from 'lucide-react';
import { DocLayoutMode } from './docs-types';

interface DocsEditorToolbarProps {
  editor: Editor | null;
  layoutMode: DocLayoutMode;
  zoom: number;
  onBlockInsert: (type: 'meeting' | 'roadmap' | 'email' | 'tracker') => void;
  onChipInsert: (type: 'person' | 'date' | 'dropdown' | 'variable' | 'file') => void;
  onImageUpload: (file: File) => void;
  onLayoutModeChange: (mode: DocLayoutMode) => void;
  onZoomChange: (zoom: number) => void;
}

function iconButton(active: boolean) {
  return `rounded-md px-2 py-1.5 transition ${active ? 'bg-[#1d4ed8] text-white' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`;
}

export function DocsEditorToolbar({
  editor,
  layoutMode,
  zoom,
  onBlockInsert,
  onChipInsert,
  onImageUpload,
  onLayoutModeChange,
  onZoomChange,
}: DocsEditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="border-b border-[#1f242d] bg-[#0f131a] px-4 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => editor.chain().focus().undo().run()} className={iconButton(false)}><Undo2 size={16} /></button>
        <button onClick={() => editor.chain().focus().redo().run()} className={iconButton(false)}><Redo2 size={16} /></button>
        <div className="h-6 w-px bg-[#28303c]" />
        <select value="" onChange={(event) => event.target.value && editor.chain().focus().toggleHeading({ level: Number(event.target.value) as 1 }).run()} className="rounded-md bg-transparent px-3 py-1.5 text-zinc-300 outline-none">
          <option value="">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
        <select value="" onChange={(event) => event.target.value && editor.chain().focus().setFontFamily(event.target.value).run()} className="rounded-md bg-transparent px-3 py-1.5 text-zinc-300 outline-none">
          <option value="">Inter</option>
          <option value="Georgia">Georgia</option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
        </select>
        <select value="" onChange={(event) => event.target.value && editor.chain().focus().setFontSize(event.target.value).run()} className="rounded-md bg-transparent px-3 py-1.5 text-zinc-300 outline-none">
          <option value="">12</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="18px">18</option>
          <option value="24px">24</option>
        </select>
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={iconButton(editor.isActive('bold'))}><Bold size={16} /></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={iconButton(editor.isActive('italic'))}><Italic size={16} /></button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={iconButton(editor.isActive('underline'))}><Underline size={16} /></button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={iconButton(editor.isActive('strike'))}><Strikethrough size={16} /></button>
        <label className="rounded-md px-2 py-1.5 text-zinc-300 transition hover:bg-white/5 hover:text-white"><input type="color" className="hidden" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /><Highlighter size={16} /></label>
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={iconButton(editor.isActive({ textAlign: 'left' }))}><AlignLeft size={16} /></button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={iconButton(editor.isActive({ textAlign: 'center' }))}><AlignCenter size={16} /></button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={iconButton(editor.isActive({ textAlign: 'right' }))}><AlignRight size={16} /></button>
        <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={iconButton(editor.isActive({ textAlign: 'justify' }))}><AlignJustify size={16} /></button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={iconButton(editor.isActive('bulletList'))}><List size={16} /></button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={iconButton(editor.isActive('orderedList'))}><ListOrdered size={16} /></button>
        <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={iconButton(editor.isActive('taskList'))}><ListChecks size={16} /></button>
        <button onClick={() => editor.chain().focus().setLink({ href: window.prompt('Paste a URL', 'https://') ?? '' }).run()} className={iconButton(editor.isActive('link'))}><Link2 size={16} /></button>
        <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={iconButton(false)}><Table2 size={16} /></button>
        <label className={iconButton(false)}><ImagePlus size={16} /><input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onImageUpload(event.target.files[0])} /></label>
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={iconButton(false)}><Minus size={16} /></button>
        <button onClick={() => onBlockInsert('meeting')} className={iconButton(false)}>Block</button>
        <button onClick={() => onChipInsert('person')} className={iconButton(false)}>@</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => onLayoutModeChange(layoutMode === 'pages' ? 'pageless' : 'pages')} className="rounded-full border border-[#293140] px-3 py-1.5 text-xs text-zinc-300 transition hover:text-white">{layoutMode}</button>
          <button onClick={() => onZoomChange(Math.max(50, zoom - 10))} className="rounded-md px-2 py-1.5 text-zinc-300 transition hover:bg-white/5">-</button>
          <div className="rounded-md bg-[#11161e] px-3 py-1.5 text-zinc-300">{zoom}%</div>
          <button onClick={() => onZoomChange(Math.min(200, zoom + 10))} className="rounded-md px-2 py-1.5 text-zinc-300 transition hover:bg-white/5">+</button>
          <button onClick={() => onBlockInsert('tracker')} className="flex items-center rounded-md px-2 py-1.5 text-zinc-300 transition hover:bg-white/5">More <ChevronDown size={14} className="ml-1" /></button>
        </div>
      </div>
    </div>
  );
}
