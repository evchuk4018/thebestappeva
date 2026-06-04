import { getOnlineStatusSnapshot } from './browser-context';
import { ToolRegistryEntry } from './types';

function buildConnectionSummary(connection: ReturnType<typeof getOnlineStatusSnapshot>['connection']) {
  if (!connection) {
    return '';
  }

  const segments = [
    connection.effectiveType ? `effective type ${connection.effectiveType}` : null,
    typeof connection.downlink === 'number' ? `${connection.downlink} Mb/s downlink` : null,
    typeof connection.rtt === 'number' ? `${connection.rtt} ms RTT` : null,
    connection.saveData ? 'data saver enabled' : null,
  ].filter(Boolean);

  return segments.length ? ` ${segments.join(', ')}.` : '';
}

export const onlineStatusTool: ToolRegistryEntry = {
  definition: {
    id: 'online-status',
    label: 'Online Status',
    alias: '/online-status',
    description: 'Reads whether the browser reports an active network connection and any available connection hints.',
    enabledByDefault: true,
    functions: [
      {
        name: 'get_online_status',
        description: 'Get whether the browser currently reports being online.',
        parameters: [],
      },
    ],
  },
  async execute(invocation) {
    const snapshot = getOnlineStatusSnapshot();
    const statusLabel = snapshot.online ? 'online' : 'offline';

    return {
      toolId: invocation.toolId,
      functionName: invocation.functionName,
      ok: true,
      summary: `The browser currently reports being ${statusLabel}.${buildConnectionSummary(snapshot.connection)}`,
      data: snapshot,
    };
  },
};
