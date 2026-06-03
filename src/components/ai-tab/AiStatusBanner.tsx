import { AlertTriangle, PackagePlus, Wifi, WifiOff } from 'lucide-react';
import { OllamaAvailability } from './types';

interface AiStatusBannerProps {
  availability: OllamaAvailability;
  lastError: string | null;
  onOpenAddModels: () => void;
}

export function AiStatusBanner({ availability, lastError, onOpenAddModels }: AiStatusBannerProps) {
  if (availability === 'ready' && !lastError) {
    return null;
  }

  const config = {
    connecting: {
      icon: Wifi,
      title: 'Connecting to local Ollama',
      description: 'The app is checking http://127.0.0.1:11434 for installed models.',
      action: null,
    },
    'no-models': {
      icon: PackagePlus,
      title: 'Ollama is running, but no models are installed',
      description: 'Add a local model to enable the chat composer and start a conversation.',
      action: 'Add models',
    },
    unavailable: {
      icon: WifiOff,
      title: 'Unable to reach local Ollama',
      description: lastError ?? 'The app will retry automatically every 10 seconds and whenever this window regains focus.',
      action: null,
    },
    ready: {
      icon: AlertTriangle,
      title: 'Temporary Ollama issue',
      description: lastError ?? 'The app hit an unexpected local runtime error.',
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
