import { AddModelsModal } from './AddModelsModal';
import { AiSettingsModal } from './AiSettingsModal';
import { buildSystemPromptSections } from './system-prompt';
import { OllamaModel, PullProgress } from './types';
import { ToolDefinition } from './tools/types';
import { ChatMode } from './types';

interface AiTabOverlaysProps {
  addModelsOpen: boolean;
  availableModels: OllamaModel[];
  chatMode: ChatMode;
  customSystemPrompt: string;
  isPullingModel: boolean;
  pullProgress: PullProgress | null;
  settingsOpen: boolean;
  tools: ToolDefinition[];
  onCloseAddModels: () => void;
  onCloseSettings: () => void;
  onPullModel: (modelName: string) => Promise<void>;
  onSaveSettings: (value: string) => void;
}

export function AiTabOverlays({
  addModelsOpen,
  availableModels,
  chatMode,
  customSystemPrompt,
  isPullingModel,
  pullProgress,
  settingsOpen,
  tools,
  onCloseAddModels,
  onCloseSettings,
  onPullModel,
  onSaveSettings,
}: AiTabOverlaysProps) {
  const sections = buildSystemPromptSections({
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
        chatMode={chatMode}
        customPrompt={customSystemPrompt}
        isOpen={settingsOpen}
        sections={sections}
        onClose={onCloseSettings}
        onSave={onSaveSettings}
      />
    </>
  );
}
