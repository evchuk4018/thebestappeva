import { Bell, Search } from 'lucide-react';
import { filterOptions, viewOptions } from './data';
import { formatHeroDate } from './utils';
import { TaskFilter, TaskView } from './types';

interface OverviewHeaderProps {
  activeFilter: TaskFilter;
  activeView: TaskView;
  filterCounts: Record<TaskFilter, number>;
  searchQuery: string;
  todayOpenCount: number;
  onFilterChange: (filter: TaskFilter) => void;
  onSearchChange: (query: string) => void;
  onViewChange: (view: TaskView) => void;
}

export function OverviewHeader({
  activeFilter,
  activeView,
  filterCounts,
  searchQuery,
  todayOpenCount,
  onFilterChange,
  onSearchChange,
  onViewChange,
}: OverviewHeaderProps) {
  return (
    <header className="px-4 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">BH</div>
          <div>
            <p className="text-xs text-zinc-400">Good morning</p>
            <p className="text-base font-semibold text-white">Benjamin Harris</p>
          </div>
        </div>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-300">
          <Bell size={18} />
        </button>
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <h1 className="max-w-[12ch] text-[2.15rem] font-semibold leading-[1.05] text-white">You&apos;ve got {todayOpenCount} tasks to crush today</h1>
          <span className="pb-2 text-sm text-zinc-400">{formatHeroDate()}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {viewOptions.map((option) => {
          const Icon = option.icon;
          const isActive = activeView === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onViewChange(option.id)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-full px-2 py-2 text-[11px] font-semibold transition ${
                isActive ? 'bg-[#7867ff] text-white shadow-lg shadow-indigo-950/40' : 'text-zinc-400'
              }`}
            >
              <Icon size={16} />
              <span className="mt-1">{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
        <Search size={18} className="text-zinc-500" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search tasks, tags, categories"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {filterOptions.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                isActive ? 'bg-[#7867ff] text-white' : 'bg-white/[0.06] text-zinc-400'
              }`}
            >
              {filter} <span className="text-xs opacity-80">{filterCounts[filter]}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
