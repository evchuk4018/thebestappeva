import { AddModelsModal } from './AddModelsModal';
import { AiSettingsModal } from './AiSettingsModal';
import { buildSystemPromptSections } from './system-prompt';
import type { ModelProvider, OllamaModel, PullProgress, RuntimeProviderOption } from './types';
import type { ToolDefinition } from './tools/types';
import type { ChatMode } from './types';
import type { AiVisionMode } from '../../../shared/ai-vision-contract';

interface AiTabOverlaysProps {
  addModelsOpen: boolean;
  allModels: OllamaModel[];
  availableModels: OllamaModel[];
  chatMode: ChatMode;
  currentModel: string | null;
  currentProvider: ModelProvider;
  visionMode: AiVisionMode;
  customSystemPrompt: string;
  isPullingModel: boolean;
  pullProgress: PullProgress | null;
  providerOptions: RuntimeProviderOption[];
  settingsOpen: boolean;
  tools: ToolDefinition[];
  onCloseAddModels: () => void;
  onCloseSettings: () => void;
  onPullModel: (modelName: string) => Promise<void>;
  onSaveSettings: (value: { customPrompt: string; provider: ModelProvider; model: string | null; visionMode: AiVisionMode }) => void;
}

export function AiTabOverlays({
  addModelsOpen,
  allModels,
  availableModels,
  chatMode,
  currentModel,
  currentProvider,
  visionMode,
  customSystemPrompt,
  isPullingModel,
  pullProgress,
  providerOptions,
  settingsOpen,
  tools,
  onCloseAddModels,
  onCloseSettings,
  onPullModel,
  onSaveSettings,
}: AiTabOverlaysProps) {
  const sections = buildSystemPromptSections({
    generatedUserMemory: '',
    customPrompt: customSystemPrompt,
    mode: chatMode,
    tools,
    artifactContext: undefined,
  });

  return (
    <>
      <AddModelsModal
        installedModelNames={availableModels.map((model) => model.name)}
        isOpen={addModelsOpen}
        isPulling={isPullingModel}
        pullProgress={pullProgress}
        onClose={onCloseAddModels}
        onPullModel={onPullModel}
      />
      <AiSettingsModal
        availableModels={allModels}
        chatMode={chatMode}
        currentModel={currentModel}
        currentProvider={currentProvider}
        currentVisionMode={visionMode}
        customPrompt={customSystemPrompt}
        isOpen={settingsOpen}
        providerOptions={providerOptions}
        sections={sections}
        onClose={onCloseSettings}
        onSave={onSaveSettings}
      />
    </>
  );
}
