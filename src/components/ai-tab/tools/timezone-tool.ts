import { getCurrentTimezoneSnapshot } from './browser-context';
import { ToolRegistryEntry } from './types';

export const timezoneTool: ToolRegistryEntry = {
  definition: {
    id: 'timezone',
    label: 'Timezone',
    alias: '/timezone',
    description: 'Reads the browser timezone, UTC offset, and a display-friendly label.',
    enabledByDefault: true,
    functions: [
      {
        name: 'get_current_timezone',
        description: 'Get the current browser timezone and UTC offset.',
        parameters: [],
      },
    ],
  },
  async execute(invocation) {
    const snapshot = getCurrentTimezoneSnapshot();

    return {
      toolId: invocation.toolId,
      functionName: invocation.functionName,
      ok: true,
      summary: `Current timezone is ${snapshot.displayLabel}.`,
      data: snapshot,
    };
  },
};
