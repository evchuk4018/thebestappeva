import { automationTool } from './automation-tool';
import { askUserTool } from './ask-user-tool';
import { calendarTool } from './calendar-tool';
import { dateTimeTool } from './date-time-tool';
import { localeTool } from './locale-tool';
import { locationTool } from './location-tool';
import { onlineStatusTool } from './online-status-tool';
import { pythonExecTool } from './python-exec-tool';
import { skillTool } from './skill-tool';
import { timezoneTool } from './timezone-tool';
import { webSearchTool } from './web-search-tool';
import { weatherTool } from './weather-tool';
import { workoutTool } from './workout-tool';
import { ToolRegistryEntry } from './types';

const toolRegistry: ToolRegistryEntry[] = [
  automationTool,
  askUserTool,
  calendarTool,
  dateTimeTool,
  locationTool,
  timezoneTool,
  weatherTool,
  localeTool,
  onlineStatusTool,
  webSearchTool,
  workoutTool,
  pythonExecTool,
  skillTool,
];

export function getToolRegistryEntries() {
  return toolRegistry;
}
