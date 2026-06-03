import { ToolCallMessage, ToolResultMessage } from './types';

interface ToolMessageCardProps {
  message: ToolCallMessage | ToolResultMessage;
}

function formatArgs(args: Record<string, unknown>) {
  const entries = Object.entries(args);
  if (entries.length === 0) {
    return 'No arguments';
  }

  return entries.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' • ');
}

export function ToolMessageCard({ message }: ToolMessageCardProps) {
  if (message.kind === 'tool-call') {
    return (
      <div className="w-full rounded-2xl border border-[#2b3946] bg-[#16202a] p-4 text-left text-sm text-[#dce8f2]">
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-[#7da8c7]">
          <span>Tool Call</span>
          <span>{message.invocation.toolId}</span>
        </div>
        <p className="font-medium text-white">{message.invocation.functionName}</p>
        <p className="mt-2 text-xs leading-relaxed text-[#9ab4c8]">{formatArgs(message.invocation.args)}</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl border p-4 text-left text-sm ${
        message.result.ok ? 'border-[#234033] bg-[#11251b] text-[#dcf4e5]' : 'border-[#4a2525] bg-[#271515] text-[#ffd8d8]'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em]">
        <span>{message.result.ok ? 'Tool Result' : 'Tool Error'}</span>
        <span>{message.result.toolId}</span>
      </div>
      <p className="font-medium text-white">{message.result.functionName}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{message.result.summary}</p>
    </div>
  );
}
