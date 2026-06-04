import { getCurrentDateTimeSnapshot } from './browser-context';
import { ToolRegistryEntry } from './types';

export const dateTimeTool: ToolRegistryEntry = {
  definition: {
    id: 'date-time',
    label: 'Date & Time',
    alias: '/date-time',
    description: 'Reads the current browser date, local time, weekday, and ISO timestamp.',
    enabledByDefault: true,
    functions: [
      {
        name: 'get_current_date_time',
        description: 'Get the current local date and time from the browser runtime.',
        parameters: [],
      },
    ],
  },
  async execute(invocation) {
    const snapshot = getCurrentDateTimeSnapshot();

    return {
      toolId: invocation.toolId,
      functionName: invocation.functionName,
      ok: true,
      summary: `${snapshot.localDate} at ${snapshot.localTime} in ${snapshot.timezone}.`,
      data: snapshot,
    };
  },
};
