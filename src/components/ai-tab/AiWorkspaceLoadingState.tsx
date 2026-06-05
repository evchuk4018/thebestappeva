export function AiWorkspaceLoadingState() {
  return (
    <div className="flex min-h-[320px] w-full max-w-xl items-center justify-center rounded-[28px] border border-[#2b2b27] bg-[#1d1d1a] px-6 text-center md:max-w-2xl">
      <div>
        <p className="text-sm font-medium text-[#efeae4]">Loading local AI workspace</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          The app is reading chats and AI preferences from the local database before rendering the conversation view.
        </p>
      </div>
    </div>
  );
}
