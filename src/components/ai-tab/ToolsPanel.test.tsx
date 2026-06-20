import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToolsPanel } from './ToolsPanel';
import type { ToolDefinition } from './tools/types';

interface ToolPanelItem extends ToolDefinition {
  enabled: boolean;
}

function tool(overrides: Partial<ToolPanelItem>): ToolPanelItem {
  return {
    id: 'weather',
    label: 'Weather',
    alias: '/weather',
    description: 'Looks up forecasts.',
    enabled: true,
    enabledByDefault: true,
    functions: [
      {
        name: 'get_weather',
        description: 'Get weather by place.',
        parameters: [{ name: 'location', type: 'string', description: 'Place name.', required: true }],
      },
    ],
    ...overrides,
  };
}

test('renders tool cards with a workspace search input', () => {
  const html = renderToStaticMarkup(
    <ToolsPanel
      tools={[tool({})]}
      onToggleTool={() => {}}
    />,
  );
  assert.match(html, /Search tools, functions, or parameters/);
  assert.match(html, /Weather/);
  assert.match(html, /get_weather/);
});
