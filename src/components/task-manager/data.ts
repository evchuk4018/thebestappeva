import {
  CalendarDays,
  Clock3,
  Grid2x2,
  LayoutList,
} from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { TaskFilter, TaskViewOption } from './types';
import { dateAfterDays, dateOnRelativeDay } from './utils';

export const viewOptions: TaskViewOption[] = [
  { id: 'list', label: 'List', icon: LayoutList },
  { id: 'board', label: 'Board', icon: Grid2x2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline', icon: Clock3 },
];

export const filterOptions: TaskFilter[] = ['all', 'today', 'upcoming', 'completed'];
export const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'done'];

export const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-violet-500/20 text-violet-200 border-violet-400/20',
  medium: 'bg-amber-500/20 text-amber-100 border-amber-400/20',
  high: 'bg-indigo-500/30 text-indigo-100 border-indigo-400/20',
};

export const statusStyles: Record<TaskStatus, string> = {
  todo: 'bg-white/8 text-zinc-300 border-white/10',
  in_progress: 'bg-sky-500/20 text-sky-100 border-sky-400/20',
  done: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/20',
};

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export function createInitialTasks(): Task[] {
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
