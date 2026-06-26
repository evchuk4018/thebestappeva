import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NutritionAiFoodLogResponse } from '../../../shared/nutrition-ai-food-log-contract';
import type { NutritionDiaryEntry, NutritionDiaryEntryInput, NutritionSearchItem } from '../../../shared/nutrition-contract';
import { parseAiAttachmentFile } from '../../lib/ai-attachments-storage';
import { analyzeNutritionFoodImage, fetchNutritionHistory } from './nutrition-api';
import { NutritionAiFoodLogReviewSheet } from './NutritionAiFoodLogReviewSheet';
import { NutritionBottomNav } from './NutritionBottomNav';
import { NutritionDashboard } from './NutritionDashboard';
import { NutritionFoodFormModal } from './NutritionFoodFormModal';
import { NutritionGoalsModal } from './NutritionGoalsModal';
import { NutritionHeader } from './NutritionHeader';
import { NutritionLogModal } from './NutritionLogModal';
import { NutritionRecipeEditor } from './NutritionRecipeEditor';
import { NutritionRecipesView } from './NutritionRecipesView';
import { NutritionSearchSheet } from './NutritionSearchSheet';
import { addDays, todayKey, weekRange } from './nutrition-utils';
import { useNutrition } from './useNutrition';

interface LogDraft {
  entryId: string | null;
  itemId: string | null;
  targetId: string;
  targetName: string;
  targetType: 'food' | 'recipe';
  defaultQuantity: number;
  defaultServingId: string | null;
  defaultServingLabel: string | null;
  loggedAt?: string;
  note?: string;
  unit: 'gram' | 'serving';
}

function logDraftFromEntry(entry: NutritionDiaryEntry): LogDraft {
  const item = entry.items[0];
  return {
    entryId: entry.id,
    itemId: item.id,
    targetId: item.itemId,
    targetName: item.name,
    targetType: item.itemType,
    defaultQuantity: item.quantity,
    defaultServingId: item.servingId,
    defaultServingLabel: item.servingLabel,
    loggedAt: entry.loggedAt,
    note: entry.note,
    unit: item.unit,
  };
}

function logDraftFromSearchItem(item: NutritionSearchItem): LogDraft {
  return {
    entryId: null,
    itemId: null,
    targetId: item.id,
    targetName: item.brandName ? `${item.brandName} ${item.name}` : item.name,
    targetType: item.itemType,
    defaultQuantity: item.defaultServingLabel ? 1 : Math.round(item.defaultAmountG),
    defaultServingId: item.defaultServingId,
    defaultServingLabel: item.defaultServingLabel,
    unit: item.defaultServingLabel ? 'serving' : 'gram',
  };
}

export default function NutritionPage() {
  const nutrition = useNutrition();
  const navigate = useNavigate();
  const [view, setView] = useState<'dashboard' | 'recipes'>('dashboard');
  const [weekEntries, setWeekEntries] = useState<NutritionDiaryEntry[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NutritionSearchItem[]>([]);
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showRecipeEditor, setShowRecipeEditor] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [logDraft, setLogDraft] = useState<LogDraft | null>(null);
  const [aiFoodLog, setAiFoodLog] = useState<NutritionAiFoodLogResponse | null>(null);
  const [aiFoodLogBusy, setAiFoodLogBusy] = useState(false);
  const [aiFoodLogError, setAiFoodLogError] = useState<string | null>(null);
  const aiFoodLogInputRef = useRef<HTMLInputElement>(null);
  const bootstrap = nutrition.bootstrap;
  const editingRecipe = useMemo(() => bootstrap?.recipes.find((recipe) => recipe.id === editingRecipeId) ?? null, [bootstrap?.recipes, editingRecipeId]);

  useEffect(() => {
    if (!searchOpen) return;
    const loggedAt = new Date(`${nutrition.selectedDate}T12:00:00`).toISOString();
    void nutrition.search(searchQuery, loggedAt).then((items) => setSearchResults(items ?? []));
  }, [nutrition, nutrition.selectedDate, searchOpen, searchQuery]);

  useEffect(() => {
    let isCurrent = true;
    const { startDate, endDate } = weekRange(nutrition.selectedDate);
    void fetchNutritionHistory({ startDate, endDate }).then((entries) => {
      if (isCurrent) setWeekEntries(entries);
    }).catch(() => {
      if (isCurrent) setWeekEntries([]);
    });
    return () => { isCurrent = false; };
  }, [nutrition.selectedDate]);

  async function analyzeFoodPhoto(file: File | undefined) {
    if (!file) return;
    setAiFoodLogBusy(true);
    setAiFoodLogError(null);
    try {
      const attachment = await parseAiAttachmentFile(file);
      if (attachment.kind !== 'image') throw new Error('AI Food Log needs an image file.');
      const loggedAt = new Date(`${nutrition.selectedDate}T12:00:00`).toISOString();
      setAiFoodLog(await analyzeNutritionFoodImage(attachment.id, loggedAt));
    } catch (error) {
      setAiFoodLogError(error instanceof Error ? error.message : 'Unable to analyze this food photo.');
    } finally {
      setAiFoodLogBusy(false);
      if (aiFoodLogInputRef.current) aiFoodLogInputRef.current.value = '';
    }
  }

  if (nutrition.busy || !bootstrap) {
    return <div className="grid h-full place-items-center bg-zinc-950 text-sm text-zinc-500">Loading nutrition...</div>;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950 text-white">
      <NutritionHeader
        dateLabel={nutrition.selectedDate === todayKey() ? 'Today' : nutrition.selectedDate}
        onAddFood={() => setShowFoodForm(true)}
        onNextDay={() => nutrition.setSelectedDate((current) => addDays(current, 1))}
        onOpenRecipes={() => setView('recipes')}
        onPreviousDay={() => nutrition.setSelectedDate((current) => addDays(current, -1))}
        onSearch={() => setSearchOpen(true)}
      />
      {nutrition.error ? <div className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-sm text-red-100">{nutrition.error}</div> : null}
      {aiFoodLogError ? <div className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-sm text-red-100">{aiFoodLogError}</div> : null}
      {aiFoodLogBusy ? <div className="border-b border-emerald-500/30 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-100">Analyzing food photo...</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'dashboard' ? (
          <NutritionDashboard
            entries={bootstrap.entries}
            goals={bootstrap.goals}
            selectedDate={nutrition.selectedDate}
            weekEntries={weekEntries}
            onEditGoals={() => setShowGoalsModal(true)}
            onDeleteEntry={(entryId) => void nutrition.deleteEntry(entryId)}
            onEditEntry={(entry) => setLogDraft(logDraftFromEntry(entry))}
          />
        ) : (
          <NutritionRecipesView
            recipes={bootstrap.recipes}
            onCreate={() => {
              setEditingRecipeId(null);
              setShowRecipeEditor(true);
            }}
            onEdit={(recipe) => {
              setEditingRecipeId(recipe.id);
              setShowRecipeEditor(true);
            }}
            onLog={(recipe) => setLogDraft({
              entryId: null,
              itemId: null,
              targetId: recipe.id,
              targetName: recipe.name,
              targetType: 'recipe',
              defaultQuantity: 1,
              defaultServingId: null,
              defaultServingLabel: '1 serving',
              unit: 'serving',
            })}
          />
        )}
      </div>
      <NutritionBottomNav
        active={view}
        onAiFoodLog={() => aiFoodLogInputRef.current?.click()}
        onDashboard={() => setView('dashboard')}
        onHome={() => navigate('/')}
        onLogFood={() => setSearchOpen(true)}
        onOpenRecipes={() => setView('recipes')}
      />
      <input
        ref={aiFoodLogInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        type="file"
        onChange={(event) => void analyzeFoodPhoto(event.target.files?.[0])}
      />
      {searchOpen ? (
        <NutritionSearchSheet
          query={searchQuery}
          results={searchResults}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery('');
          }}
          onCreateFood={() => {
            setSearchOpen(false);
            setShowFoodForm(true);
          }}
          onPick={(item) => {
            setSearchOpen(false);
            setLogDraft(logDraftFromSearchItem(item));
          }}
          onQueryChange={setSearchQuery}
        />
      ) : null}
      {showFoodForm ? (
        <NutritionFoodFormModal
          initialName={searchQuery}
          onClose={() => setShowFoodForm(false)}
          onSave={(input) => void nutrition.saveBrandFood(input).then((food) => {
            setShowFoodForm(false);
            if (!food) return;
            setLogDraft({
              entryId: null,
              itemId: null,
              targetId: food.id,
              targetName: `${food.brandName ?? ''} ${food.name}`.trim(),
              targetType: 'food',
              defaultQuantity: 1,
              defaultServingId: food.servings[0]?.id ?? null,
              defaultServingLabel: food.servings[0]?.label ?? null,
              unit: food.servings[0] ? 'serving' : 'gram',
            });
          })}
        />
      ) : null}
      {showGoalsModal ? (
        <NutritionGoalsModal
          goals={bootstrap.goals}
          onClose={() => setShowGoalsModal(false)}
          onSave={(input) => void nutrition.saveGoals(input).then(() => setShowGoalsModal(false))}
        />
      ) : null}
      {showRecipeEditor ? (
        <NutritionRecipeEditor
          initialRecipe={editingRecipe}
          onClose={() => setShowRecipeEditor(false)}
          onSave={(recipeId, input) => void nutrition.saveRecipe(recipeId, input).then(() => setShowRecipeEditor(false))}
          onSearchFoods={(query) => nutrition.search(query, new Date(`${nutrition.selectedDate}T12:00:00`).toISOString())}
        />
      ) : null}
      {logDraft ? (
        <NutritionLogModal
          dateText={nutrition.selectedDate}
          defaultQuantity={logDraft.defaultQuantity}
          defaultServingId={logDraft.defaultServingId}
          defaultServingLabel={logDraft.defaultServingLabel}
          itemId={logDraft.targetId}
          itemName={logDraft.targetName}
          itemType={logDraft.targetType}
          loggedAt={logDraft.loggedAt}
          note={logDraft.note}
          onClose={() => setLogDraft(null)}
          onSave={(input: NutritionDiaryEntryInput) => void nutrition.saveEntry(logDraft.entryId, input).then(() => setLogDraft(null))}
          unit={logDraft.unit}
        />
      ) : null}
      {aiFoodLog ? (
        <NutritionAiFoodLogReviewSheet
          dateText={nutrition.selectedDate}
          response={aiFoodLog}
          onClose={() => setAiFoodLog(null)}
          onSave={(input) => void nutrition.saveEntry(null, input).then((entry) => {
            if (entry) setAiFoodLog(null);
          })}
          onSearch={(query, loggedAt) => nutrition.search(query, loggedAt)}
        />
      ) : null}
    </div>
  );
}
