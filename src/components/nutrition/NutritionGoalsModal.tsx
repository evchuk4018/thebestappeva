import { useState } from 'react';
import type { NutritionGoals, NutritionGoalsInput } from '../../../shared/nutrition-contract';

export function NutritionGoalsModal({
  goals,
  onClose,
  onSave,
}: {
  goals: NutritionGoals;
  onClose: () => void;
  onSave: (input: NutritionGoalsInput) => void;
}) {
  const [caloriesTarget, setCaloriesTarget] = useState(String(goals.caloriesTarget));
  const [proteinTargetG, setProteinTargetG] = useState(String(goals.proteinTargetG));
  const [carbsTargetG, setCarbsTargetG] = useState(String(goals.carbsTargetG));
  const [fatTargetG, setFatTargetG] = useState(String(goals.fatTargetG));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-3 py-5 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ caloriesTarget: Number(caloriesTarget), proteinTargetG: Number(proteinTargetG), carbsTargetG: Number(carbsTargetG), fatTargetG: Number(fatTargetG) });
        }}
        className="mx-auto max-w-lg rounded-[30px] border border-zinc-800 bg-[#101112] p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Daily Targets</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Edit goals</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-400 hover:text-white">Close</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-zinc-300">Calories<input value={caloriesTarget} onChange={(event) => setCaloriesTarget(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Protein<input value={proteinTargetG} onChange={(event) => setProteinTargetG(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Carbs<input value={carbsTargetG} onChange={(event) => setCarbsTargetG(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Fat<input value={fatTargetG} onChange={(event) => setFatTargetG(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Cancel</button>
          <button type="submit" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Save Goals</button>
        </div>
      </form>
    </div>
  );
}
