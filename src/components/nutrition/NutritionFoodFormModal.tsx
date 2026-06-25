import { useState } from 'react';
import type { NutritionFoodInput } from '../../../shared/nutrition-contract';

export function NutritionFoodFormModal({
  initialName = '',
  onClose,
  onSave,
}: {
  initialName?: string;
  onClose: () => void;
  onSave: (input: NutritionFoodInput) => void;
}) {
  const [name, setName] = useState(initialName);
  const [brandName, setBrandName] = useState('');
  const [barcodeText, setBarcodeText] = useState('');
  const [servingLabel, setServingLabel] = useState('1 serving');
  const [servingGrams, setServingGrams] = useState('30');
  const [calories, setCalories] = useState('420');
  const [protein, setProtein] = useState('8');
  const [carbs, setCarbs] = useState('58');
  const [fat, setFat] = useState('16');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-3 py-5 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name,
            brandName,
            barcodeText,
            servings: [{ id: 'serving_primary', label: servingLabel, amount: 1, grams: Number(servingGrams) }],
            nutritionPer100g: { calories: Number(calories), proteinG: Number(protein), carbsG: Number(carbs), fatG: Number(fat) },
          });
        }}
        className="mx-auto max-w-xl rounded-[30px] border border-zinc-800 bg-[#101112] p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">New Branded Food</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Save a local food label</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-400 hover:text-white">Close</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-zinc-300">Food name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Brand<input value={brandName} onChange={(event) => setBrandName(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Barcode placeholder<input value={barcodeText} onChange={(event) => setBarcodeText(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Primary serving label<input value={servingLabel} onChange={(event) => setServingLabel(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Serving grams<input value={servingGrams} onChange={(event) => setServingGrams(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { label: 'Calories / 100g', value: calories, setValue: setCalories },
            { label: 'Protein / 100g', value: protein, setValue: setProtein },
            { label: 'Carbs / 100g', value: carbs, setValue: setCarbs },
            { label: 'Fat / 100g', value: fat, setValue: setFat },
          ].map(({ label, value, setValue }) => (
            <label key={label} className="text-sm text-zinc-300">
              {label}
              <input value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" />
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Cancel</button>
          <button type="submit" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Save Food</button>
        </div>
      </form>
    </div>
  );
}
