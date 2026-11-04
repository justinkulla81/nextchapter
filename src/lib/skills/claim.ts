// A member claiming a skill from a skill page or a job listing: "I have this" or "I want to build this". Pure and client-safe;
// tests in src/test/skills-claim.test.ts. They write to the profile fields that already hold this (confirmedSkillsHave,
// skillsToBuild; skillLevels for a skill the member had removed), the same ones the skills assessment and the
// "I have this" on an application's missing skills use, so a claim shows up there and feeds fit scoring.

import { skillKey } from '@/lib/profile/skill-matrix'

export type ClaimKind = 'have' | 'build'
export const CLAIM_KINDS: readonly ClaimKind[] = ['have', 'build']

export interface ClaimState {
  have: string[]
  build: string[]
  /** skillLevels, keyed by skillKey; a `removed` entry hides a skill the member took off their matrix. */
  levels: Record<string, { level?: string; removed?: boolean }>
}

const has = (list: string[], key: string) => list.some((x) => skillKey(x) === key)
const without = (list: string[], key: string) => list.filter((x) => skillKey(x) !== key)

/**
 * "I have this" adds it to the skills they have (restoring one they had removed) and takes it off their build list.
 * "I want to build this" adds it to the build list, unless they already have it.
 */
export function applyClaim(s: ClaimState, name: string, kind: ClaimKind): ClaimState {
  const key = skillKey(name)
  if (kind === 'have') {
    const levels = { ...s.levels }
    delete levels[key]
    return { have: has(s.have, key) ? s.have : [...s.have, name], build: without(s.build, key), levels }
  }
  if (has(s.have, key) && !s.levels[key]?.removed) return s
  return { ...s, build: has(s.build, key) ? s.build : [...s.build, name] }
}

/** Takes a claim back. Only the list the claim was made on changes. */
export function removeClaim(s: ClaimState, name: string, kind: ClaimKind): ClaimState {
  const key = skillKey(name)
  return kind === 'have' ? { ...s, have: without(s.have, key) } : { ...s, build: without(s.build, key) }
}

/** What the member has said about a skill. "have" wins over "build". */
export function claimOf(s: Pick<ClaimState, 'have' | 'build'>, name: string): ClaimKind | null {
  const key = skillKey(name)
  if (has(s.have, key)) return 'have'
  if (has(s.build, key)) return 'build'
  return null
}
