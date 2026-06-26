const cards = [
  { title: 'Enjoy Faster Food Logging', tone: 'bg-[#d8f2ff]', accent: 'bg-[#a96b34]' },
  { title: 'Ways Protein Contributes to Weight Loss and Health', tone: 'bg-[#f0e8ff]', accent: 'bg-[#6d7fe8]' },
  { title: 'Recipe Crunchy Savory Quiche', tone: 'bg-[#7bc2e9]', accent: 'bg-[#245c82]' },
  { title: 'Plan Better Meal Balance', tone: 'bg-[#b694ff]', accent: 'bg-[#7251c7]' },
] as const;

export function NutritionAdviceStrip() {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">My Daily Advice</h2>
        <span className="text-xl leading-none text-zinc-400">...</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {cards.map((card) => (
          <article key={card.title} className={`h-[118px] w-[104px] shrink-0 overflow-hidden rounded-md border-2 border-[#6ba4cf] p-2 text-[#1c2630] ${card.tone}`}>
            <p className="text-[10px] font-bold leading-tight">{card.title}</p>
            <div className="mt-4 flex items-end gap-1">
              <div className={`h-9 w-8 rounded-t-full ${card.accent}`} />
              <div className="h-12 w-7 rounded-t-full bg-white/70" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
