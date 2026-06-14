import { askUserTool } from './ask-user-tool';
import { dateTimeTool } from './date-time-tool';
import { localeTool } from './locale-tool';
import { locationTool } from './location-tool';
import { onlineStatusTool } from './online-status-tool';
import { pythonExecTool } from './python-exec-tool';
import { timezoneTool } from './timezone-tool';
import { webSearchTool } from './web-search-tool';
import { weatherTool } from './weather-tool';
import { ToolRegistryEntry } from './types';

const toolRegistry: ToolRegistryEntry[] = [
  askUserTool,
  dateTimeTool,
  locationTool,
  timezoneTool,
  weatherTool,
  localeTool,
  onlineStatusTool,
  webSearchTool,
  pythonExecTool,
];

export function getToolRegistryEntries() {
  return toolRegistry;
}
