import {
  parseNutritionDiaryEntryInput,
  parseNutritionFoodInput,
  parseNutritionGoalsInput,
  parseNutritionHistoryQuery,
  parseNutritionRecipeInput,
} from '../../../../shared/nutrition-contract';

function todayKey() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

export function requiredString(args: Record<string, unknown>, name: string) {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`nutrition requires a non-empty \`${name}\` argument.`);
  return value.trim();
}

function requiredObject(args: Record<string, unknown>, name: string) {
  const value = args[name];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`nutrition requires \`${name}\` as an object.`);
  return value;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseOverviewArgs(args: Record<string, unknown>) {
  const date = optionalString(args.date);
  return { date: parseNutritionHistoryQuery({ date: date ?? todayKey() }, 'Nutrition overview').date ?? todayKey() };
}

export function parseSearchArgs(args: Record<string, unknown>) {
  return {
    query: optionalString(args.query) ?? '',
    loggedAt: optionalString(args.loggedAt) ?? nowIso(),
  };
}

export function parseHistoryArgs(args: Record<string, unknown>) {
  return parseNutritionHistoryQuery({
    date: optionalString(args.date),
    startDate: optionalString(args.startDate),
    endDate: optionalString(args.endDate),
    limit: args.limit,
  });
}

export function parseFoodArg(args: Record<string, unknown>) {
  return parseNutritionFoodInput(requiredObject(args, 'food'), 'Nutrition food');
}

export function parseRecipeArg(args: Record<string, unknown>) {
  return parseNutritionRecipeInput(requiredObject(args, 'recipe'), 'Nutrition recipe');
}

export function parseGoalsArg(args: Record<string, unknown>) {
  return parseNutritionGoalsInput(requiredObject(args, 'goals'), 'Nutrition goals');
}

export function parseEntryArg(args: Record<string, unknown>) {
  return parseNutritionDiaryEntryInput(requiredObject(args, 'entry'), 'Nutrition entry');
}

export function parseItemArg(args: Record<string, unknown>) {
  return parseNutritionDiaryEntryInput({ loggedAt: nowIso(), items: [requiredObject(args, 'item')] }, 'Nutrition item').items[0];
}
