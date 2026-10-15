import type { OccupationElement, OccupationProfile } from './types'

// How alike two occupations are on O*NET's skills, knowledge, abilities and work
// activities. O*NET scores are all positive and share a large generic core (every
// white-collar job rates high on reading, speaking and critical thinking), so a plain
// cosine puts every pair above 0.9 and tells us nothing. Each element is therefore
// centred on its average across the occupations in scope first, so what is compared is
// where an occupation sits above or below a typical one. The result is relative to that
// set: recompute the means whenever the set changes (they are cheap).

export type Vector = Map<string, number>

export const elementKey = (e: Pick<OccupationElement, 'kind' | 'elementId'>) => `${e.kind}:${e.elementId}`

/** 0-1 weight of one element: importance (1-5) times level (0-7), both scaled to their range. */
export function elementWeight(e: Pick<OccupationElement, 'importance' | 'level'>): number {
  const imp = Math.min(Math.max(e.importance, 0), 5) / 5
  const lvl = Math.min(Math.max(e.level, 0), 7) / 7
  return imp * lvl
}

export function rawVector(profile: Pick<OccupationProfile, 'elements'>): Vector {
  const v: Vector = new Map()
  for (const e of profile.elements) v.set(elementKey(e), elementWeight(e))
  return v
}

/** Mean weight of every element across the given occupations; an element an occupation lacks counts as 0. */
export function buildCorpusMeans(profiles: Pick<OccupationProfile, 'elements'>[]): Vector {
  const sums: Vector = new Map()
  for (const p of profiles) for (const [k, w] of rawVector(p)) sums.set(k, (sums.get(k) ?? 0) + w)
  const n = profiles.length || 1
  const means: Vector = new Map()
  for (const [k, s] of sums) means.set(k, s / n)
  return means
}

export function centeredVector(profile: Pick<OccupationProfile, 'elements'>, means: Vector): Vector {
  const v: Vector = new Map()
  for (const [k, w] of rawVector(profile)) v.set(k, w - (means.get(k) ?? 0))
  // An element the occupation lacks still sits below the typical one.
  for (const [k, m] of means) if (!v.has(k)) v.set(k, -m)
  return v
}

export function cosine(a: Vector, b: Vector): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const [k, x] of a) {
    na += x * x
    const y = b.get(k)
    if (y !== undefined) dot += x * y
  }
  for (const y of b.values()) nb += y * y
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** 0-1 similarity of two occupations against a corpus; opposite profiles read 0, not negative. */
export function occupationSimilarity(a: OccupationProfile, b: OccupationProfile, means: Vector): number {
  return Math.max(0, cosine(centeredVector(a, means), centeredVector(b, means)))
}
