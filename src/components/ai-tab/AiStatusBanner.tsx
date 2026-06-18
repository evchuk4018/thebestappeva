import { AlertTriangle, PackagePlus, Wifi, WifiOff } from 'lucide-react';
import type { AiAttachmentHealth, ModelProvider, OllamaAvailability } from './types';
import type { AiVisionMode } from '../../../shared/ai-vision-contract';

interface AiStatusBannerProps {
  availability: OllamaAvailability;
  currentProvider: ModelProvider;
  visionMode: AiVisionMode;
  lastError: string | null;
  parserHealth: AiAttachmentHealth | null;
  persistenceError: string | null;
  onOpenAddModels: () => void;
}

export function AiStatusBanner({ availability, currentProvider, visionMode, lastError, parserHealth, persistenceError, onOpenAddModels }: AiStatusBannerProps) {
  if (availability === 'ready' && parserHealth?.available !== false && !lastError && !persistenceError) {
    return null;
  }

  if (parserHealth?.available === false && availability === 'ready' && !lastError) {
    return (
      <div className="mb-4 w-full max-w-xl rounded-2xl border border-[#4b3326] bg-[#241d18] px-4 py-3 text-left shadow-lg md:max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-[#e2875e]/15 p-2 text-[#e2875e]">
            <AlertTriangle size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#efeae4]">Local document parser unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{parserHealth.details ?? parserHealth.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (availability === 'ready' && persistenceError && !lastError) {
    return (
      <div className="mb-4 w-full max-w-xl rounded-2xl border border-[#3a342b] bg-[#23201c] px-4 py-3 text-left shadow-lg md:max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-[#e2875e]/15 p-2 text-[#e2875e]">
            <AlertTriangle size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#efeae4]">Local AI workspace issue</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{persistenceError}</p>
          </div>
        </div>
      </div>
    );
  }

  const providerLabel = currentProvider === 'deepseek' ? 'DeepSeek' : 'Ollama';
  const config = {
    connecting: {
      icon: Wifi,
      title: `Checking ${providerLabel}`,
      description: currentProvider === 'deepseek'
        ? 'The app is reading server-side provider configuration.'
        : 'The app is checking the configured local Ollama runtime for installed models.',
      action: null,
    },
    'no-models': {
      icon: PackagePlus,
      title: 'No models are installed',
      description: 'Add a model to enable the chat composer and start a conversation.',
      action: 'Add models',
    },
    unavailable: {
      icon: WifiOff,
      title: `${providerLabel} unavailable`,
      description: lastError ?? `The app will retry automatically every 10 seconds and whenever this window regains focus. Vision mode is ${visionMode}.`,
      action: null,
    },
    ready: {
      icon: AlertTriangle,
      title: `Temporary ${providerLabel} issue`,
      description: lastError ?? 'The app hit an unexpected runtime error.',
      action: null,
    },
  }[availability];

  const Icon = config.icon;

  return (
    <div className="mb-4 w-full max-w-xl rounded-2xl border border-[#3a342b] bg-[#23201c] px-4 py-3 text-left shadow-lg md:max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-[#e2875e]/15 p-2 text-[#e2875e]">
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#efeae4]">{config.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{config.description}</p>
        </div>
        {config.action && (
          <button
            type="button"
            onClick={onOpenAddModels}
            className="rounded-xl border border-[#4a4034] bg-[#2b2620] px-3 py-1.5 text-xs font-medium text-[#efeae4] transition hover:border-[#e2875e]/40 hover:text-white"
          >
            {config.action}
          </button>
        )}
      </div>
    </div>
  );
}
