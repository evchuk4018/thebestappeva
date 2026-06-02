import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../types';
import { createInitialTasks, statusOrder } from './task-manager/data';
import { DetailScreen } from './task-manager/DetailScreen';
import { EditorScreen } from './task-manager/EditorScreen';
import { OverviewScreen } from './task-manager/OverviewScreen';
import { Screen, TaskDraft, TaskFilter, TaskView } from './task-manager/types';
import {
  buildDraft,
  normalizeTags,
  sortTasks,
  startOfMonth,
  toDateKey,
} from './task-manager/utils';

function buildTaskFromDraft(draft: TaskDraft, editingTaskId: string | null, tasks: Task[]) {
  const subtasks = draft.subtaskTitles
    .map((title, index) => ({
      id: editingTaskId ? `${editingTaskId}-sub-${index}` : `task-${Date.now()}-sub-${index}`,
      title: title.trim(),
      completed: false,
    }))
    .filter((subtask) => subtask.title);

  return {
    id: editingTaskId ?? `task-${Date.now()}`,
    title: draft.title.trim(),
    description: draft.description.trim(),
    priority: draft.priority,
    status: editingTaskId ? tasks.find((task) => task.id === editingTaskId)?.status ?? 'todo' : 'todo',
    tags: normalizeTags(draft.tagsInput),
    dueAt: new Date(draft.dueAtLocal).toISOString(),
    category: draft.category.trim() || 'General',
    subtasks,
  } satisfies Task;
}

export default function TaskManager() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(createInitialTasks);
  const [activeView, setActiveView] = useState<TaskView>('list');
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('today');
  const [screen, setScreen] = useState<Screen>('overview');
  const [selectedTaskId, setSelectedTaskId] = useState('task-2');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [draft, setDraft] = useState<TaskDraft>(buildDraft());
  const [formError, setFormError] = useState('');

  const todayKey = toDateKey(new Date());
  const filterCounts = useMemo(() => ({
    all: tasks.length,
    today: tasks.filter((task) => toDateKey(task.dueAt) === todayKey).length,
    upcoming: tasks.filter((task) => new Date(task.dueAt).getTime() > Date.now() && task.status !== 'done').length,
    completed: tasks.filter((task) => task.status === 'done').length,
  }), [tasks, todayKey]);

  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sortTasks(tasks.filter((task) => {
      const dateKey = toDateKey(task.dueAt);
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'today' && dateKey === todayKey) ||
        (activeFilter === 'upcoming' && new Date(task.dueAt).getTime() > Date.now() && task.status !== 'done') ||
        (activeFilter === 'completed' && task.status === 'done');
      const searchable = `${task.title} ${task.description} ${task.category} ${task.tags.join(' ')}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    }));
  }, [activeFilter, searchQuery, tasks, todayKey]);

  const todayOpenCount = tasks.filter((task) => toDateKey(task.dueAt) === todayKey && task.status !== 'done').length;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const boardColumns = statusOrder.map((status) => ({ status, tasks: visibleTasks.filter((task) => task.status === status) }));
  const selectedDayTasks = sortTasks(visibleTasks.filter((task) => toDateKey(task.dueAt) === selectedDate));
  const timelineGroups = useMemo(() => (
    sortTasks(visibleTasks).reduce<Record<string, Task[]>>((groups, task) => {
      const key = toDateKey(task.dueAt);
      groups[key] = [...(groups[key] ?? []), task];
      return groups;
    }, {})
  ), [visibleTasks]);
  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const cells: Array<Date | null> = [];

    for (let index = 0; index < monthStart.getDay(); index += 1) cells.push(null);
    for (let day = 1; day <= monthEnd.getDate(); day += 1) cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);

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
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id !== taskId
        ? task
        : {
            ...task,
            status: task.status !== 'done' ? 'done' : 'todo',
            subtasks: task.subtasks.map((subtask) => ({
              ...subtask,
              completed: task.status !== 'done' ? true : subtask.completed,
            })),
          }
    )));
  };

  const toggleSubtaskComplete = (taskId: string, subtaskId: string) => {
    setTasks((currentTasks) => currentTasks.map((task) => {
      if (task.id !== taskId) return task;
      const subtasks = task.subtasks.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask);
      const allCompleted = subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);
      const someCompleted = subtasks.some((subtask) => subtask.completed);
      return { ...task, subtasks, status: allCompleted ? 'done' : someCompleted ? 'in_progress' : 'todo' };
    }));
  };

  const moveTaskStatus = (taskId: string, status: Task['status']) => {
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id !== taskId
        ? task
        : {
            ...task,
            status,
            subtasks: status === 'done' ? task.subtasks.map((subtask) => ({ ...subtask, completed: true })) : task.subtasks,
          }
    )));
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

  const saveDraft = () => {
    if (!draft.title.trim()) {
      setFormError('Title is required.');
      return;
    }

    if (!draft.dueAtLocal.trim() || Number.isNaN(new Date(draft.dueAtLocal).getTime())) {
      setFormError('Choose a valid due date and time.');
      return;
    }

    const nextTask = buildTaskFromDraft(draft, editingTaskId, tasks);
    if (editingTaskId) {
      const previousTask = tasks.find((task) => task.id === editingTaskId);
      if (previousTask) {
        setTasks((currentTasks) => currentTasks.map((task) => (
          task.id === editingTaskId
            ? {
                ...nextTask,
                subtasks: nextTask.subtasks.map((subtask, index) => ({
                  ...subtask,
                  completed: previousTask.subtasks[index]?.completed ?? false,
                })),
              }
            : task
        )));
        setSelectedTaskId(editingTaskId);
      }
    } else {
      setTasks((currentTasks) => [nextTask, ...currentTasks]);
      setSelectedTaskId(nextTask.id);
    }

    setSelectedDate(toDateKey(nextTask.dueAt));
    setCalendarMonth(startOfMonth(new Date(nextTask.dueAt)));
    setScreen('detail');
    setFormError('');
  };

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(122,92,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(173,162,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(94,73,255,0.62),transparent_30%),linear-gradient(160deg,#5d56ff_0%,#6550e9_45%,#4a39cf_100%)] p-0 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-[#0d0d11] text-white md:rounded-[36px] md:border md:border-white/10 md:shadow-[0_30px_90px_rgba(10,10,40,0.45)]"
      >
        {screen === 'overview' && (
          <OverviewScreen
            activeFilter={activeFilter}
            activeView={activeView}
            boardColumns={boardColumns}
            calendarCells={calendarCells}
            calendarMonth={calendarMonth}
            filterCounts={filterCounts}
            searchQuery={searchQuery}
            selectedDate={selectedDate}
            selectedDayTasks={selectedDayTasks}
            timelineGroups={timelineGroups}
            todayOpenCount={todayOpenCount}
            visibleTasks={visibleTasks}
            onCreateTask={openCreateEditor}
            onFilterChange={setActiveFilter}
            onMonthChange={setCalendarMonth}
            onMoveTaskStatus={moveTaskStatus}
            onNavigateHome={() => navigate('/')}
            onOpenTask={openDetail}
            onSearchChange={setSearchQuery}
            onSelectDate={setSelectedDate}
            onToggleTaskComplete={toggleTaskComplete}
            onViewChange={setActiveView}
          />
        )}
        {screen === 'detail' && selectedTask && (
          <DetailScreen
            task={selectedTask}
            onBack={() => setScreen('overview')}
            onDelete={deleteTask}
            onEdit={openEditEditor}
            onMoveTaskStatus={moveTaskStatus}
            onToggleSubtaskComplete={toggleSubtaskComplete}
            onToggleTaskComplete={toggleTaskComplete}
          />
        )}
        {screen === 'editor' && (
          <EditorScreen
            draft={draft}
            editingTaskId={editingTaskId}
            formError={formError}
            onBack={() => setScreen(editingTaskId ? 'detail' : 'overview')}
            onDelete={deleteTask}
            onDraftChange={(updater) => setDraft((currentDraft) => updater(currentDraft))}
            onSave={saveDraft}
          />
        )}
        {screen === 'detail' && !selectedTask && (
          <OverviewScreen
            activeFilter={activeFilter}
            activeView={activeView}
            boardColumns={boardColumns}
            calendarCells={calendarCells}
            calendarMonth={calendarMonth}
            filterCounts={filterCounts}
            searchQuery={searchQuery}
            selectedDate={selectedDate}
            selectedDayTasks={selectedDayTasks}
            timelineGroups={timelineGroups}
            todayOpenCount={todayOpenCount}
            visibleTasks={visibleTasks}
            onCreateTask={openCreateEditor}
            onFilterChange={setActiveFilter}
            onMonthChange={setCalendarMonth}
            onMoveTaskStatus={moveTaskStatus}
            onNavigateHome={() => navigate('/')}
            onOpenTask={openDetail}
            onSearchChange={setSearchQuery}
            onSelectDate={setSelectedDate}
            onToggleTaskComplete={toggleTaskComplete}
            onViewChange={setActiveView}
          />
        )}
      </motion.div>
    </div>
  );
}
