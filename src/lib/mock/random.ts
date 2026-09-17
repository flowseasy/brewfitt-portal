/** Seeded pseudo-random numbers (mulberry32) so the seed is identical on every run. */
export type Rng = ReturnType<typeof createRng>;

export function createRng(seed: number) {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min;

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("pick() from an empty list");
    return items[Math.floor(next() * items.length)]!;
  };

  const chance = (p: number): boolean => next() < p;

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  const sample = <T>(items: readonly T[], count: number): T[] => shuffle(items).slice(0, count);

  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = next() * total;
    for (const [value, weight] of entries) {
      r -= weight;
      if (r <= 0) return value;
    }
    return entries[entries.length - 1]![0];
  };

  return { next, int, pick, chance, shuffle, sample, weighted };
}
