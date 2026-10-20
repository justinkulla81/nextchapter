// How much two job functions share, by O*NET skill and knowledge ratings. Pure and client-safe.
//
// A snapshot, not a live query: for each function we averaged the centred skill similarity
// (src/lib/careers/vectors.ts) across a few representative occupations in the loaded O*NET
// release, and kept the result here. Re-run the query in docs/CAREER_TAXONOMY.md ("Function
// overlap") after a new O*NET load. It is a check on the hand-written feasibility table
// (feasibility.ts), never a replacement: the table stays the authority, and a test fails when
// the two disagree badly, so a wrong row gets looked at.
//
// Functions without a clear O*NET counterpart (Product, Customer Success, Administration,
// Executive Leadership) are not covered, and say nothing.

export const OVERLAP_SNAPSHOT = { onetVersion: '29.3', note: 'Centred cosine over skills and knowledge, mean of representative occupations per function.' } as const

const RAW: [string, string, number][] = [
  ['Data & Analytics', 'Finance', 0.25], ['Data & Analytics', 'Engineering', 0.2], ['Data & Analytics', 'Sales', 0.01], ['Data & Analytics', 'Legal', -0.04],
  ['Data & Analytics', 'Design', -0.07], ['Data & Analytics', 'Marketing', -0.08], ['Data & Analytics', 'Human Resources', -0.18], ['Data & Analytics', 'Operations', -0.25],
  ['Design', 'Engineering', 0.2], ['Design', 'Sales', 0.01], ['Design', 'Marketing', -0.01], ['Design', 'Legal', -0.1], ['Design', 'Operations', -0.1],
  ['Design', 'Finance', -0.15], ['Design', 'Human Resources', -0.15],
  ['Engineering', 'Finance', -0.14], ['Engineering', 'Sales', -0.2], ['Engineering', 'Legal', -0.22], ['Engineering', 'Operations', -0.22],
  ['Engineering', 'Human Resources', -0.28], ['Engineering', 'Marketing', -0.29],
  ['Finance', 'Sales', 0.35], ['Finance', 'Operations', 0.23], ['Finance', 'Legal', 0.18], ['Finance', 'Marketing', 0.17], ['Finance', 'Human Resources', 0.16],
  ['Human Resources', 'Legal', 0.29], ['Human Resources', 'Marketing', 0.29], ['Human Resources', 'Operations', 0.27], ['Human Resources', 'Sales', 0.23],
  ['Legal', 'Sales', 0.2], ['Legal', 'Marketing', 0.16], ['Legal', 'Operations', 0.1],
  ['Marketing', 'Sales', 0.52], ['Marketing', 'Operations', 0.26], ['Operations', 'Sales', 0.31],
]

const key = (a: string, b: string) => [a, b].sort().join('|')
const MATRIX = new Map(RAW.map(([a, b, v]) => [key(a, b), v]))

export type OverlapBand = 'MUCH' | 'SOME' | 'LITTLE'
export type OverlapNote = { band: OverlapBand; score: number; text: string }

export function functionOverlap(from: string | null, to: string): number | null {
  if (!from || from === to) return null
  return MATRIX.get(key(from, to)) ?? null
}

export function overlapNote(from: string | null, to: string): OverlapNote | null {
  const score = functionOverlap(from, to)
  if (score === null) return null
  if (score >= 0.25) return { band: 'MUCH', score, text: `O*NET rates ${from} and ${to} as sharing a good deal of skills and knowledge, so you are starting with more than you might think.` }
  if (score >= 0.1) return { band: 'SOME', score, text: `O*NET rates ${from} and ${to} as sharing some skills and knowledge. Part of the path is carrying those over, and part is adding what is new.` }
  return { band: 'LITTLE', score, text: `O*NET rates ${to} as drawing on mostly different skills than ${from}. That is what the learning plan below is for, and it is common for a bigger change.` }
}
