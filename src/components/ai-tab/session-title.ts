const SESSION_TITLES = [
  'Mango',
  'Circuit',
  'Lantern',
  'Velvet',
  'Nimbus',
  'Quartz',
  'Signal',
  'Juniper',
] as const;

export function pickSessionTitle(): string {
  const index = Math.floor(Math.random() * SESSION_TITLES.length);
  return SESSION_TITLES[index] ?? SESSION_TITLES[0];
}
