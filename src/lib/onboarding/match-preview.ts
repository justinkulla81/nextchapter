import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { matchOverrides } from '@/lib/onboarding/answers'
import type { Answers } from '@/lib/onboarding/bundles'

// The live "how many jobs fit" count under the aiming and where questions (onboarding steps 3 and 4). It is a count of
// matches only (computeMatchState countOnly), kept a minute per member and answer set, and the same call answers
// every client that asks while it runs. Served by /api/onboarding/match-preview, not a server action, so it never
// queues in front of the member's Continue (Next runs a client's server actions one at a time).

const TTL_MS = 60_000
const MAX_KEYS = 300
const counts = new Map<string, { at: number; value: Promise<number | null> }>()

function cached(key: string, load: () => Promise<number | null>): { value: Promise<number | null>; hit: boolean } {
  const found = counts.get(key)
  if (found && Date.now() - found.at < TTL_MS) return { value: found.value, hit: true }
  if (counts.size >= MAX_KEYS) counts.delete(counts.keys().next().value as string)
  const value = load()
  counts.set(key, { at: Date.now(), value })
  value.catch(() => {
    if (counts.get(key)?.value === value) counts.delete(key)
  })
  return { value, hit: false }
}

/** Whether the answers on screen leave every matching input as it is stored (a résumé-filled form, not yet edited). */
export function overridesChangeNothing(profile: Record<string, unknown>, overrides: Record<string, unknown>): boolean {
  return Object.entries(overrides).every(([key, value]) => profile[key] === value)
}

export interface MatchPreview {
  baseline: number | null
  now: number | null
  /** Every count came from the cache. */
  cached: boolean
}

export async function previewMatchCounts(profile: CandidateProfile, bundle: 'aiming' | 'where', answers: Answers, withBaseline: boolean): Promise<MatchPreview> {
  const overrides = matchOverrides(bundle, answers)
  const stamp = `${profile.id}|${profile.updatedAt.getTime()}`
  const count = (p: CandidateProfile) => computeMatchState(p, { countOnly: true }).then((s) => s?.counts.matches ?? null)

  const nowKey = `${stamp}|${JSON.stringify(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))}`
  const now = cached(nowKey, () => count({ ...profile, ...overrides } as CandidateProfile))
  // The stored profile's own count is the "before" of the before → after line. Untouched answers are that same
  // profile, so one run answers both.
  const sameAsStored = overridesChangeNothing(profile as unknown as Record<string, unknown>, overrides)
  const baseline = !withBaseline ? null : sameAsStored ? now : cached(`${stamp}|stored`, () => count(profile))

  const [nowValue, baselineValue] = await Promise.all([now.value, baseline ? baseline.value : Promise.resolve(null)])
  return { baseline: baselineValue, now: nowValue, cached: now.hit && (!baseline || baseline.hit) }
}
