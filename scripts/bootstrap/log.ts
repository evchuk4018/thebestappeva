export interface BootstrapLogger {
  step(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createLogger(scope: string): BootstrapLogger {
  const prefix = `[${scope}]`;

  return {
    step(message) {
      console.log(`${prefix} ${message}`);
    },
    warn(message) {
      console.warn(`${prefix} Warning: ${message}`);
    },
    error(message) {
      console.error(`${prefix} ${message}`);
    },
  };
}
