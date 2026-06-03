import { weatherTool } from './weather-tool';
import { ToolRegistryEntry } from './types';

const toolRegistry: ToolRegistryEntry[] = [weatherTool];

export function getToolRegistryEntries() {
  return toolRegistry;
}
