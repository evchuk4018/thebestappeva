import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Grid2x2,
  Home,
  LayoutList,
  ListFilter,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../types';

type TaskView = 'list' | 'board' | 'calendar' | 'timeline';
type TaskFilter = 'all' | 'today' | 'upcoming' | 'completed';
type Screen = 'overview' | 'detail' | 'editor';

interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  dueAtLocal: string;
  category: string;
  tagsInput: string;
  subtaskTitles: string[];
}

const viewOptions: Array<{ id: TaskView; label: string; icon: typeof LayoutList }> = [
  { id: 'list', label: 'List', icon: LayoutList },
  { id: 'board', label: 'Board', icon: Grid2x2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline', icon: Clock3 },
];

const filterOptions: TaskFilter[] = ['all', 'today', 'upcoming', 'completed'];
const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'done'];

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-violet-500/20 text-violet-200 border-violet-400/20',
  medium: 'bg-amber-500/20 text-amber-100 border-amber-400/20',
  high: 'bg-indigo-500/30 text-indigo-100 border-indigo-400/20',
};

const statusStyles: Record<TaskStatus, string> = {
  todo: 'bg-white/8 text-zinc-300 border-white/10',
  in_progress: 'bg-sky-500/20 text-sky-100 border-sky-400/20',
  done: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/20',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

function pad(value: number) {
  return `${value}`.padStart(2, '0');
}

function toDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dateAt(hoursFromNow: number) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

function dateOnRelativeDay(days: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function dateAfterDays(days: number, hours = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDayLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatHeroDate() {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(new Date());
}

function toDateTimeLocalInputValue(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeTags(tagsInput: string) {
  return tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildDraft(task?: Task): TaskDraft {
  if (!task) {
    return {
      title: '',
      description: '',
      priority: 'medium',
      dueAtLocal: toDateTimeLocalInputValue(dateAt(2)),
      category: 'Personal',
      tagsInput: '',
      subtaskTitles: [''],
    };
  }

  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueAtLocal: toDateTimeLocalInputValue(task.dueAt),
    category: task.category,
    tagsInput: task.tags.join(', '),
    subtaskTitles: task.subtasks.length ? task.subtasks.map((subtask) => subtask.title) : [''],
  };
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') {
      return 1;
    }

    if (a.status !== 'done' && b.status === 'done') {
      return -1;
    }

    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

function createInitialTasks(): Task[] {
  return [
    {
      id: 'task-1',
      title: 'Meeting with Liam',
      description: 'Design the mobile task-management shell and lock the interaction polish before wiring extra views.',
      status: 'todo',
      priority: 'low',
      tags: ['Design', 'Work'],
      dueAt: dateOnRelativeDay(0, 16),
      category: 'Work',
      subtasks: [
        { id: 'task-1-sub-1', title: 'Review home button placement', completed: true },
        { id: 'task-1-sub-2', title: 'Validate screen spacing', completed: false },
      ],
    },
    {
      id: 'task-2',
      title: 'Write script for YouTube sponsorship',
      description: 'Outline the intro, key talking points, benefits, and CTA. Keep it natural and under 90 seconds.',
      status: 'in_progress',
      priority: 'high',
      tags: ['Work', 'Content'],
      dueAt: dateOnRelativeDay(0, 19),
      category: 'Content',
      subtasks: [
        { id: 'task-2-sub-1', title: 'Hook and intro line', completed: true },
        { id: 'task-2-sub-2', title: 'Sponsor mention and 3 benefits', completed: false },
        { id: 'task-2-sub-3', title: 'Call-to-action with link', completed: false },
        { id: 'task-2-sub-4', title: 'Read out loud for flow check', completed: false },
      ],
    },
    {
      id: 'task-3',
      title: 'Plan weekend date ideas',
      description: 'Shortlist low-effort dinner and activity options that can fit around Saturday lifting.',
      status: 'todo',
      priority: 'high',
      tags: ['Personal'],
      dueAt: dateOnRelativeDay(0, 21),
      category: 'Personal',
      subtasks: [
        { id: 'task-3-sub-1', title: 'Pick dinner spot', completed: false },
        { id: 'task-3-sub-2', title: 'Book one activity', completed: false },
      ],
    },
    {
      id: 'task-4',
      title: 'Refine sprint board cleanup',
      description: 'Move stale tickets, archive done items, and tag blockers before Monday planning.',
      status: 'todo',
      priority: 'medium',
      tags: ['Ops', 'Work'],
      dueAt: dateAfterDays(1, 11),
      category: 'Operations',
      subtasks: [
        { id: 'task-4-sub-1', title: 'Archive closed bugs', completed: false },
        { id: 'task-4-sub-2', title: 'Tag blocked tasks', completed: false },
      ],
    },
    {
      id: 'task-5',
      title: 'Submit gym membership receipt',
      description: 'Upload the receipt to the reimbursement portal and confirm finance received it.',
      status: 'done',
      priority: 'medium',
      tags: ['Admin'],
      dueAt: dateAfterDays(-1, 16),
      category: 'Admin',
      subtasks: [
        { id: 'task-5-sub-1', title: 'Upload PDF', completed: true },
        { id: 'task-5-sub-2', title: 'Email finance', completed: true },
      ],
    },
    {
      id: 'task-6',
      title: 'Prep June content calendar',
      description: 'Map uploads across the month and pin the next three production deadlines.',
      status: 'in_progress',
      priority: 'medium',
      tags: ['Content', 'Planning'],
      dueAt: dateAfterDays(3, 14),
      category: 'Planning',
      subtasks: [
        { id: 'task-6-sub-1', title: 'Set weekly themes', completed: true },
        { id: 'task-6-sub-2', title: 'Assign recording days', completed: false },
      ],
    },
  ];
}

function FieldLabel({ children }: { children: string }) {
  return <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{children}</label>;
}

export default function TaskManager() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(createInitialTasks);
  const [activeView, setActiveView] = useState<TaskView>('list');
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('today');
  const [screen, setScreen] = useState<Screen>('overview');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('task-2');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [draft, setDraft] = useState<TaskDraft>(buildDraft());
  const [formError, setFormError] = useState('');

  const todayKey = toDateKey(new Date());

  const filterCounts = useMemo(() => {
    const counts: Record<TaskFilter, number> = {
      all: tasks.length,
      today: tasks.filter((task) => toDateKey(task.dueAt) === todayKey).length,
      upcoming: tasks.filter((task) => new Date(task.dueAt).getTime() > new Date().getTime() && task.status !== 'done').length,
      completed: tasks.filter((task) => task.status === 'done').length,
    };

    return counts;
  }, [tasks, todayKey]);

  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sortTasks(
      tasks.filter((task) => {
        const dateKey = toDateKey(task.dueAt);
        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'today' && dateKey === todayKey) ||
          (activeFilter === 'upcoming' && new Date(task.dueAt).getTime() > new Date().getTime() && task.status !== 'done') ||
          (activeFilter === 'completed' && task.status === 'done');

        const searchable = `${task.title} ${task.description} ${task.category} ${task.tags.join(' ')}`.toLowerCase();
        const matchesQuery = !query || searchable.includes(query);

        return matchesFilter && matchesQuery;
      }),
    );
  }, [activeFilter, searchQuery, tasks, todayKey]);

  const todayOpenCount = tasks.filter((task) => toDateKey(task.dueAt) === todayKey && task.status !== 'done').length;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const boardColumns = statusOrder.map((status) => ({
    status,
    tasks: visibleTasks.filter((task) => task.status === status),
  }));

  const selectedDayTasks = sortTasks(visibleTasks.filter((task) => toDateKey(task.dueAt) === selectedDate));

  const timelineGroups = useMemo(() => {
    return sortTasks(visibleTasks).reduce<Record<string, Task[]>>((groups, task) => {
      const key = toDateKey(task.dueAt);
      groups[key] = [...(groups[key] ?? []), task];
      return groups;
    }, {});
  }, [visibleTasks]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const startWeekday = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const cells: Array<Date | null> = [];

    for (let index = 0; index < startWeekday; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [calendarMonth]);

  const openDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setScreen('detail');
  };

  const openCreateEditor = () => {
    setEditingTaskId(null);
    setDraft(buildDraft());
    setFormError('');
    setScreen('editor');
  };

  const openEditEditor = (task: Task) => {
    setEditingTaskId(task.id);
    setDraft(buildDraft(task));
    setFormError('');
    setScreen('editor');
  };

  const toggleTaskComplete = (taskId: string) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const completing = task.status !== 'done';
        return {
          ...task,
          status: completing ? 'done' : 'todo',
          subtasks: task.subtasks.map((subtask) => ({
            ...subtask,
            completed: completing ? true : subtask.completed,
          })),
        };
      }),
    );
  };

  const toggleSubtaskComplete = (taskId: string, subtaskId: string) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const subtasks = task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
        );
        const allCompleted = subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);
        const someCompleted = subtasks.some((subtask) => subtask.completed);

        return {
          ...task,
          subtasks,
          status: allCompleted ? 'done' : someCompleted ? 'in_progress' : 'todo',
        };
      }),
    );
  };

  const moveTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        return {
          ...task,
          status,
          subtasks:
            status === 'done'
              ? task.subtasks.map((subtask) => ({ ...subtask, completed: true }))
              : task.subtasks,
        };
      }),
    );
  };

  const updateTask = (taskId: string, nextTask: Task) => {
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === taskId ? nextTask : task)));
  };

  const deleteTask = (taskId: string) => {
    let nextSelectedTaskId = '';
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.filter((task) => task.id !== taskId);
      nextSelectedTaskId = nextTasks[0]?.id ?? '';
      return nextTasks;
    });
    setSelectedTaskId(nextSelectedTaskId);
    setScreen('overview');
  };

  const createTask = (task: Task) => {
    setTasks((currentTasks) => [task, ...currentTasks]);
    setSelectedTaskId(task.id);
    setSelectedDate(toDateKey(task.dueAt));
    setCalendarMonth(startOfMonth(new Date(task.dueAt)));
    setScreen('detail');
  };

  const saveDraft = () => {
    if (!draft.title.trim()) {
      setFormError('Title is required.');
      return;
    }

    if (!draft.dueAtLocal.trim() || Number.isNaN(new Date(draft.dueAtLocal).getTime())) {
      setFormError('Choose a valid due date and time.');
      return;
    }

    const subtasks = draft.subtaskTitles
      .map((title, index) => ({
        id: editingTaskId ? `${editingTaskId}-sub-${index}` : `task-${Date.now()}-sub-${index}`,
        title: title.trim(),
        completed: false,
      }))
      .filter((subtask) => subtask.title);

    const nextTask: Task = {
      id: editingTaskId ?? `task-${Date.now()}`,
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      status: editingTaskId ? tasks.find((task) => task.id === editingTaskId)?.status ?? 'todo' : 'todo',
      tags: normalizeTags(draft.tagsInput),
      dueAt: new Date(draft.dueAtLocal).toISOString(),
      category: draft.category.trim() || 'General',
      subtasks,
    };

    if (editingTaskId) {
      const previousTask = tasks.find((task) => task.id === editingTaskId);
      if (previousTask) {
        updateTask(editingTaskId, {
          ...nextTask,
          subtasks: subtasks.map((subtask, index) => ({
            ...subtask,
            completed: previousTask.subtasks[index]?.completed ?? false,
          })),
        });
        setSelectedTaskId(editingTaskId);
        setSelectedDate(toDateKey(nextTask.dueAt));
        setCalendarMonth(startOfMonth(new Date(nextTask.dueAt)));
        setScreen('detail');
      }
    } else {
      createTask(nextTask);
    }

    setFormError('');
  };

  const renderTaskCard = (task: Task) => {
    const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

    return (
      <div
        key={task.id}
        className="w-full rounded-[28px] border border-white/8 bg-white/[0.06] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition hover:border-white/15"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>
            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
          </div>
          <button
            type="button"
            aria-label={task.status === 'done' ? 'Mark task incomplete' : 'Mark task complete'}
            onClick={(event) => {
              event.stopPropagation();
              toggleTaskComplete(task.id);
            }}
            className="text-zinc-200"
          >
            {task.status === 'done' ? <CheckCircle2 size={22} className="text-white" /> : <Circle size={22} className="text-zinc-500" />}
          </button>
        </div>
        <button type="button" onClick={() => openDetail(task.id)} className="w-full text-left">
          <div className="space-y-2">
            <h3 className="text-[22px] font-semibold leading-[1.15] text-white">{task.title}</h3>
            <p className="line-clamp-2 text-sm leading-6 text-zinc-400">{task.description}</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span>{formatDateTime(task.dueAt)}</span>
            <span>{task.category}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {task.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                  {tag}
                </span>
              ))}
            </div>
            <span className="text-[11px] font-medium text-zinc-400">
              {completedSubtasks}/{task.subtasks.length || 0} subtasks
            </span>
          </div>
        </button>
      </div>
    );
  };

  const renderOverview = () => (
    <>
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
            <h1 className="max-w-[12ch] text-[2.15rem] font-semibold leading-[1.05] text-white">
              You&apos;ve got {todayOpenCount} tasks to crush today
            </h1>
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
                onClick={() => setActiveView(option.id)}
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
            onChange={(event) => setSearchQuery(event.target.value)}
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
                onClick={() => setActiveFilter(filter)}
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

      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-5">
        {activeView === 'list' && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ListFilter size={15} className="text-zinc-400" />
                <span>To do tasks</span>
              </div>
              <span className="text-sm font-medium text-indigo-200">See all</span>
            </div>
            <div className="space-y-4">
              {visibleTasks.map((task) => renderTaskCard(task))}
              {visibleTasks.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.04] px-5 py-12 text-center text-sm text-zinc-400">
                  No tasks match the current filter.
                </div>
              )}
            </div>
          </section>
        )}

        {activeView === 'board' && (
          <section className="flex gap-3 overflow-x-auto pb-2">
            {boardColumns.map((column) => (
              <div key={column.status} className="w-[18.5rem] shrink-0 rounded-[28px] border border-white/10 bg-white/[0.05] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[column.status]}`}>
                    {statusLabels[column.status]}
                  </span>
                  <span className="text-xs text-zinc-500">{column.tasks.length}</span>
                </div>
                <div className="space-y-3">
                  {column.tasks.map((task) => {
                    const statusIndex = statusOrder.indexOf(task.status);
                    const previousStatus = statusOrder[statusIndex - 1];
                    const nextStatus = statusOrder[statusIndex + 1];

                    return (
                      <div
                        key={task.id}
                        className="rounded-[24px] border border-white/8 bg-[#17171d] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      >
                        <button type="button" onClick={() => openDetail(task.id)} className="w-full text-left">
                          <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>
                            {task.priority}
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-white">{task.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{task.description}</p>
                        </button>
                        <div className="mt-4 flex gap-2">
                          {previousStatus && (
                            <button
                              type="button"
                              onClick={() => moveTaskStatus(task.id, previousStatus)}
                              className="flex-1 rounded-full bg-white/7 px-3 py-2 text-xs font-medium text-zinc-300"
                            >
                              {statusLabels[previousStatus]}
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() => moveTaskStatus(task.id, nextStatus)}
                              className="flex-1 rounded-full bg-[#7867ff] px-3 py-2 text-xs font-semibold text-white"
                            >
                              {statusLabels[nextStatus]}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {column.tasks.length === 0 && (
                    <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                      No tasks here.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {activeView === 'calendar' && (
          <section className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((currentMonth) => shiftMonth(currentMonth, -1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-zinc-300"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">{formatMonthLabel(calendarMonth)}</p>
                  <p className="text-xs text-zinc-500">Tap a day to inspect tasks</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((currentMonth) => shiftMonth(currentMonth, 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-zinc-300"
                >
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
                      onClick={() => setSelectedDate(cellKey)}
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
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{formatDayLabel(selectedDate)}</p>
                  <p className="text-xs text-zinc-500">{selectedDayTasks.length} tasks scheduled</p>
                </div>
              </div>
              <div className="space-y-3">
                {selectedDayTasks.map((task) => renderTaskCard(task))}
                {selectedDayTasks.length === 0 && <p className="text-sm text-zinc-500">No tasks on this date.</p>}
              </div>
            </div>
          </section>
        )}

        {activeView === 'timeline' && (
          <section className="space-y-5">
            {Object.entries(timelineGroups).map(([dateKey, groupedTasks]) => (
              <div key={dateKey}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/8" />
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{formatDayLabel(dateKey)}</span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>
                <div className="space-y-3">
                  {groupedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openDetail(task.id)}
                      className="flex w-full gap-3 rounded-[28px] border border-white/8 bg-white/[0.05] p-4 text-left"
                    >
                      <div className="min-w-16 text-center">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Due</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt))}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>
                          {task.priority}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-white">{task.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400">{task.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(timelineGroups).length === 0 && (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center text-sm text-zinc-500">
                Nothing to show in the timeline.
              </div>
            )}
          </section>
        )}
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="pointer-events-auto mx-auto flex max-w-[17rem] items-center justify-between rounded-full border border-white/10 bg-[#303040]/70 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] text-zinc-100"
          >
            <Home size={20} />
          </button>
          <button
            type="button"
            onClick={openCreateEditor}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7867ff] text-white shadow-lg shadow-indigo-950/50"
          >
            <Plus size={26} />
          </button>
          <div className="flex h-12 min-w-12 items-center justify-center rounded-full bg-white/[0.08] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
            {activeView}
          </div>
        </div>
      </div>
    </>
  );

  const renderDetail = (task: Task) => (
    <>
      <header className="flex items-center justify-between px-4 pb-4 pt-5">
        <button
          type="button"
          onClick={() => setScreen('overview')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-zinc-200">Task details</span>
        <button
          type="button"
          onClick={() => deleteTask(task.id)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100"
        >
          <Trash2 size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28">
        <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyles[task.priority]}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </div>
        <h1 className="mt-5 text-[2rem] font-semibold leading-[1.08] text-white">{task.title}</h1>
        <p className="mt-4 text-[15px] leading-7 text-zinc-400">{task.description}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Due</p>
            <p className="mt-3 text-base font-semibold text-white">{formatDateTime(task.dueAt)}</p>
          </div>
          <div className="rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tags</p>
            <p className="mt-3 text-base font-semibold text-white">{task.tags.join(', ') || 'None'}</p>
          </div>
        </div>

        <div className="mt-3 rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Status</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {statusOrder.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => moveTaskStatus(task.id, status)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  task.status === status ? 'bg-[#7867ff] text-white' : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Subtasks</h2>
            <span className="text-sm text-zinc-500">
              {task.subtasks.filter((subtask) => subtask.completed).length}/{task.subtasks.length}
            </span>
          </div>
          <div className="space-y-3">
            {task.subtasks.map((subtask) => (
              <button
                key={subtask.id}
                type="button"
                onClick={() => toggleSubtaskComplete(task.id, subtask.id)}
                className="flex w-full items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.05] px-4 py-4 text-left"
              >
                <span className={`text-sm font-medium ${subtask.completed ? 'text-zinc-500 line-through' : 'text-white'}`}>{subtask.title}</span>
                {subtask.completed ? <CheckCircle2 size={20} className="text-white" /> : <Circle size={20} className="text-zinc-500" />}
              </button>
            ))}
            {task.subtasks.length === 0 && <p className="text-sm text-zinc-500">No subtasks yet.</p>}
          </div>
        </div>
      </main>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => openEditEditor(task)}
            className="rounded-full bg-white/18 px-5 py-4 text-sm font-semibold text-white"
          >
            Edit task
          </button>
          <button
            type="button"
            onClick={() => toggleTaskComplete(task.id)}
            className="rounded-full bg-[#7867ff] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50"
          >
            {task.status === 'done' ? 'Reopen task' : 'Completed'}
          </button>
        </div>
      </div>
    </>
  );

  const renderEditor = () => (
    <>
      <header className="flex items-center justify-between px-4 pb-4 pt-5">
        <button
          type="button"
          onClick={() => setScreen(editingTaskId ? 'detail' : 'overview')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-zinc-200">{editingTaskId ? 'Edit task' : 'Create task'}</span>
        {editingTaskId ? (
          <button
            type="button"
            onClick={() => deleteTask(editingTaskId)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="space-y-5">
          <div className="space-y-2">
            <FieldLabel>Title</FieldLabel>
            <input
              value={draft.title}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
              placeholder="What needs to happen?"
              className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, description: event.target.value }))}
              placeholder="Add context, notes, or outcome"
              rows={4}
              className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <FieldLabel>Priority</FieldLabel>
              <select
                value={draft.priority}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, priority: event.target.value as TaskPriority }))}
                className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none"
              >
                <option value="low" className="bg-zinc-900">
                  Low
                </option>
                <option value="medium" className="bg-zinc-900">
                  Medium
                </option>
                <option value="high" className="bg-zinc-900">
                  High
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel>Category</FieldLabel>
              <input
                value={draft.category}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
                placeholder="Work"
                className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>Due date</FieldLabel>
            <input
              type="datetime-local"
              value={draft.dueAtLocal}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, dueAtLocal: event.target.value }))}
              className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Tags</FieldLabel>
            <div className="relative">
              <Tag size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={draft.tagsInput}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, tagsInput: event.target.value }))}
                placeholder="Work, Content, Personal"
                className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] py-4 pl-10 pr-4 text-base text-white outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel>Subtasks</FieldLabel>
              <button
                type="button"
                onClick={() =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    subtaskTitles: [...currentDraft.subtaskTitles, ''],
                  }))
                }
                className="rounded-full bg-white/[0.06] px-3 py-2 text-xs font-semibold text-zinc-200"
              >
                Add subtask
              </button>
            </div>
            <div className="space-y-3">
              {draft.subtaskTitles.map((title, index) => (
                <div key={`draft-subtask-${index}`} className="flex items-center gap-2">
                  <input
                    value={title}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        subtaskTitles: currentDraft.subtaskTitles.map((currentTitle, currentIndex) =>
                          currentIndex === index ? event.target.value : currentTitle,
                        ),
                      }))
                    }
                    placeholder={`Subtask ${index + 1}`}
                    className="w-full rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        subtaskTitles:
                          currentDraft.subtaskTitles.length === 1
                            ? ['']
                            : currentDraft.subtaskTitles.filter((_, currentIndex) => currentIndex !== index),
                      }))
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {formError && <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{formError}</p>}
        </div>
      </main>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <button
          type="button"
          onClick={saveDraft}
          className="w-full rounded-full bg-[#7867ff] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50"
        >
          {editingTaskId ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(122,92,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(173,162,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(94,73,255,0.62),transparent_30%),linear-gradient(160deg,#5d56ff_0%,#6550e9_45%,#4a39cf_100%)] p-0 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-[#0d0d11] text-white md:rounded-[36px] md:border md:border-white/10 md:shadow-[0_30px_90px_rgba(10,10,40,0.45)]"
      >
        {screen === 'overview' && renderOverview()}
        {screen === 'detail' && selectedTask && renderDetail(selectedTask)}
        {screen === 'editor' && renderEditor()}
        {screen === 'detail' && !selectedTask && renderOverview()}
      </motion.div>
    </div>
  );
}
