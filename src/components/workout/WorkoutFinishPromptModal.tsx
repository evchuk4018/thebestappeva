import { WorkoutActionButton } from './WorkoutActionButton';
import { WorkoutModal } from './WorkoutModal';

interface WorkoutFinishPromptModalProps {
  kind: 'routine-update' | 'save-routine';
  onCancel: () => void;
  onConfirmPrimary: () => void;
  onConfirmSecondary: () => void;
  routineName?: string;
}

export function WorkoutFinishPromptModal({
  kind,
  onCancel,
  onConfirmPrimary,
  onConfirmSecondary,
  routineName,
}: WorkoutFinishPromptModalProps) {
  const isRoutineUpdate = kind === 'routine-update';
  return (
    <WorkoutModal
      title={isRoutineUpdate ? 'Would you like to update routine?' : 'Save this as a new routine?'}
      description={isRoutineUpdate ? `This workout no longer matches ${routineName ?? 'the original routine'}.` : 'Keep this quick workout as a reusable routine before you finish.'}
      onClose={onCancel}
    >
      <div className="space-y-3 px-5 py-5">
        <WorkoutActionButton onClick={onConfirmPrimary} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500">
          {isRoutineUpdate ? 'Update Routine' : 'Save as New Routine'}
        </WorkoutActionButton>
        <WorkoutActionButton onClick={onConfirmSecondary} className="w-full rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-900">
          {isRoutineUpdate ? 'Keep Routine' : 'Finish Workout'}
        </WorkoutActionButton>
        <button onClick={onCancel} className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200">
          Cancel
        </button>
      </div>
    </WorkoutModal>
  );
}
