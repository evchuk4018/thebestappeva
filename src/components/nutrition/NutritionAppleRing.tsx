function formatDisplayNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value)).replace(/,/g, ' ');
}

const appleOutlinePath = [
  'M108 70',
  'C96 50 72 50 55 63',
  'C31 82 29 126 43 156',
  'C57 185 82 190 99 174',
  'C106 168 116 168 123 174',
  'C140 190 165 185 179 156',
  'C193 126 191 82 167 63',
  'C150 50 126 50 114 70',
  'C112 73 110 73 108 70',
].join(' ');

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
    <div className="relative mx-auto h-[252px] w-[260px] max-w-full">
      <svg viewBox="0 0 220 205" className="h-full w-full" aria-hidden="true">
        <path d="M113 54 C110 35 122 21 140 20" fill="none" stroke="#ff665f" strokeLinecap="round" strokeWidth="10" />
        <path
          d={appleOutlinePath}
          fill="none"
          stroke="#292929"
          strokeLinecap="round"
          strokeWidth="13"
        />
        <path
          d={appleOutlinePath}
          fill="none"
          pathLength={100}
          stroke="#ff9140"
          strokeDasharray="100"
          strokeDashoffset={100 - progress}
          strokeLinecap="round"
          strokeWidth="13"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center pt-9 text-center">
        <div>
          <p className="text-3xl font-semibold text-[#ff8e63]">{formatDisplayNumber(calories)}</p>
          <p className="mt-3 text-sm text-zinc-400">{deltaLabel}</p>
          <p className="text-2xl text-zinc-300">{formatDisplayNumber(Math.abs(delta))}</p>
        </div>
      </div>
    </div>
  );
}
