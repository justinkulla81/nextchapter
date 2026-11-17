// The learning plan, pure parts: a person's own list of courses, with a self-set status. No database here.
// "Done" in a plan is the person's own word. It never goes on the profile or the dossier; those come from the completion email.

import { SKILLS } from '@/lib/workforce/skills-dictionary'

export const PLAN_STATUSES = [
  { key: 'PLANNED', label: 'Planned' },
  { key: 'STARTED', label: 'Started' },
  { key: 'DONE', label: 'Done' },
] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]['key']
export const isPlanStatus = (s: string): s is PlanStatus => PLAN_STATUSES.some((p) => p.key === s)

/** A plan is a short list. A long one stops being a plan. */
export const MAX_PLAN = 12

/** Skills from the workforce dictionary that a course title names, so a group can count what its people plan to learn. */
export const skillsForTitle = (title: string): string[] => SKILLS.filter((s) => s.test.test(title)).map((s) => s.skill)

/** Why a course cannot be added, or null. A course already in the plan is not an error for the person: it just stays. */
export function addBlocked(count: number, already: boolean): string | null {
  if (already) return null
  if (count >= MAX_PLAN) return `Your plan holds ${MAX_PLAN} courses. Remove one to add another.`
  return null
}

export const cleanTitle = (raw: string) => raw.replace(/\s+/g, ' ').trim().slice(0, 160)

export function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Planned and started courses first (started before planned), done last. */
export function planOrder<T extends { status: string; createdAt: Date }>(rows: T[]): T[] {
  const rank = (s: string) => (s === 'STARTED' ? 0 : s === 'PLANNED' ? 1 : 2)
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status) || +b.createdAt - +a.createdAt)
}
