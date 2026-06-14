export interface PythonExecRequest {
  code: string;
  files?: string[];
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
}
