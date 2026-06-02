import { LayoutList, type LucideIcon } from 'lucide-react';
import { TaskPriority } from '../../types';

export type TaskView = 'list' | 'board' | 'calendar' | 'timeline';
export type TaskFilter = 'all' | 'today' | 'upcoming' | 'completed';
export type Screen = 'overview' | 'detail' | 'editor';

export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  dueAtLocal: string;
  category: string;
  tagsInput: string;
  subtaskTitles: string[];
}

export interface TaskViewOption {
  id: TaskView;
  label: string;
  icon: LucideIcon;
}

export type TaskViewIcon = typeof LayoutList;
