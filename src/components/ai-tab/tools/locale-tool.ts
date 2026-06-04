import { getCurrentLocaleSnapshot } from './browser-context';
import { ToolRegistryEntry } from './types';

export const localeTool: ToolRegistryEntry = {
  definition: {
    id: 'locale',
    label: 'Locale',
    alias: '/locale',
    description: 'Reads the browser locale and preferred language list.',
    enabledByDefault: true,
    functions: [
      {
        name: 'get_current_locale',
        description: 'Get the browser locale and ordered preferred languages.',
        parameters: [],
      },
    ],
  },
  async execute(invocation) {
    const snapshot = getCurrentLocaleSnapshot();

    return {
      toolId: invocation.toolId,
      functionName: invocation.functionName,
      ok: true,
      summary: snapshot.languages.length
        ? `Primary locale is ${snapshot.locale}. Preferred languages: ${snapshot.languages.join(', ')}.`
        : `Primary locale is ${snapshot.locale}.`,
      data: snapshot,
    };
  },
};
