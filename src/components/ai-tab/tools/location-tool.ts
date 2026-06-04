import { formatCoordinate, getCurrentPosition } from './browser-context';
import { ToolRegistryEntry, ToolResult } from './types';

function buildLocationError(functionName: string, message: string): ToolResult {
  return {
    toolId: 'location',
    functionName,
    ok: false,
    summary: message,
    error: message,
  };
}

export const locationTool: ToolRegistryEntry = {
  definition: {
    id: 'location',
    label: 'Location',
    alias: '/location',
    description: 'Reads the current browser geolocation coordinates and accuracy when permission is allowed.',
    enabledByDefault: true,
    functions: [
      {
        name: 'get_current_location',
        description: 'Get the current browser latitude, longitude, accuracy, and timestamp.',
        parameters: [],
      },
    ],
  },
  async execute(invocation) {
    try {
      const position = await getCurrentPosition();

      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary: `Current coordinates are ${formatCoordinate(position.latitude)}, ${formatCoordinate(position.longitude)} with about ${Math.round(position.accuracy)} meters accuracy.`,
        data: { ...position },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Current location lookup failed.';
      return buildLocationError(invocation.functionName, message);
    }
  },
};
