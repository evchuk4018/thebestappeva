import type { RefObject } from 'react';
import { ArtifactPanel } from './artifacts/ArtifactPanel';
import { useArtifactPanelWidth } from './artifacts/artifact-panel-width';
import { useAiArtifacts } from './artifacts/useAiArtifacts';

interface AiArtifactsWorkspaceProps {
  activeArtifactId: string | null;
  chatId: string | null;
  chatUpdatedAt?: string;
  includedArtifactIds: string[];
  onOpenArtifact: (artifactId: string | null) => void;
  onSetIncluded: (artifactId: string, included: boolean) => void;
  workspaceRef: RefObject<HTMLDivElement | null>;
}

export function AiArtifactsWorkspace({
  activeArtifactId,
  chatId,
  chatUpdatedAt,
  includedArtifactIds,
  onOpenArtifact,
  onSetIncluded,
  workspaceRef,
}: AiArtifactsWorkspaceProps) {
  const artifactState = useAiArtifacts({ activeArtifactId, chatId, chatUpdatedAt });
  const panelWidth = useArtifactPanelWidth({ workspaceRef });

  return (
    <ArtifactPanel
      activeArtifact={artifactState.activeArtifact}
      activeArtifactId={activeArtifactId}
      artifacts={artifactState.artifacts}
      includedArtifactIds={includedArtifactIds}
      isResizable={panelWidth.isResizable}
      isResizing={panelWidth.isResizing}
      onClose={() => onOpenArtifact(null)}
      onExport={async (artifactId) => (await artifactState.exportArtifact(artifactId, 'create_or_update_linked'))?.openUrl ?? null}
      onOpenArtifact={onOpenArtifact}
      onResizePointerDown={panelWidth.onResizePointerDown}
      onRunSearch={(artifactId, query, mode) => artifactState.runSearch(artifactId, query, mode)}
      onSaveArtifact={async (request) => void (await artifactState.saveArtifact(request))}
      onSetIncluded={onSetIncluded}
      onUpdateTable={async (request) => void (await artifactState.updateTable(request as never))}
      panelWidth={panelWidth.panelWidth}
    />
  );
}
