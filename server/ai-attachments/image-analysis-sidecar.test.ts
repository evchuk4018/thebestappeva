import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeImageWithSidecar, setImageAnalysisSidecarHookForTests } from './image-analysis-sidecar';

test('analyzeImageWithSidecar normalizes null optional geometry fields from the sidecar', async () => {
  setImageAnalysisSidecarHookForTests(async () => JSON.stringify({
    sceneGraph: {
      canvas: { width: 240, height: 160, background: '#ffffff' },
      objects: [
        {
          id: 'obj_1',
          type: 'rectangle',
          bbox: [20, 30, 100, 100],
          polygon: null,
          line: null,
          dominantColors: ['#d71920'],
          fill: '#d71920',
          stroke: '#000000',
          crops: ['full', 'left'],
          confidence: 0.9,
        },
        {
          id: 'obj_2',
          type: 'line',
          bbox: [130, 40, 200, 42],
          polygon: null,
          line: [130, 40, 200, 42],
          dominantColors: ['#1f77b4'],
          fill: '#1f77b4',
          stroke: '#1f77b4',
          crops: ['full', 'right'],
          confidence: 0.88,
        },
      ],
      text: [],
      relationships: [],
      uncertain: [],
      diagnostics: {
        analysisVersion: 'scene-graph-v1',
        generatedAt: '',
        ocrEngine: '',
        vlmModel: '',
        passes: ['full', 'left', 'center', 'right', 'text-ocr'],
      },
    },
    debugImages: {
      full: Buffer.from('debug').toString('base64'),
    },
  }));

  try {
    const result = await analyzeImageWithSidecar('fake-path.png');
    assert.equal(result.sceneGraph.objects[0]?.polygon, undefined);
    assert.equal(result.sceneGraph.objects[0]?.line, undefined);
    assert.deepEqual(result.sceneGraph.objects[1]?.line, [130, 40, 200, 42]);
    assert.equal(result.debugImages.full?.length, Buffer.from('debug').length);
  } finally {
    setImageAnalysisSidecarHookForTests(null);
  }
});
