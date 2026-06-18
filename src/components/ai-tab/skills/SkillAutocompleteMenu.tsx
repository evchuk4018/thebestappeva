import { motion, AnimatePresence } from 'motion/react';
import type { SkillSummary } from '../../../../shared/skills-contract';

interface SkillAutocompleteMenuProps {
  isOpen: boolean;
  suggestions: SkillSummary[];
  highlighted: number | null;
  onSelect: (skill: SkillSummary) => void;
}

export function SkillAutocompleteMenu({ isOpen, suggestions, highlighted, onSelect }: SkillAutocompleteMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden rounded-xl border border-[#2f2f2b] bg-[#151513] shadow-2xl"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Skills</div>
          {suggestions.map((skill, index) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => onSelect(skill)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition ${
                index === highlighted ? 'bg-[#1f262f] text-[#efeae4]' : 'text-zinc-300 hover:bg-[#1a1a18]'
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-[#d9e7f3]">/{skill.name}</div>
                <div className="truncate text-[11px] text-zinc-500">{skill.description}</div>
              </div>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}