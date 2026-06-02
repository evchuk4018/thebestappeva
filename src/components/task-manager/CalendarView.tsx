import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '../../types';
import { formatDayLabel, formatMonthLabel, shiftMonth, toDateKey } from './utils';
import { TaskCard } from './TaskCard';

interface CalendarViewProps {
  calendarCells: Array<Date | null>;
  calendarMonth: Date;
  selectedDate: string;
  selectedDayTasks: Task[];
  visibleTasks: Task[];
  onMonthChange: (month: Date) => void;
  onOpenTask: (taskId: string) => void;
  onSelectDate: (dateKey: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
}

export function CalendarView({
  calendarCells,
  calendarMonth,
  selectedDate,
  selectedDayTasks,
  visibleTasks,
  onMonthChange,
  onOpenTask,
  onSelectDate,
  onToggleTaskComplete,
}: CalendarViewProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => onMonthChange(shiftMonth(calendarMonth, -1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-zinc-300">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">{formatMonthLabel(calendarMonth)}</p>
            <p className="text-xs text-zinc-500">Tap a day to inspect tasks</p>
          </div>
          <button type="button" onClick={() => onMonthChange(shiftMonth(calendarMonth, 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-zinc-300">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="mb-3 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="aspect-square rounded-2xl bg-transparent" />;
            }

            const cellKey = toDateKey(cell);
            const isSelected = cellKey === selectedDate;
            const taskCount = visibleTasks.filter((task) => toDateKey(task.dueAt) === cellKey).length;

            return (
              <button
                key={cellKey}
                type="button"
                onClick={() => onSelectDate(cellKey)}
                className={`aspect-square rounded-2xl border text-center transition ${
                  isSelected ? 'border-indigo-300/40 bg-[#7867ff] text-white' : 'border-white/6 bg-white/[0.03] text-zinc-300'
                }`}
              >
                <div className="flex h-full flex-col items-center justify-center">
                  <span className="text-sm font-semibold">{cell.getDate()}</span>
                  <span className={`mt-1 text-[10px] ${isSelected ? 'text-white/80' : 'text-zinc-500'}`}>{taskCount || ''}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white">{formatDayLabel(selectedDate)}</p>
          <p className="text-xs text-zinc-500">{selectedDayTasks.length} tasks scheduled</p>
        </div>
        <div className="space-y-3">
          {selectedDayTasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpenTask} onToggleComplete={onToggleTaskComplete} />
          ))}
          {selectedDayTasks.length === 0 && <p className="text-sm text-zinc-500">No tasks on this date.</p>}
        </div>
      </div>
    </section>
  );
}
