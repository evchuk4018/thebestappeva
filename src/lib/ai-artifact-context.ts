import { Chat } from '../components/ai-tab/types';
import { getArtifactOutline, loadArtifact } from './ai-artifacts-storage';

const DEFAULT_INLINE_MAX_CHARS = 4000;

export async function buildArtifactContext(chat: Chat) {
  const artifactIds = [...new Set(chat.includedArtifactIds)];
  if (!artifactIds.length) {
    return '';
  }

  const sections = await Promise.all(artifactIds.map(async (artifactId) => {
    const artifact = await loadArtifact(chat.id, artifactId);
    const isActive = chat.activeArtifactId === artifactId;
    const maxChars = artifact.contextPolicy.maxChars ?? DEFAULT_INLINE_MAX_CHARS;
    if (artifact.content.length <= maxChars && artifact.contextPolicy.mode !== 'summary') {
      return [
        `Artifact: ${artifact.title} (${artifact.type})${isActive ? ' [active]' : ''}`,
        `Artifact ID: ${artifact.artifactId}`,
        `Lines: ${artifact.lineCount}  Characters: ${artifact.charCount}`,
        '',
        artifact.content,
      ].join('\n');
    }

    const outline = await getArtifactOutline(chat.id, artifactId);
    return [
      `Artifact: ${artifact.title} (${artifact.type})${isActive ? ' [active]' : ''}`,
      `Artifact ID: ${artifact.artifactId}`,
      `Lines: ${artifact.lineCount}  Characters: ${artifact.charCount}`,
      `Preview: ${artifact.preview ?? ''}`,
      outline.outline.length ? `Outline: ${outline.outline.slice(0, 8).map((entry) => `${'#'.repeat(entry.level)} ${entry.heading}`).join(' | ')}` : null,
      'This artifact is too long to inject fully. Use get_artifact_outline, search_artifact, and fetch_artifact_lines before editing unknown sections.',
    ].filter(Boolean).join('\n');
  }));

  return ['Included artifact context:', ...sections].join('\n\n');
}
