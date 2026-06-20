import { getToolRegistryEntries } from './registry';

export const selectableTools = getToolRegistryEntries()
  .filter((entry) => !entry.definition.internal && !entry.definition.automatic)
  .map((entry) => ({ id: entry.definition.id, label: entry.definition.label }));

export function toggleToolSelection(selected: string[], toolId: string, include: boolean) {
  return include ? Array.from(new Set([...selected, toolId])) : selected.filter((entry) => entry !== toolId);
}
