import { useEffect, useMemo, useState } from 'react';
import { Settings, X } from 'lucide-react';
import type { ChatMode, ModelProvider, OllamaModel, RuntimeProviderOption } from './types';
import type { SystemPromptSection } from './system-prompt';

interface AiSettingsModalProps {
  availableModels: OllamaModel[];
  chatMode: ChatMode;
  currentModel: string | null;
  currentProvider: ModelProvider;
  customPrompt: string;
  isOpen: boolean;
  providerOptions: RuntimeProviderOption[];
  sections: SystemPromptSection[];
  onClose: () => void;
  onSave: (value: { customPrompt: string; provider: ModelProvider; model: string | null }) => void;
}

function getModeLabel(chatMode: ChatMode) {
  return chatMode === 'thinking' ? 'Thinking mode' : 'Flash mode';
}

export function AiSettingsModal({
  availableModels,
  chatMode,
  currentModel,
  currentProvider,
  customPrompt,
  isOpen,
  providerOptions,
  sections,
  onClose,
  onSave,
}: AiSettingsModalProps) {
  const [draftPrompt, setDraftPrompt] = useState(customPrompt);
  const [draftProvider, setDraftProvider] = useState<ModelProvider>(currentProvider);
  const [draftModel, setDraftModel] = useState<string | null>(currentModel);

  useEffect(() => {
    if (isOpen) {
      setDraftPrompt(customPrompt);
      setDraftProvider(currentProvider);
      setDraftModel(currentModel);
    }
  }, [currentModel, currentProvider, customPrompt, isOpen]);

  const readOnlySections = sections.filter((section) => section.readOnly);
  const activeProvider = useMemo(
    () => providerOptions.find((option) => option.value === draftProvider) ?? providerOptions[0] ?? null,
    [draftProvider, providerOptions],
  );
  const providerModels = useMemo(
    () => availableModels.filter((model) => model.provider === draftProvider),
    [availableModels, draftProvider],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!providerModels.length) {
      setDraftModel(activeProvider?.defaultModel ?? null);
      return;
    }

    if (!draftModel || !providerModels.some((model) => model.name === draftModel)) {
      setDraftModel(providerModels[0].name);
    }
  }, [activeProvider, draftModel, isOpen, providerModels]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#2f2f2b] bg-[#151513] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#262622] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">AI settings</p>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="font-serif text-2xl text-[#efeae4]">Runtime and prompt</h2>
              <span className="rounded-full border border-[#383832] bg-[#11110f] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {getModeLabel(chatMode)}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 transition hover:bg-[#20201e] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#efeae4]">
                <Settings size={16} className="text-[#e2875e]" />
                <span>Global runtime</span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs text-zinc-400">
                  <span>Provider</span>
                  <select
                    value={draftProvider}
                    onChange={(event) => setDraftProvider(event.target.value as ModelProvider)}
                    className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#e2875e]/50"
                  >
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs text-zinc-400">
                  <span>Model</span>
                  <select
                    value={draftModel ?? ''}
                    onChange={(event) => setDraftModel(event.target.value || null)}
                    className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#e2875e]/50"
                  >
                    {(providerModels.length ? providerModels : [{
                      name: activeProvider?.defaultModel ?? '',
                      provider: draftProvider,
                      label: activeProvider?.defaultModelLabel ?? undefined,
                    }]).filter((model) => model.name).map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.label ?? model.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {activeProvider && (
                <div className="mt-4 rounded-2xl border border-[#312e29] bg-[#161613] px-4 py-3 text-xs text-zinc-400">
                  <p className="font-medium text-[#efeae4]">
                    {activeProvider.label} {activeProvider.status === 'ready' ? 'Configured' : activeProvider.status === 'missing-env' ? 'Missing env vars' : 'Unavailable'}
                  </p>
                  <p className="mt-1 leading-relaxed">{activeProvider.detail}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#efeae4]">
                <Settings size={16} className="text-[#e2875e]" />
                <span>Custom instructions</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">These instructions are prepended to the built-in Markdown and tool guidance for every AI turn.</p>
              <textarea
                value={draftPrompt}
                onChange={(event) => setDraftPrompt(event.target.value)}
                placeholder="Add your own system instructions for the AI."
                className="mt-4 min-h-[260px] w-full resize-none rounded-2xl border border-[#33332d] bg-[#11110f] px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#e2875e]/50"
              />
            </div>
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
            onClick={() => onSave({ customPrompt: draftPrompt.trim(), provider: draftProvider, model: draftModel })}
            className="rounded-xl bg-[#e2875e] px-4 py-2 text-sm font-medium text-[#121210] transition hover:bg-[#d67e5a]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
