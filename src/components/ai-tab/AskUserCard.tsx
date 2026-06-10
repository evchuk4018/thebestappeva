import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getHighlightedChoiceForKey, normalizeHighlightedChoice } from './ask-user-card-state';
import { AskUserResponse, AssistantAskUserTraceStep } from './types';

interface AskUserCardProps {
  disabled: boolean;
  step: AssistantAskUserTraceStep;
  onSubmit?: (response: AskUserResponse) => Promise<void> | void;
}

function formatResolvedResponse(step: AssistantAskUserTraceStep) {
  const response = step.response;
  if (!response) {
    return '';
  }

  if (response.kind === 'choice') {
    return response.label;
  }

  if (response.kind === 'open-ended') {
    return response.text;
  }

  return response.reason?.trim() ? `Skipped: ${response.reason.trim()}` : 'Skipped';
}

export function AskUserCard({ disabled, step, onSubmit }: AskUserCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlightedChoice, setHighlightedChoice] = useState<number | null>(() => normalizeHighlightedChoice(step.choices.length, 0));
  const [customAnswer, setCustomAnswer] = useState('');
  const isPending = step.status === 'pending' && Boolean(onSubmit);
  const resolvedText = formatResolvedResponse(step);

  useEffect(() => {
    if (isPending) {
      containerRef.current?.focus();
    }
  }, [isPending]);

  async function submitResponse(response: AskUserResponse) {
    if (!isPending || disabled) {
      return;
    }

    await onSubmit?.(response);
  }

  async function submitHighlightedChoice() {
    if (!isPending || highlightedChoice == null) {
      return;
    }

    const choice = step.choices[highlightedChoice];
    if (!choice) {
      return;
    }

    await submitResponse({
      kind: 'choice',
      choiceId: choice.id,
      label: choice.label,
      description: choice.description,
    });
  }

  async function submitCustomAnswer() {
    const text = customAnswer.trim();
    if (!text) {
      return;
    }

    await submitResponse({ kind: 'open-ended', text });
  }

  return (
    <div
      ref={containerRef}
      tabIndex={isPending ? 0 : -1}
      onKeyDown={(event) => {
        if (!isPending || disabled) {
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          void submitResponse({ kind: 'skip' });
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          void (customAnswer.trim() ? submitCustomAnswer() : submitHighlightedChoice());
          return;
        }

        const nextHighlight = getHighlightedChoiceForKey(step.choices.length, highlightedChoice, event.key);
        if (nextHighlight !== highlightedChoice) {
          event.preventDefault();
          setHighlightedChoice(nextHighlight);
        }
      }}
      className="rounded-2xl border border-[#3f3727] bg-[#1f1a14] px-4 py-4 text-left shadow-sm outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#d6b17a]">
            {step.status === 'pending' ? 'User Follow-Up' : 'Recorded Answer'}
          </div>
          <p className="mt-2 text-sm font-medium text-[#f5ede2]">{step.question}</p>
        </div>
        {isPending && !step.required && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submitResponse({ kind: 'skip' })}
            className="rounded-lg border border-[#4b3f2c] p-1.5 text-[#c6a77e] hover:bg-[#2a231a] disabled:cursor-not-allowed disabled:text-zinc-600"
            aria-label="Close follow-up"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {step.choices.map((choice, index) => {
          const isHighlighted = highlightedChoice === index;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={!isPending || disabled}
              onClick={() =>
                void submitResponse({
                  kind: 'choice',
                  choiceId: choice.id,
                  label: choice.label,
                  description: choice.description,
                })
              }
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                isHighlighted ? 'border-[#e2875e] bg-[#2a2019]' : 'border-[#3b3226] bg-[#191510]'
              } disabled:cursor-default disabled:opacity-80`}
            >
              <span className="mt-0.5 rounded-md border border-[#5a4a33] px-1.5 py-0.5 font-mono text-[10px] text-[#d8b88a]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#f2e6d5]">{choice.label}</span>
                {choice.description && <span className="mt-1 block text-xs leading-relaxed text-[#bca992]">{choice.description}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {step.allowOpenEnded && (
        <div className="mt-3 rounded-xl border border-[#3b3226] bg-[#191510] px-3 py-3">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#bca992]">Something else</div>
          {isPending ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={customAnswer}
                disabled={disabled}
                onChange={(event) => setCustomAnswer(event.target.value)}
                onFocus={() => setHighlightedChoice(null)}
                placeholder={step.openEndedPlaceholder ?? 'Type your answer'}
                className="min-w-0 flex-1 border-none bg-transparent text-sm text-[#f5ede2] outline-none placeholder:text-[#7f7265] disabled:text-zinc-600"
              />
              <button
                type="button"
                disabled={disabled || !customAnswer.trim()}
                onClick={() => void submitCustomAnswer()}
                className="rounded-lg border border-[#4b3f2c] px-2.5 py-1 text-xs text-[#d0b186] hover:bg-[#2a231a] disabled:cursor-not-allowed disabled:text-zinc-600"
              >
                Send
              </button>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#f5ede2]">
              {step.response?.kind === 'open-ended' ? step.response.text : 'Not used'}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#a99986]">
        {isPending ? (
          <>
            <span>Keys: `1-6` pick, arrows move, `Enter` submit, `Esc` skip.</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void submitResponse({ kind: 'skip' })}
              className="rounded-lg border border-[#4b3f2c] px-2.5 py-1 text-[#d0b186] hover:bg-[#2a231a] disabled:cursor-not-allowed disabled:text-zinc-600"
            >
              Skip
            </button>
          </>
        ) : (
          <span>{resolvedText}</span>
        )}
      </div>
    </div>
  );
}
