export class TurnAbortedError extends Error {
  constructor(message = 'This reply was stopped.') {
    super(message);
    this.name = 'TurnAbortedError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof TurnAbortedError ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof TurnAbortedError) {
    throw signal.reason;
  }

  if (signal.reason instanceof Error) {
    throw new TurnAbortedError(signal.reason.message);
  }

  throw new TurnAbortedError(typeof signal.reason === 'string' ? signal.reason : undefined);
}
