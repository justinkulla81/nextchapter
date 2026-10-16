// A small seeded random generator, so the same demo organization always gets the
// same people and numbers (screenshots and sales walkthroughs stay comparable).

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface Rng {
  /** A float in [0, 1). */
  next(): number
  /** An integer in [min, max]. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  /** True with probability p. */
  chance(p: number): boolean
}

export function makeRng(seed: string | number): Rng {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
  }
}
