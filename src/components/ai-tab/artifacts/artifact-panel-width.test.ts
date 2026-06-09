import assert from 'node:assert/strict';
import test from 'node:test';
import { clampArtifactPanelWidth, getArtifactPanelLayout, getDefaultArtifactPanelWidth } from './artifact-panel-width';

test('defaults artifact panel width to about half the workspace within bounds', () => {
  assert.equal(getDefaultArtifactPanelWidth(1600), 800);
  assert.equal(getDefaultArtifactPanelWidth(2400), 960);
  assert.equal(getDefaultArtifactPanelWidth(900), 450);
});

test('clamps artifact panel width so chat keeps its minimum space', () => {
  assert.equal(clampArtifactPanelWidth(1500, 1200), 960);
  assert.equal(clampArtifactPanelWidth(1000, 800), 580);
  assert.equal(clampArtifactPanelWidth(1000, 200), 360);
});

test('disables drag-resize on narrow workspaces and uses the safe maximum width', () => {
  assert.deepEqual(getArtifactPanelLayout(900, 700), { isResizable: false, width: 480 });
  assert.deepEqual(getArtifactPanelLayout(1400, 700), { isResizable: true, width: 700 });
});
