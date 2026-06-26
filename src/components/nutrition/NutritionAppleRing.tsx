function formatDisplayNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value)).replace(/,/g, ' ');
}

export function NutritionAppleRing({
  calories,
  target,
}: {
  calories: number;
  target: number;
}) {
  const progress = Math.min(100, (calories / Math.max(target, 1)) * 100);
  const delta = Math.round(calories - target);
  const deltaLabel = delta > 0 ? 'Over' : 'Left';

  return (
    <div className="relative mx-auto aspect-square w-[218px] max-w-full">
      <svg viewBox="0 0 180 180" className="h-full w-full" aria-hidden="true">
        <path d="M95 45 C91 30 101 19 116 18" fill="none" stroke="#ff665f" strokeLinecap="round" strokeWidth="10" />
        <path
          d="M88 68 C71 45 35 48 25 83 C13 126 42 164 74 145 C84 139 96 139 106 145 C138 164 167 126 155 83 C145 48 109 45 92 68 C91 70 89 70 88 68"
          fill="none"
          stroke="#292929"
          strokeLinecap="round"
          strokeWidth="13"
        />
        <path
          d="M88 68 C71 45 35 48 25 83 C13 126 42 164 74 145 C84 139 96 139 106 145 C138 164 167 126 155 83 C145 48 109 45 92 68 C91 70 89 70 88 68"
          fill="none"
          pathLength={100}
          stroke="#ff9140"
          strokeDasharray="100"
          strokeDashoffset={100 - progress}
          strokeLinecap="round"
          strokeWidth="13"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center pt-8 text-center">
        <div>
          <p className="text-3xl font-semibold text-[#ff8e63]">{formatDisplayNumber(calories)}</p>
          <p className="mt-3 text-sm text-zinc-400">{deltaLabel}</p>
          <p className="text-2xl text-zinc-300">{formatDisplayNumber(Math.abs(delta))}</p>
        </div>
      </div>
    </div>
  );
}
