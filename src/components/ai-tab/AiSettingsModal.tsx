import { useEffect, useState } from 'react';
import { Settings, X } from 'lucide-react';
import { ChatMode } from './types';
import { SystemPromptSection } from './system-prompt';

interface AiSettingsModalProps {
  chatMode: ChatMode;
  customPrompt: string;
  isOpen: boolean;
  sections: SystemPromptSection[];
  onClose: () => void;
  onSave: (value: string) => void;
}

function getModeLabel(chatMode: ChatMode) {
  return chatMode === 'thinking' ? 'Thinking mode' : 'Flash mode';
}

export function AiSettingsModal({ chatMode, customPrompt, isOpen, sections, onClose, onSave }: AiSettingsModalProps) {
  const [draftPrompt, setDraftPrompt] = useState(customPrompt);

  useEffect(() => {
    if (isOpen) {
      setDraftPrompt(customPrompt);
    }
  }, [customPrompt, isOpen]);

  if (!isOpen) {
    return null;
  }

  const readOnlySections = sections.filter((section) => section.readOnly);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#2f2f2b] bg-[#151513] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#262622] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">AI settings</p>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="font-serif text-2xl text-[#efeae4]">System prompt</h2>
              <span className="rounded-full border border-[#383832] bg-[#11110f] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {getModeLabel(chatMode)}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 transition hover:bg-[#20201e] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#efeae4]">
              <Settings size={16} className="text-[#e2875e]" />
              <span>Custom instructions</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">These instructions are prepended to the built-in Markdown and tool guidance for every local AI turn.</p>
            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder="Add your own system instructions for the AI."
              className="mt-4 min-h-[280px] w-full resize-none rounded-2xl border border-[#33332d] bg-[#11110f] px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#e2875e]/50"
            />
          </div>

          <div className="flex flex-col gap-4">
            {readOnlySections.map((section) => (
              <div key={section.id} className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
                <p className="text-sm font-medium text-[#efeae4]">{section.title}</p>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{section.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#262622] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#33332d] bg-[#1f1f1c] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-[#4a4a43] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draftPrompt.trim())}
            className="rounded-xl bg-[#e2875e] px-4 py-2 text-sm font-medium text-[#121210] transition hover:bg-[#d67e5a]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
