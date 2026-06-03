import { Chat } from './types';
import { ToolMessageCard } from './ToolMessageCard';

interface ActiveChatViewProps {
  activeChat: Chat;
  currentModel: string | null;
  isTyping: boolean;
}

export function ActiveChatView({ activeChat, currentModel, isTyping }: ActiveChatViewProps) {
  return (
    <div className="flex h-full w-full max-w-xl flex-col gap-6 py-6 pb-24 md:max-w-2xl">
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
        if (message.kind === 'tool-call' || message.kind === 'tool-result') {
          return <ToolMessageCard key={message.id} message={message} />;
        }

        const isUser = message.kind === 'user';
        return (
          <div key={message.id} className={`flex max-w-full flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium text-zinc-500">
              {isUser ? (
                <>
                  <span>john skibidi</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-600" />
                  <span>User</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <span className="text-[#e2875e]">*</span>
                    <span>{message.model ?? 'Ollama'}</span>
                  </span>
                  <span className="h-1 w-1 rounded-full bg-zinc-600" />
                  <span>Local model</span>
                </>
              )}
            </div>

            <div className={`rounded-2xl border p-4 text-left text-sm leading-relaxed shadow-sm ${
              isUser ? 'max-w-[85%] border-[#2f2f2b]/80 bg-[#21211f]/60 text-zinc-100' : 'max-w-full border-transparent bg-transparent text-zinc-200'
            }`}>
              <p className="whitespace-pre-line">{message.content}</p>
            </div>
          </div>
        );
      })}

      {isTyping && (
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
