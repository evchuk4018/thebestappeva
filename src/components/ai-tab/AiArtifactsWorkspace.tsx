import { ArtifactPanel } from './artifacts/ArtifactPanel';
import { useAiArtifacts } from './artifacts/useAiArtifacts';

interface AiArtifactsWorkspaceProps {
  activeArtifactId: string | null;
  chatId: string | null;
  chatUpdatedAt?: string;
  includedArtifactIds: string[];
  onOpenArtifact: (artifactId: string | null) => void;
  onSetIncluded: (artifactId: string, included: boolean) => void;
}

export function AiArtifactsWorkspace({
  activeArtifactId,
  chatId,
  chatUpdatedAt,
  includedArtifactIds,
  onOpenArtifact,
  onSetIncluded,
}: AiArtifactsWorkspaceProps) {
  const artifactState = useAiArtifacts({ activeArtifactId, chatId, chatUpdatedAt });

  return (
    <ArtifactPanel
      activeArtifact={artifactState.activeArtifact}
      activeArtifactId={activeArtifactId}
      artifacts={artifactState.artifacts}
      includedArtifactIds={includedArtifactIds}
      onClose={() => onOpenArtifact(null)}
      onExport={async (artifactId) => (await artifactState.exportArtifact(artifactId, 'create_or_update_linked'))?.openUrl ?? null}
      onOpenArtifact={onOpenArtifact}
      onRestoreVersion={async (artifactId, versionId) => void (await artifactState.restoreVersion(artifactId, versionId))}
      onRunSearch={async (artifactId, query, mode) => void (await artifactState.runSearch(artifactId, query, mode))}
      onSaveArtifact={async (request) => void (await artifactState.saveArtifact(request))}
      onSetIncluded={onSetIncluded}
      onUpdateTable={async (request) => void (await artifactState.updateTable(request as never))}
      outline={artifactState.outline?.outline ?? []}
      searchMatches={artifactState.searchResults?.matches ?? []}
      versions={artifactState.versions}
    />
  );
}
