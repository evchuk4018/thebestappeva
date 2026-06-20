import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { AutomationRecord, AutomationSummary, CreateAutomationRequest, UpdateAutomationRequest } from '../../../../shared/automations-contract';
import type { SkillSummary } from '../../../../shared/skills-contract';
import { WorkspaceSearchInput } from '../WorkspaceSearchInput';
import { filterAutomationsForWorkspaceSearch } from '../workspace-search';
import { AutomationEditor } from './AutomationEditor';

interface AutomationsPanelProps {
  automations: AutomationSummary[];
  loading: boolean;
  error: string | null;
  skills: SkillSummary[];
  onCreate: (request: CreateAutomationRequest) => Promise<unknown>;
  onUpdate: (id: string, request: UpdateAutomationRequest) => Promise<unknown>;
  onToggle: (id: string, enabled: boolean) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

function formatNextRun(automation: AutomationSummary) {
  return automation.nextRunAt ? new Date(automation.nextRunAt).toLocaleString() : automation.kind === 'schedule' ? 'No next run' : 'Conversation trigger';
}

export function AutomationsPanel({ automations, loading, error, skills, onCreate, onUpdate, onToggle, onDelete }: AutomationsPanelProps) {
  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; automation: AutomationRecord } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredAutomations = useMemo(() => filterAutomationsForWorkspaceSearch(automations, searchQuery), [automations, searchQuery]);
  const searchActive = searchQuery.trim().length > 0;

  if (editing) {
    return (
      <AutomationEditor
        automation={editing.mode === 'edit' ? editing.automation : null}
        skills={skills}
        onCancel={() => setEditing(null)}
        onSubmit={async (request) => {
          if (editing.mode === 'edit') await onUpdate(editing.automation.id, request as UpdateAutomationRequest);
          else await onCreate(request as CreateAutomationRequest);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5 py-6 pb-24 text-left">
      <div className="flex flex-col gap-4 border-b border-[#2a2a27] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Automations</div>
          <h2 className="mt-1 font-serif text-3xl text-[#efeae4]">Automation workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">Create scheduled AI runs and conversation triggers that can optionally load a linked skill.</p>
          {error && <p className="mt-2 text-xs text-[#e2875e]">{error}</p>}
          {loading && <p className="mt-2 text-xs text-zinc-500">Loading automations...</p>}
        </div>
        <button type="button" onClick={() => setEditing({ mode: 'create' })} className="flex items-center justify-center gap-2 rounded-xl border border-[#3a3a34] bg-[#20201e] px-4 py-2 text-sm font-medium text-[#efeae4]">
          <Plus size={15} /> New automation
        </button>
      </div>

      <WorkspaceSearchInput query={searchQuery} onChange={setSearchQuery} placeholder="Search automations, triggers, or status" />

      {automations.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-[#2a2a27] bg-[#171715] p-10 text-center text-sm text-zinc-500">No automations yet. Create one to schedule work or react to a conversation topic.</div>
      ) : filteredAutomations.length === 0 && searchActive ? (
        <div className="rounded-xl border border-dashed border-[#2a2a27] bg-[#171715] p-10 text-center text-sm text-zinc-500">No automations matched that search.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredAutomations.map((automation) => (
            <div key={automation.id} className="rounded-xl border border-[#2a2a27] bg-[#171715] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-[#efeae4]">{automation.name}</h3>
                    <span className="rounded border border-[#2a3d54] bg-[#16202a] px-1.5 py-0.5 font-mono text-[10px] text-[#8db4d0]">{automation.kind}</span>
                    {automation.action.linkedSkillName && <span className="rounded border border-[#3b3328] bg-[#211b16] px-1.5 py-0.5 text-[10px] text-[#e2875e]">skill: {automation.action.linkedSkillName}</span>}
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">{automation.description}</p>
                  <p className="mt-3 text-[11px] text-zinc-500">next: {formatNextRun(automation)}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">status: {automation.lastRunStatus}{automation.lastRunSummary ? ` - ${automation.lastRunSummary}` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => setEditing({ mode: 'edit', automation })} title="Edit automation" className="rounded p-1.5 text-zinc-400 hover:bg-[#20201e] hover:text-zinc-200"><Pencil size={14} /></button>
                  <button type="button" onClick={() => { if (confirm(`Delete automation "${automation.name}"?`)) void onDelete(automation.id); }} title="Delete automation" className="rounded p-1.5 text-zinc-400 hover:bg-[#7f3b31] hover:text-[#fff2eb]"><Trash2 size={14} /></button>
                  <button type="button" aria-pressed={automation.enabled} onClick={() => void onToggle(automation.id, !automation.enabled)} className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition ${automation.enabled ? 'bg-[#e2875e]' : 'bg-[#2a2a27]'}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${automation.enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
