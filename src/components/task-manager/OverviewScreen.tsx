import { Home, Plus } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { ListView } from './ListView';
import { OverviewHeader } from './OverviewHeader';
import { TimelineView } from './TimelineView';
import { TaskFilter, TaskView } from './types';

interface OverviewScreenProps {
  activeFilter: TaskFilter;
  activeView: TaskView;
  boardColumns: Array<{ status: TaskStatus; tasks: Task[] }>;
  calendarCells: Array<Date | null>;
  calendarMonth: Date;
  filterCounts: Record<TaskFilter, number>;
  searchQuery: string;
  selectedDate: string;
  selectedDayTasks: Task[];
  timelineGroups: Record<string, Task[]>;
  todayOpenCount: number;
  visibleTasks: Task[];
  onCreateTask: () => void;
  onFilterChange: (filter: TaskFilter) => void;
  onMonthChange: (month: Date) => void;
  onMoveTaskStatus: (taskId: string, status: TaskStatus) => void;
  onNavigateHome: () => void;
  onOpenTask: (taskId: string) => void;
  onSearchChange: (query: string) => void;
  onSelectDate: (dateKey: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onViewChange: (view: TaskView) => void;
}

export function OverviewScreen(props: OverviewScreenProps) {
  return (
    <>
      <OverviewHeader
        activeFilter={props.activeFilter}
        activeView={props.activeView}
        filterCounts={props.filterCounts}
        searchQuery={props.searchQuery}
        todayOpenCount={props.todayOpenCount}
        onFilterChange={props.onFilterChange}
        onSearchChange={props.onSearchChange}
        onViewChange={props.onViewChange}
      />

      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-5">
        {props.activeView === 'list' && (
          <ListView tasks={props.visibleTasks} onOpenTask={props.onOpenTask} onToggleTaskComplete={props.onToggleTaskComplete} />
        )}
        {props.activeView === 'board' && (
          <BoardView columns={props.boardColumns} onOpenTask={props.onOpenTask} onMoveTaskStatus={props.onMoveTaskStatus} />
        )}
        {props.activeView === 'calendar' && (
          <CalendarView
            calendarCells={props.calendarCells}
            calendarMonth={props.calendarMonth}
            selectedDate={props.selectedDate}
            selectedDayTasks={props.selectedDayTasks}
            visibleTasks={props.visibleTasks}
            onMonthChange={props.onMonthChange}
            onOpenTask={props.onOpenTask}
            onSelectDate={props.onSelectDate}
            onToggleTaskComplete={props.onToggleTaskComplete}
          />
        )}
        {props.activeView === 'timeline' && <TimelineView groups={props.timelineGroups} onOpenTask={props.onOpenTask} />}
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="pointer-events-auto mx-auto flex max-w-[17rem] items-center justify-between rounded-full border border-white/10 bg-[#303040]/70 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button type="button" onClick={props.onNavigateHome} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] text-zinc-100">
            <Home size={20} />
          </button>
          <button
            type="button"
            onClick={props.onCreateTask}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7867ff] text-white shadow-lg shadow-indigo-950/50"
          >
            <Plus size={26} />
          </button>
          <div className="flex h-12 min-w-12 items-center justify-center rounded-full bg-white/[0.08] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
            {props.activeView}
          </div>
        </div>
      </div>
    </>
  );
}
