import { Bot, LoaderCircle, PackagePlus, ServerCrash } from 'lucide-react';
import type { ModelProvider, OllamaAvailability } from './types';

interface RuntimePillProps {
  availability: OllamaAvailability;
  currentProvider: ModelProvider;
  modelCount: number;
  onOpenAddModels: () => void;
}

export function RuntimePill({ availability, currentProvider, modelCount, onOpenAddModels }: RuntimePillProps) {
  const providerLabel = currentProvider === 'deepseek' ? 'DeepSeek' : 'Ollama';
  const config = {
    connecting: {
      icon: LoaderCircle,
      label: `Checking ${providerLabel}`,
      detail: currentProvider === 'deepseek' ? 'Reading server-side provider status' : 'Looking for installed models',
      action: null,
      iconClassName: 'animate-spin',
    },
    ready: {
      icon: Bot,
      label: `${providerLabel} ready`,
      detail: `${modelCount} model${modelCount === 1 ? '' : 's'} available`,
      action: null,
      iconClassName: '',
    },
    'no-models': {
      icon: PackagePlus,
      label: 'No local models yet',
      detail: 'Install one to start chatting',
      action: 'Add models',
      iconClassName: '',
    },
    unavailable: {
      icon: ServerCrash,
      label: `${providerLabel} unavailable`,
      detail: 'Retrying in the background',
      action: null,
      iconClassName: '',
    },
  }[availability];

  const Icon = config.icon;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#2f2f2b]/45 bg-[#121210]/50 px-3 py-1.5 text-xs text-zinc-400">
      <Icon size={13} className={config.iconClassName} />
      <span>{config.label}</span>
      <span className="px-1 text-zinc-600">.</span>
      <span>{config.detail}</span>
      {config.action && (
        <button type="button" onClick={onOpenAddModels} className="font-medium text-[#e2875e] hover:underline">
          {config.action}
        </button>
      )}
    </div>
  );
}
