import { AskUserCard } from './AskUserCard';
import { shouldHideToolCallStep } from './ask-user';
import { AskUserResponse, AssistantAskUserTraceStep, AssistantTraceStep } from './types';

interface AssistantTracePanelProps {
  activeAskUserStepId?: string | null;
  disabled?: boolean;
  onSubmitAskUser?: (step: AssistantAskUserTraceStep, response: AskUserResponse) => Promise<void> | void;
  steps: AssistantTraceStep[];
}

function formatThinkingSegments(content: string) {
  return content
    .split(/\n\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function formatArgs(args: Record<string, unknown>) {
  const entries = Object.entries(args);
  if (entries.length === 0) {
    return 'No arguments';
  }

  return entries.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' • ');
}

function ToolCallStep({ step }: { step: Extract<AssistantTraceStep, { kind: 'tool-call' }> }) {
  return (
    <div className="rounded-xl border border-[#2b3946] bg-[#16202a] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-[#7da8c7]">
        <span>Tool Call</span>
        <span>{step.invocation.toolId}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-white">{step.invocation.functionName}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[#9ab4c8]">{formatArgs(step.invocation.args)}</p>
    </div>
  );
}

function ToolResultStep({ step }: { step: Extract<AssistantTraceStep, { kind: 'tool-result' }> }) {
  const stateClassName = step.result.ok
    ? 'border-[#234033] bg-[#11251b] text-[#dcf4e5]'
    : 'border-[#4a2525] bg-[#271515] text-[#ffd8d8]';

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${stateClassName}`}>
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em]">
        <span>{step.result.ok ? 'Tool Result' : 'Tool Error'}</span>
        <span>{step.result.toolId}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-white">{step.result.functionName}</p>
      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed">{step.result.summary}</p>
    </div>
  );
}

function ThinkingStep({ step, index }: { step: Extract<AssistantTraceStep, { kind: 'thinking' }>; index: number }) {
  const segments = formatThinkingSegments(step.content);

  return (
    <div className="rounded-xl border border-[#35352f] bg-[#1a1a17] px-3 py-3">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-[#b0a68d]">
        <span>{index === 0 ? 'Task Map' : 'Progress Block'}</span>
        <span>Thinking</span>
      </div>
      <div className="mt-2 space-y-2">
        {(segments.length ? segments : [step.content.trim()]).map((segment, segmentIndex) => (
          <p key={`${step.id}-${segmentIndex}`} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
            {segment}
          </p>
        ))}
      </div>
    </div>
  );
}

export function AssistantTracePanel({ activeAskUserStepId = null, disabled = false, onSubmitAskUser, steps }: AssistantTracePanelProps) {
  let thinkingCount = 0;

  return (
    <div className="space-y-2.5 border-t border-[#2a2a27] px-4 py-3">
      {steps.map((step, index) => {
        if (step.kind === 'thinking') {
          const thinkingIndex = thinkingCount;
          thinkingCount += 1;
          return (
            <ThinkingStep key={step.id} step={step} index={thinkingIndex} />
          );
        }

        if (step.kind === 'ask-user') {
          if (step.placement !== 'inline_trace') {
            return null;
          }

          return (
            <AskUserCard
              key={step.id}
              disabled={disabled && step.id !== activeAskUserStepId}
              step={step}
              onSubmit={onSubmitAskUser ? (response) => onSubmitAskUser(step, response) : undefined}
            />
          );
        }

        if (step.kind === 'tool-call') {
          if (shouldHideToolCallStep(steps, index)) {
            return null;
          }
          return <ToolCallStep key={step.id} step={step} />;
        }

        return <ToolResultStep key={step.id} step={step} />;
      })}
    </div>
  );
}
