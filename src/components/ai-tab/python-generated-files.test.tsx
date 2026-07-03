import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { PythonGeneratedFiles } from './python-generated-files';
import type { PythonExecGeneratedFile } from './tools/python-exec-contract';
import { resetAppConfigForTests } from '../../lib/app-config';

function render(files: PythonExecGeneratedFile[]) {
  return renderToStaticMarkup(<PythonGeneratedFiles files={files} />);
}

test.afterEach(() => {
  resetAppConfigForTests();
});

test('renders a protected image placeholder for image generated files', () => {
  const html = render([
    { path: 'chart.png', sizeBytes: 10, preview: '', truncated: false, kind: 'image', mediaType: 'image/png', downloadUrl: '/api/ai/chats/c/python-exec/files/chart.png' },
  ]);
  assert.match(html, /Loading chart\.png/);
});

test('renders a table for csv generated files', () => {
  const html = render([
    { path: 'data.csv', sizeBytes: 14, preview: 'a,b\n1,2\n', truncated: false, kind: 'text', mediaType: 'text/csv', downloadUrl: '/api/ai/chats/c/python-exec/files/data.csv' },
  ]);
  assert.match(html, /<table/);
  assert.match(html, /<th[^>]*>a<\/th>/);
  assert.match(html, /<td[^>]*>2<\/td>/);
});

test('renders a download button for binary files without exposing the protected url', () => {
  const html = render([
    { path: 'report.pdf', sizeBytes: 99, preview: '', truncated: false, kind: 'binary', mediaType: 'application/pdf', downloadUrl: '/api/ai/chats/c/python-exec/files/report.pdf' },
  ]);
  assert.doesNotMatch(html, /\/api\/ai\/chats\/c\/python-exec\/files\/report\.pdf/);
  assert.match(html, /Download/);
});

test('renders an empty state when there are no files', () => {
  const html = render([]);
  assert.match(html, /No generated files/);
});
