export type PythonExecGeneratedFileKind = 'image' | 'text' | 'binary';
export type PythonExecSessionStatus = 'ready' | 'reset' | 'recovered' | 'fallback';

export interface PythonExecRequest {
  code: string;
  files?: string[];
  chatId?: string;
}

export interface PythonExecStagedFile {
  requestedPath: string;
  sandboxPath: string;
  sizeBytes: number;
}

export interface PythonExecGeneratedFile {
  path: string;
  sizeBytes: number;
  preview: string;
  truncated: boolean;
  kind?: PythonExecGeneratedFileKind;
  mediaType?: string;
  downloadUrl?: string;
}

export interface PythonExecResponse extends Record<string, unknown> {
  durationMs: number;
  exitCode: number;
  generatedFiles: PythonExecGeneratedFile[];
  stagedFiles: PythonExecStagedFile[];
  stderr: string;
  stderrTruncated: boolean;
  stdout: string;
  stdoutTruncated: boolean;
  chatId?: string;
  sessionStatus?: PythonExecSessionStatus;
}
