import { Task } from '../../types';
import { TaskDraft } from './types';

function pad(value: number) {
  return `${value}`.padStart(2, '0');
}

export function toDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function dateAt(hoursFromNow: number) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

export function dateOnRelativeDay(days: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function dateAfterDays(days: number, hours = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDayLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatHeroDate() {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(new Date());
}

export function toDateTimeLocalInputValue(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeTags(tagsInput: string) {
  return tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function buildDraft(task?: Task): TaskDraft {
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

export function sortTasks(tasks: Task[]) {
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
