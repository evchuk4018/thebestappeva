import { useEffect, useState } from 'react';
import { Download, Search, Sparkles, X } from 'lucide-react';
import { curatedModelCatalog } from './data';
import { formatProgress, normalizeModelName } from './helpers';
import { CatalogModel, PullProgress } from './types';

interface AddModelsModalProps {
  installedModelNames: string[];
  isOpen: boolean;
  isPulling: boolean;
  pullProgress: PullProgress | null;
  onClose: () => void;
  onPullModel: (modelName: string) => Promise<void>;
}

function matchesCatalogQuery(model: CatalogModel, query: string) {
  const value = query.trim().toLowerCase();
  if (!value) {
    return true;
  }

  return [model.name, model.title, model.description, ...model.tags, ...model.sizes].some((entry) => entry.toLowerCase().includes(value));
}

export function AddModelsModal({
  installedModelNames,
  isOpen,
  isPulling,
  pullProgress,
  onClose,
  onPullModel,
}: AddModelsModalProps) {
  const [manualModelName, setManualModelName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setManualModelName('');
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const installedSet = new Set(installedModelNames);
  const filteredModels = curatedModelCatalog.filter((model) => matchesCatalogQuery(model, searchQuery));
  const progressLabel = formatProgress(pullProgress);

  async function handleManualInstall() {
    const normalized = normalizeModelName(manualModelName);
    if (!normalized) {
      return;
    }

    await onPullModel(normalized);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#2f2f2b] bg-[#151513] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#262622] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Add models</p>
            <h2 className="mt-1 font-serif text-2xl text-[#efeae4]">Install Ollama models locally</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 transition hover:bg-[#20201e] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 border-b border-[#262622] px-5 py-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#efeae4]">
              <Sparkles size={16} className="text-[#e2875e]" />
              <span>Manual pull</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">Paste any `model[:tag]` from the Ollama catalog if it is not listed below.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={manualModelName}
                onChange={(event) => setManualModelName(event.target.value)}
                placeholder="qwen3.5:9b"
                className="min-w-0 flex-1 rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#e2875e]/50"
              />
              <button
                type="button"
                onClick={() => void handleManualInstall()}
                disabled={isPulling || !normalizeModelName(manualModelName)}
                className="rounded-xl bg-[#e2875e] px-4 py-2 text-sm font-medium text-[#121210] transition hover:bg-[#d67e5a] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Pull
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
            <p className="text-sm font-medium text-[#efeae4]">Current download</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {progressLabel ?? 'No active download. Start with the curated list or enter a model name manually.'}
            </p>
            {pullProgress?.model && <p className="mt-3 font-mono text-xs text-[#e2875e]">{pullProgress.model}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-[#262622] px-5 py-3">
          <Search size={15} className="text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search curated models"
            className="w-full border-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </div>

        <div className="grid flex-1 gap-3 overflow-y-auto px-5 py-4 md:grid-cols-2">
          {filteredModels.map((model) => {
            const isInstalled = installedSet.has(model.name);
            const isDownloading = pullProgress?.model === model.name && isPulling;

            return (
              <div key={model.name} className="rounded-2xl border border-[#2c2c28] bg-[#1a1a18] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium text-[#efeae4]">{model.title}</h3>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{model.name}</p>
                  </div>
                  <span className="rounded-full border border-[#383832] bg-[#11110f] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    {model.sizes.join(' / ')}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{model.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {model.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[#312e29] bg-[#201d19] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-xs font-medium ${isInstalled ? 'text-emerald-300' : 'text-zinc-500'}`}>
                    {isInstalled ? 'Installed' : isDownloading ? 'Downloading...' : 'Not installed'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onPullModel(model.name)}
                    disabled={isPulling || isInstalled}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#3a342d] bg-[#22211d] px-3 py-1.5 text-xs font-medium text-[#efeae4] transition hover:border-[#e2875e]/40 hover:text-white disabled:cursor-not-allowed disabled:border-[#2d2d2a] disabled:text-zinc-600"
                  >
                    <Download size={13} />
                    <span>{isInstalled ? 'Installed' : 'Download'}</span>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredModels.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#2f2f2b] bg-[#171715] px-4 py-6 text-sm text-zinc-500">
              No curated models matched that search. Try a broader search or pull a manual model tag.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
