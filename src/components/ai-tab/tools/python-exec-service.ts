import type { PythonExecRequest, PythonExecResponse } from './python-exec-contract';
import { requestJson } from '../../../lib/api';

export async function executePython(params: PythonExecRequest & { signal?: AbortSignal }) {
  return requestJson<PythonExecResponse>('/python-exec', {
    method: 'POST',
    json: {
      code: params.code,
      ...(params.files?.length ? { files: params.files } : {}),
      ...(params.chatId ? { chatId: params.chatId } : {}),
    } satisfies PythonExecRequest,
    signal: params.signal,
  });
}
