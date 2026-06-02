import { ArrowLeft, Tag, Trash2, X } from 'lucide-react';
import { TaskPriority } from '../../types';
import { FieldLabel } from './FieldLabel';
import { TaskDraft } from './types';

interface EditorScreenProps {
  draft: TaskDraft;
  editingTaskId: string | null;
  formError: string;
  onBack: () => void;
  onDelete: (taskId: string) => void;
  onDraftChange: (updater: (draft: TaskDraft) => TaskDraft) => void;
  onSave: () => void;
}

export function EditorScreen({
  draft,
  editingTaskId,
  formError,
  onBack,
  onDelete,
  onDraftChange,
  onSave,
}: EditorScreenProps) {
  return (
    <>
      <header className="flex items-center justify-between px-4 pb-4 pt-5">
        <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100">
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-zinc-200">{editingTaskId ? 'Edit task' : 'Create task'}</span>
        {editingTaskId ? (
          <button type="button" onClick={() => onDelete(editingTaskId)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100">
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
              onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
              placeholder="What needs to happen?"
              className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={draft.description}
              onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, description: event.target.value }))}
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
                onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, priority: event.target.value as TaskPriority }))}
                className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none"
              >
                <option value="low" className="bg-zinc-900">Low</option>
                <option value="medium" className="bg-zinc-900">Medium</option>
                <option value="high" className="bg-zinc-900">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel>Category</FieldLabel>
              <input
                value={draft.category}
                onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
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
              onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, dueAtLocal: event.target.value }))}
              className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-base text-white outline-none"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Tags</FieldLabel>
            <div className="relative">
              <Tag size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={draft.tagsInput}
                onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, tagsInput: event.target.value }))}
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
                onClick={() => onDraftChange((currentDraft) => ({ ...currentDraft, subtaskTitles: [...currentDraft.subtaskTitles, ''] }))}
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
                      onDraftChange((currentDraft) => ({
                        ...currentDraft,
                        subtaskTitles: currentDraft.subtaskTitles.map((currentTitle, currentIndex) => (currentIndex === index ? event.target.value : currentTitle)),
                      }))
                    }
                    placeholder={`Subtask ${index + 1}`}
                    className="w-full rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onDraftChange((currentDraft) => ({
                        ...currentDraft,
                        subtaskTitles: currentDraft.subtaskTitles.length === 1 ? [''] : currentDraft.subtaskTitles.filter((_, currentIndex) => currentIndex !== index),
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
        <button type="button" onClick={onSave} className="w-full rounded-full bg-[#7867ff] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50">
          {editingTaskId ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </>
  );
}
