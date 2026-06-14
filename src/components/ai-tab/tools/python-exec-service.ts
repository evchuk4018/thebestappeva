import type { PythonExecRequest, PythonExecResponse } from './python-exec-contract';

async function readApiResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } & Partial<PythonExecResponse> | null;
  if (!response.ok) {
    throw new Error(payload?.error?.trim() || `Local request failed with ${response.status}.`);
  }
  if (!payload) {
    throw new Error('The local server returned an empty response.');
  }
  return payload as PythonExecResponse;
}

export async function executePython(params: PythonExecRequest & { signal?: AbortSignal }) {
  const response = await fetch(new URL('/api/python-exec', window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: params.code,
      ...(params.files?.length ? { files: params.files } : {}),
    } satisfies PythonExecRequest),
    signal: params.signal,
  });

  return readApiResponse(response);
}
