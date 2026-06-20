import { useMemo, useState } from 'react';
import { ToolDefinition } from './tools/types';
import { WorkspaceSearchInput } from './WorkspaceSearchInput';
import { filterToolsForWorkspaceSearch } from './workspace-search';

interface ToolPanelItem extends ToolDefinition {
  enabled: boolean;
}

interface ToolsPanelProps {
  tools: ToolPanelItem[];
  onToggleTool: (toolId: string, enabled: boolean) => void;
}

export function ToolsPanel({ tools, onToggleTool }: ToolsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const filteredTools = useMemo(() => filterToolsForWorkspaceSearch(tools, searchQuery), [tools, searchQuery]);
  const searchActive = searchQuery.trim().length > 0;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 py-6 pb-24">
      <div className="px-1 text-left">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Installed tools</div>
        <h2 className="mt-1 font-serif text-3xl text-[#efeae4]">Tool workspace</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">Enabled tools are exposed to the model and only load data on demand.</p>
      </div>

      <WorkspaceSearchInput query={searchQuery} onChange={setSearchQuery} placeholder="Search tools, functions, or parameters" />

      {filteredTools.length === 0 && searchActive ? (
        <div className="rounded-xl border border-dashed border-[#2a2a27] bg-[#171715] p-10 text-center text-sm text-zinc-500">
          No tools matched that search.
        </div>
      ) : (
      <div className="grid gap-3 lg:grid-cols-2">
        {filteredTools.map((tool) => (
          <div key={tool.id} className="rounded-xl border border-[#2a2a27] bg-[#171715] p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#efeae4]">{tool.label}</h3>
                  <span className="rounded border border-[#2a3d54] bg-[#16202a] px-1.5 py-0.5 font-mono text-[10px] text-[#8db4d0]">
                    {tool.alias}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{tool.description}</p>
              </div>
              {tool.automatic ? (
                <span className="rounded-full border border-[#3b3328] bg-[#211b16] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#e2875e]">
                  {tool.enabled ? 'Auto' : 'Needs PDF'}
                </span>
              ) : (
                <button
                  type="button"
                  aria-pressed={tool.enabled}
                  onClick={() => onToggleTool(tool.id, !tool.enabled)}
                  className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition ${
                    tool.enabled ? 'bg-[#e2875e]' : 'bg-[#2a2a27]'
                  }`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${tool.enabled ? 'left-6' : 'left-1'}`} />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {tool.functions.map((toolFunction) => (
                <div key={toolFunction.name} className="rounded-lg border border-[#232320] bg-[#11110f] px-3 py-2.5">
                  <p className="font-mono text-[11px] text-[#d9e7f3]">{toolFunction.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{toolFunction.description}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                    {toolFunction.parameters.map((parameter) => `${parameter.name}: ${parameter.type}${parameter.required ? ' required' : ''}`).join(' - ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
