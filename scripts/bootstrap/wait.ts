interface WaitForConditionOptions {
  timeoutMs: number;
  intervalMs: number;
}

export async function waitForCondition(
  check: () => Promise<boolean>,
  options: WaitForConditionOptions,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.timeoutMs) {
    try {
      if (await check()) {
        return true;
      }
    } catch {
      // Ignore transient readiness failures until the timeout window expires.
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  return false;
}
