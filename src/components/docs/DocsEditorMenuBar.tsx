interface DocsEditorMenuBarProps {
  activePanel: 'outline' | 'history' | 'citations' | 'none';
  onAction: (action: string) => void;
}

const menus = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'];

export function DocsEditorMenuBar({ activePanel, onAction }: DocsEditorMenuBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#1f242d] bg-[#11141b] px-5 py-2 text-[13px] text-zinc-300">
      <div className="flex items-center gap-4">
        {menus.map((menu) => (
          <button key={menu} onClick={() => onAction(menu)} className="transition hover:text-white">{menu}</button>
        ))}
      </div>
      <div className="text-xs text-zinc-500">{activePanel === 'none' ? 'Canvas only' : `Panel: ${activePanel}`}</div>
    </div>
  );
}
