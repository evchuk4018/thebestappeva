import { AssistantMessageCard } from './AssistantMessageCard';
import { Chat } from './types';
import { UserMessageCard } from './UserMessageCard';

interface ActiveChatViewProps {
  activeChat: Chat;
  currentModel: string | null;
  liveAssistantMessageId: string | null;
  showTypingIndicator: boolean;
  onCopyAssistantMessage: (messageId: string) => Promise<void> | void;
  onRegenerateAssistantMessage: (messageId: string) => Promise<void> | void;
  onCopyUserMessage: (messageId: string) => Promise<void> | void;
  onEditUserMessage: (messageId: string, nextContent: string) => Promise<void> | void;
  onSwitchUserMessageVersion: (messageId: string, direction: 'previous' | 'next') => void;
}

export function ActiveChatView({
  activeChat,
  currentModel,
  liveAssistantMessageId,
  showTypingIndicator,
  onCopyAssistantMessage,
  onRegenerateAssistantMessage,
  onCopyUserMessage,
  onEditUserMessage,
  onSwitchUserMessageVersion,
}: ActiveChatViewProps) {
  return (
    <div className="flex w-full max-w-xl flex-col gap-6 py-6 pb-24 md:max-w-2xl">
      <div className="flex items-center justify-between border-b border-[#2d2d2a]/50 pb-4">
        <div className="flex flex-col text-left">
          <span className="text-xs font-mono text-zinc-500">Conversation Thread</span>
          <h2 className="max-w-[340px] truncate font-serif text-base font-semibold leading-tight text-[#efeae4] md:max-w-[500px] md:text-lg">
            {activeChat.title}
          </h2>
        </div>
        <span className="rounded border border-zinc-800 bg-[#272724] px-2.5 py-1 font-mono text-[10px] text-zinc-400">
          {currentModel ?? 'No model'}
        </span>
      </div>

      {activeChat.messages.map((message) => {
        if (message.kind !== 'user') {
          return (
            <AssistantMessageCard
              key={message.id}
              disabled={Boolean(liveAssistantMessageId)}
              isStreaming={message.id === liveAssistantMessageId}
              message={message}
              onCopy={onCopyAssistantMessage}
              onRegenerate={onRegenerateAssistantMessage}
            />
          );
        }

        return (
          <UserMessageCard
            key={message.id}
            disabled={Boolean(liveAssistantMessageId)}
            message={message}
            onCopy={onCopyUserMessage}
            onEdit={onEditUserMessage}
            onSwitchVersion={onSwitchUserMessageVersion}
          />
        );
      })}

      {showTypingIndicator && (
        <div className="flex flex-col items-start">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium text-zinc-500">
            <span className="text-[#e2875e]">*</span>
            <span>{currentModel ? `${currentModel} is generating...` : 'Local model is generating...'}</span>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-transparent px-4 py-2">
            {[0, 0.15, 0.3].map((delay) => (
              <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#e2875e]" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
