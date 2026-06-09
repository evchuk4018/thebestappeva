import { Bold, Code2, Heading1, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Table2, Underline } from 'lucide-react';

interface ArtifactEditorToolbarProps {
  onAction: (action: 'heading' | 'bold' | 'italic' | 'underline' | 'bullet' | 'numbered' | 'quote' | 'code' | 'link' | 'table' | 'paragraph') => void;
}

function buttonClass() {
  return 'rounded-lg border border-[#243443] bg-[#111922] px-2 py-2 text-zinc-300 transition hover:border-[#40607d] hover:text-white';
}

export function ArtifactEditorToolbar({ onAction }: ArtifactEditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#1d2c39] px-4 py-3">
      <button type="button" onClick={() => onAction('heading')} className={buttonClass()}><Heading1 size={15} /></button>
      <button type="button" onClick={() => onAction('paragraph')} className={buttonClass()}><Pilcrow size={15} /></button>
      <button type="button" onClick={() => onAction('bold')} className={buttonClass()}><Bold size={15} /></button>
      <button type="button" onClick={() => onAction('italic')} className={buttonClass()}><Italic size={15} /></button>
      <button type="button" onClick={() => onAction('underline')} className={buttonClass()}><Underline size={15} /></button>
      <button type="button" onClick={() => onAction('bullet')} className={buttonClass()}><List size={15} /></button>
      <button type="button" onClick={() => onAction('numbered')} className={buttonClass()}><ListOrdered size={15} /></button>
      <button type="button" onClick={() => onAction('quote')} className={buttonClass()}><Quote size={15} /></button>
      <button type="button" onClick={() => onAction('code')} className={buttonClass()}><Code2 size={15} /></button>
      <button type="button" onClick={() => onAction('link')} className={buttonClass()}><Link2 size={15} /></button>
      <button type="button" onClick={() => onAction('table')} className={buttonClass()}><Table2 size={15} /></button>
    </div>
  );
}
