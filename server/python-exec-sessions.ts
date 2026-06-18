import type { PythonExecBackend, PythonExecSession } from './python-exec-backend';
import { serverConfig } from './config';

export interface PythonExecSessionManagerOptions {
  backend: PythonExecBackend;
  idleMs?: number;
  now?: () => number;
}

interface SessionRecord {
  session: PythonExecSession;
  lastUsed: number;
  idleTimer?: NodeJS.Timeout;
}

export interface AcquireResult {
  session: PythonExecSession;
  recovered: boolean;
}

export class PythonExecSessionManager {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly backend: PythonExecBackend;
  private readonly idleMs: number;
  private readonly now: () => number;

  constructor(options: PythonExecSessionManagerOptions) {
    this.backend = options.backend;
    this.idleMs = options.idleMs ?? serverConfig.aiPythonExecSessionIdleMs;
    this.now = options.now ?? Date.now;
  }

  async acquire(chatId: string, workDir: string, inputsDir: string): Promise<AcquireResult> {
    const existing = this.sessions.get(chatId);
    if (existing) {
      existing.lastUsed = this.now();
      this.rescheduleIdle(chatId, existing);
      if (existing.session.alive) {
        return { session: existing.session, recovered: false };
      }
      await existing.session.kill().catch(() => undefined);
      this.sessions.delete(chatId);
    }
    const session = await this.backend.openSession(chatId, workDir, inputsDir);
    const record: SessionRecord = { session, lastUsed: this.now() };
    this.sessions.set(chatId, record);
    this.rescheduleIdle(chatId, record);
    return { session, recovered: existing !== undefined };
  }

  async reset(chatId: string): Promise<void> {
    const record = this.sessions.get(chatId);
    if (!record) {
      return;
    }
    await record.session.reset().catch(() => undefined);
  }

  async evict(chatId: string): Promise<void> {
    const record = this.sessions.get(chatId);
    if (!record) {
      return;
    }
    if (record.idleTimer) {
      clearTimeout(record.idleTimer);
    }
    this.sessions.delete(chatId);
    await record.session.kill().catch(() => undefined);
  }

  async evictAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.all(ids.map((id) => this.evict(id)));
  }

  has(chatId: string) {
    return this.sessions.has(chatId);
  }

  count() {
    return this.sessions.size;
  }

  private rescheduleIdle(chatId: string, record: SessionRecord) {
    if (record.idleTimer) {
      clearTimeout(record.idleTimer);
    }
    record.idleTimer = setTimeout(() => {
      void this.evict(chatId);
    }, this.idleMs);
  }
}

let defaultManager: PythonExecSessionManager | null = null;

export function getDefaultSessionManager(backend: PythonExecBackend): PythonExecSessionManager {
  if (!defaultManager) {
    defaultManager = new PythonExecSessionManager({ backend });
  }
  return defaultManager;
}

export function resetDefaultSessionManagerForTests(): void {
  defaultManager = null;
}