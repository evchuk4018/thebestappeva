import { useState } from 'react';
import { X } from 'lucide-react';
import type { ChatMode } from '../../../../shared/chat-mode';
import { CHAT_MODES } from '../../../../shared/chat-mode';
import type { CreateSkillRequest, SkillSummary, UpdateSkillRequest } from '../../../../shared/skills-contract';
import { selectableTools, toggleToolSelection } from '../tools/selectable-tools';

interface SkillEditorProps {
  skill: SkillSummary | null;
  onCancel: () => void;
  onSubmit: (request: CreateSkillRequest | UpdateSkillRequest) => void | Promise<void>;
}

export function SkillEditor({ skill, onCancel, onSubmit }: SkillEditorProps) {
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [instructions, setInstructions] = useState('');
  const [compatibleModes, setCompatibleModes] = useState<ChatMode[] | null>(skill?.compatibleModes ?? null);
  const [requiredTools, setRequiredTools] = useState<string[]>(skill?.requiredTools ?? []);
  const [disabledTools, setDisabledTools] = useState<string[]>(skill?.disabledTools ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim() || (!skill && !instructions.trim())) {
      setError(skill ? 'Name and description are required.' : 'Name, description, and instructions are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...(skill ? {} : { name: name.trim(), instructions }),
        ...(skill && instructions.trim() ? { instructions } : {}),
        description: description.trim(),
        compatibleModes,
        requiredTools,
        disabledTools,
        ...(skill ? {} : { enabled: true }),
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save skill.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 py-6 pb-24 text-left">
      <div className="flex items-start justify-between border-b border-[#2a2a27] pb-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{skill ? 'Edit skill' : 'New skill'}</div>
          <h2 className="mt-1 font-serif text-3xl text-[#efeae4]">{skill ? skill.name : 'Create a skill'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Write the instructions, tool preferences, and mode compatibility this reusable skill should carry.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="rounded p-1 text-zinc-400 hover:bg-[#20201e] hover:text-zinc-200">
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>Name</span>
            <input
              value={name}
              disabled={Boolean(skill)}
              onChange={(event) => setName(event.target.value)}
              placeholder="skill-creator"
              className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#e2875e]/50 disabled:text-zinc-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Create reusable skills."
              className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#e2875e]/50"
            />
          </label>

          <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">
            <span>Instructions{skill ? ' (leave blank to keep existing)' : ''}</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Load SKILL.md, then draft the skill the user describes."
              className="min-h-[280px] flex-1 resize-y rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none focus:border-[#e2875e]/50"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-[#2a2a27] bg-[#171715] p-4">
          <fieldset className="flex flex-col gap-2 text-xs text-zinc-400">
            <legend className="text-xs text-zinc-400">Compatible modes (leave empty for all)</legend>
            <div className="flex flex-wrap gap-3">
              {CHAT_MODES.map((mode) => {
                const checked = compatibleModes === null ? true : compatibleModes.includes(mode);
                return (
                  <label key={mode} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? Array.from(new Set([...(compatibleModes ?? []), mode]))
                          : (compatibleModes ?? []).filter((entry) => entry !== mode);
                        setCompatibleModes(next.length === CHAT_MODES.length ? null : next);
                      }}
                    />
                    <span>{mode}</span>
                  </label>
                );
              })}
              <button type="button" onClick={() => setCompatibleModes(null)} className="text-[10px] text-zinc-500 underline">all</button>
            </div>
          </fieldset>

          <ToolCheckboxes title="Required tools" selected={requiredTools} onChange={setRequiredTools} />
          <ToolCheckboxes title="Disabled tools" selected={disabledTools} onChange={setDisabledTools} />

          {error && <p className="text-xs text-[#e2875e]">{error}</p>}

          <div className="mt-auto flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="rounded-xl border border-[#33332d] bg-[#1f1f1c] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-[#4a4a43] hover:text-white">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-xl bg-[#e2875e] px-3 py-1.5 text-xs font-medium text-[#121210] hover:bg-[#d67e5a] disabled:opacity-60">
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ToolCheckboxes({ title, selected, onChange }: { title: string; selected: string[]; onChange: (tools: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2 text-xs text-zinc-400">
      <legend className="text-xs text-zinc-400">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {selectableTools.map((tool) => (
          <label key={tool.id} className="flex items-center gap-1.5 rounded-lg border border-[#2a2a27] px-2 py-1">
            <input
              type="checkbox"
              checked={selected.includes(tool.id)}
              onChange={(event) => onChange(toggleToolSelection(selected, tool.id, event.target.checked))}
            />
            <span>{tool.label}</span>
          </label>
        ))}
        {selectableTools.length === 0 && <span className="text-zinc-600">No toggleable tools registered.</span>}
      </div>
    </fieldset>
  );
}
