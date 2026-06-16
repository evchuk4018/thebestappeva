import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import sharp from 'sharp';
import { serverConfig } from '../config';
import { compareGeneratedImage } from './image-compare-service';
import { setImageAnalysisTestHooksForTests } from './image-analysis-service';
import { saveAttachmentRecord, saveAttachmentSource } from './storage';

function runSidecarHealth() {
  return new Promise<boolean>((resolve) => {
    const child = spawn(serverConfig.aiImageAnalysisPythonCommand, [
      ...serverConfig.aiImageAnalysisPythonArgs,
      path.resolve(process.cwd(), 'python', 'image_analysis_sidecar.py'),
      '--health',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    const stdout: string[] = [];
    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.once('close', () => {
      try {
        const payload = JSON.parse(stdout.join('')) as { available?: boolean };
        resolve(Boolean(payload.available));
      } catch {
        resolve(false);
      }
    });
  });
}

test('image-analysis sidecar extracts OCR separately and compare flags a broken SVG', async (t) => {
  if (!(await runSidecarHealth())) {
    t.skip('Image-analysis sidecar dependencies are not installed locally.');
    return;
  }

  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-smoke-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  setImageAnalysisTestHooksForTests({
    queryJson: async () => ({ model: 'geometry-only', value: [] }),
  });

  try {
    const sourceSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="160">
        <rect width="240" height="160" fill="#ffffff"/>
        <rect x="20" y="30" width="80" height="70" fill="#d71920" stroke="#000000" />
        <rect x="130" y="40" width="70" height="60" fill="#1f77b4" stroke="#000000" />
        <text x="42" y="72" font-size="26" fill="#000000">R1</text>
      </svg>
    `;
    const sourceBuffer = await sharp(Buffer.from(sourceSvg, 'utf8')).png().toBuffer();
    await saveAttachmentSource('image_smoke123', '.png', sourceBuffer);
    await saveAttachmentRecord({
      attachment: {
        id: 'image_smoke123',
        kind: 'image',
        createdAt: '2026-06-15T00:00:00.000Z',
        fileName: 'smoke.png',
        mediaType: 'image/png',
        fileSize: sourceBuffer.length,
        width: 240,
        height: 160,
        summary: 'Synthetic smoke-test image.',
        summaryModel: 'local-test',
        summaryStatus: 'ready',
        analysisStatus: 'idle',
      },
      sourceExtension: '.png',
    });

    const comparison = await compareGeneratedImage({
      attachmentId: 'image_smoke123',
      format: 'svg',
      content: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#ffffff"/></svg>',
      refresh: true,
    });

    assert.ok(comparison.comparison.source.text.some((item) => item.value.toUpperCase().includes('R1')));
    assert.ok(comparison.comparison.source.objects.length >= 2);
    assert.ok(comparison.comparison.issues.some((issue) => issue.kind === 'missing-object' || issue.kind === 'text-mismatch'));
  } finally {
    setImageAnalysisTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
