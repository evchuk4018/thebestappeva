import { DocPreferences, DocSearchIndexEntry } from './docs-types';

export function filterDocs(
  docs: DocSearchIndexEntry[],
  query: string,
  preferences: DocPreferences,
  showTrash: boolean,
) {
  const normalized = query.trim().toLowerCase();

  return docs
    .filter((doc) => showTrash ? Boolean(doc.trashedAt) : !doc.trashedAt)
    .filter((doc) => {
      if (!normalized) return true;
      return `${doc.title} ${doc.preview}`.toLowerCase().includes(normalized);
    })
    .sort((left, right) => {
      if (preferences.sort === 'title') return left.title.localeCompare(right.title);
      return right[preferences.sort].localeCompare(left[preferences.sort]);
    });
}
