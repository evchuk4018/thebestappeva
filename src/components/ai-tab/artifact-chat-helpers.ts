import { Chat } from './types';
import { ModelProvider } from './types';
import { collectLongPdfAttachments, createPdfReaderTool } from './tools/pdf-reader-tool';
import { createArtifactWorkspaceTool } from './tools/artifact-workspace-tool';
import { collectImageAttachments, createImageBridgeTool } from './tools/image-bridge-tool';
import { ToolRegistryEntry } from './tools/types';

export function buildVisibleTools(
  baseEntries: ToolRegistryEntry[],
  enabledTools: Record<string, boolean>,
  selectedChatId: string | null,
  selectedChat: Chat | null,
  provider: ModelProvider,
  maxVisionCallsPerMessage = 4,
) {
  const artifactTool = createArtifactWorkspaceTool(selectedChatId ?? 'draft-artifact-chat');
  const selectedPdfAttachments = selectedChat ? collectLongPdfAttachments(selectedChat.messages) : [];
  const selectedPdfTool = createPdfReaderTool(selectedPdfAttachments);
  const selectedImageAttachments = selectedChat ? collectImageAttachments(selectedChat.messages) : [];
  const selectedImageTool = createImageBridgeTool(selectedImageAttachments, maxVisionCallsPerMessage);

  return baseEntries
    .filter(({ definition }) => !definition.internal)
    .map(({ definition }) => ({
      ...definition,
      enabled: enabledTools[definition.id] ?? definition.enabledByDefault,
    }))
    .concat([
    { ...artifactTool.definition, enabled: enabledTools[artifactTool.definition.id] ?? artifactTool.definition.enabledByDefault },
    { ...selectedPdfTool.definition, enabled: selectedPdfAttachments.length > 0 },
    { ...selectedImageTool.definition, enabled: selectedImageAttachments.length > 0 },
    ]);
}

export function getActiveToolEntriesForChat(
  chat: Chat | null,
  baseEntries: ToolRegistryEntry[],
  enabledTools: Record<string, boolean>,
  provider: ModelProvider,
  maxVisionCallsPerMessage = 4,
) {
  const enabledEntries = baseEntries.filter(
    ({ definition }) => definition.internal || (enabledTools[definition.id] ?? definition.enabledByDefault),
  );
  const artifactEntries = chat && (enabledTools['artifact-workspace'] ?? true) ? [createArtifactWorkspaceTool(chat.id)] : [];
  const pdfAttachments = chat ? collectLongPdfAttachments(chat.messages) : [];
  const imageAttachments = chat ? collectImageAttachments(chat.messages) : [];
  return [
    ...enabledEntries,
    ...artifactEntries,
    ...(pdfAttachments.length ? [createPdfReaderTool(pdfAttachments)] : []),
    ...(imageAttachments.length ? [createImageBridgeTool(imageAttachments, maxVisionCallsPerMessage)] : []),
  ];
}

export function setChatActiveArtifactState(chat: Chat, artifactId: string | null) {
  return {
    ...chat,
    activeArtifactId: artifactId,
    includedArtifactIds: artifactId && !chat.includedArtifactIds.includes(artifactId) ? [...chat.includedArtifactIds, artifactId] : chat.includedArtifactIds,
  };
}

export function setChatIncludedArtifactState(chat: Chat, artifactId: string, included: boolean) {
  const includedArtifactIds = included
    ? [...new Set([...chat.includedArtifactIds, artifactId])]
    : chat.includedArtifactIds.filter((id) => id !== artifactId);
  return {
    ...chat,
    activeArtifactId: !included && chat.activeArtifactId === artifactId ? null : chat.activeArtifactId,
    includedArtifactIds,
  };
}
