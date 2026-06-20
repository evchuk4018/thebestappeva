import { useEffect } from 'react';
import { claimDueAutomations, reportAutomationRun } from './automations/automations-api';
import { useAiController } from './AiControllerContext';

async function runDueAutomations(controller: ReturnType<typeof useAiController>) {
  if (controller.hydrationStatus !== 'ready' || controller.automationsControls.loading || controller.isBusy) return;
  const claimed = await claimDueAutomations();
  for (const run of claimed.runs) {
    const result = await controller.runScheduledAutomation(run.automation, run.claimedRunAt);
    const updated = await reportAutomationRun(run.automation.id, {
      status: result.status,
      summary: result.summary,
      error: result.error,
      chatId: result.chatId,
    });
    controller.automationsControls.updateRunState(updated);
  }
}

export function AiAutomationRuntime() {
  const controller = useAiController();

  useEffect(() => {
    const tick = () => { void runDueAutomations(controller); };
    tick();
    const intervalId = window.setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [controller]);

  return null;
}
