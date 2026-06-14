import type { Request, Response } from 'express';
import { parsePythonExecRequest, runPythonExecRequest } from './python-exec-service';
import { HttpError } from './http';

export async function handlePythonExec(request: Request, response: Response) {
  try {
    response.status(200).json(await runPythonExecRequest(parsePythonExecRequest(request.body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Python execution failed.';
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    response.status(statusCode).json({ ok: false, error: message });
  }
}
