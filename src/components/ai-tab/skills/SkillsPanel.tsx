import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CreateSkillRequest, SkillSummary, UpdateSkillRequest } from '../../../../shared/skills-contract';
import { SkillEditor } from './SkillEditor';

interface SkillsPanelHandlers {
  skills: SkillSummary[];
  loading: boolean;
  error: string | null;
  onCreate: (request: CreateSkillRequest) => Promise<unknown>;
  onUpdate: (id: string, request: UpdateSkillRequest) => Promise<unknown>;
  onToggle: (id: string, enabled: boolean) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export function SkillsPanel({ skills, loading, error, onCreate, onUpdate, onToggle, onDelete }: SkillsPanelHandlers) {
  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; skill: SkillSummary } | null>(null);

  if (editing) {
    return (
      <SkillEditor
        skill={editing.mode === 'edit' ? editing.skill : null}
        onCancel={() => setEditing(null)}
        onSubmit={async (request) => {
          if (editing.mode === 'edit') {
            await onUpdate(editing.skill.id, request as UpdateSkillRequest);
          } else {
            await onCreate(request as CreateSkillRequest);
          }
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5 py-6 pb-24 text-left">
      <div className="flex flex-col gap-4 border-b border-[#2a2a27] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Skills</div>
          <h2 className="mt-1 font-serif text-3xl text-[#efeae4]">Skill creator</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Create and tune reusable instruction packages for the chat composer.
          </p>
          {error && <p className="mt-2 text-xs text-[#e2875e]">{error}</p>}
          {loading && <p className="mt-2 text-xs text-zinc-500">Loading skills...</p>}
        </div>
        <button
          type="button"
          onClick={() => setEditing({ mode: 'create' })}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#3a3a34] bg-[#20201e] px-4 py-2 text-sm font-medium text-[#efeae4] transition hover:border-[#e2875e]/45 hover:text-white"
        >
          <Plus size={15} /> New skill
        </button>
      </div>

      {skills.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-[#2a2a27] bg-[#171715] p-10 text-center text-sm text-zinc-500">
          No skills yet. Create one to package reusable instructions.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {skills.map((skill) => (
            <div key={skill.id} className="rounded-xl border border-[#2a2a27] bg-[#171715] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-[#efeae4]">{skill.name}</h3>
                    {skill.readOnly && (
                      <span className="rounded-full border border-[#3b3328] bg-[#211b16] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#e2875e]">
                        Built-in
                      </span>
                    )}
                    <span className="rounded border border-[#2a3d54] bg-[#16202a] px-1.5 py-0.5 font-mono text-[10px] text-[#8db4d0]">
                      /{skill.name}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">{skill.description}</p>
                  {(skill.requiredTools.length > 0 || skill.disabledTools.length > 0) && (
                    <p className="mt-3 text-[11px] text-zinc-500">
                      {skill.requiredTools.length > 0 && <>requires: {skill.requiredTools.join(', ')}</>}
                      {skill.requiredTools.length > 0 && skill.disabledTools.length > 0 && <> - </>}
                      {skill.disabledTools.length > 0 && <>disables: {skill.disabledTools.join(', ')}</>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {skill.readOnly ? (
                    <span className="rounded-full border border-[#2a2a27] bg-[#11110f] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Read only
                    </span>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditing({ mode: 'edit', skill })} title="Edit skill" className="rounded p-1.5 text-zinc-400 hover:bg-[#20201e] hover:text-zinc-200">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => { if (confirm(`Delete skill "${skill.name}"?`)) void onDelete(skill.id); }} title="Delete skill" className="rounded p-1.5 text-zinc-400 hover:bg-[#7f3b31] hover:text-[#fff2eb]">
                        <Trash2 size={14} />
                      </button>
                      <button type="button" aria-pressed={skill.enabled} onClick={() => void onToggle(skill.id, !skill.enabled)} className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition ${skill.enabled ? 'bg-[#e2875e]' : 'bg-[#2a2a27]'}`}>
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${skill.enabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
