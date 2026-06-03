import { Coffee, GraduationCap, Lightbulb, PenTool, Terminal } from 'lucide-react';

const suggestionButtons = [
  { icon: Terminal, label: 'Code' },
  { icon: GraduationCap, label: 'Learn' },
  { icon: PenTool, label: 'Write' },
  { icon: Coffee, label: 'Life stuff' },
  { icon: Lightbulb, label: "Model's choice" },
];

export function PromptSuggestions({ onSelect }: { onSelect: (label: string) => void }) {
  return (
    <div className="flex max-w-lg flex-wrap items-center justify-center gap-2 text-xs md:max-w-xl">
      {suggestionButtons.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label)}
          className="flex items-center gap-1.5 rounded-xl border border-[#2c2c28] bg-[#20201e]/80 px-3 py-2 text-zinc-400 duration-150 hover:border-[#42423c] hover:bg-[#2c2c28]/95 hover:text-zinc-200"
        >
          <Icon size={13} className="text-[#e2875e]" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
