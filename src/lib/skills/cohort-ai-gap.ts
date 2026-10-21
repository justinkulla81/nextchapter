// A group's AI-skill gap, counts only. For each person: the AI skills postings in their
// function ask for most (static analysis, ai-skill-market.data.ts) against the AI skills
// their profile shows (memberAiSkillIds). Cheap and deterministic: no board scan, no model
// call, so it costs nothing per view. Pure; tested in src/test/cohort-ai-gap.test.ts.
//
// Reads "on their profile", never "they lack": the profile is what they have told us.
// Held back (null) until at least MIN_COHORT people can be counted, the same bar as every
// other employer and college report (EMPLOYER_MIN_CELL_SIZE).

import { aiSkillItem, memberAiSkillIds } from '@/lib/skills/ai-skills'
import { suggestedAiItems, functionCode } from '@/lib/skills/ai-skill-market'
import { AI_FUNCTION_STATS } from '@/lib/skills/ai-skill-market.data'

export const MIN_COHORT = 10
/** How many of a function's most-asked AI skills a person is measured against. */
export const ASKED_PER_PERSON = 3

export interface CohortMember {
  /** primaryFunction, as stored. */
  fn: string | null
  /** Skill terms from the skills matrix (skillTerms). */
  keywords: string[]
}

export interface CohortAiGap {
  /** People counted (those with a function the analysis covers). */
  counted: number
  /** Of those, how many show at least one AI skill. */
  showAnyAi: number
  /** Of those, how many are missing at least one of their function's most-asked AI skills. */
  missingAsked: number
  /** The AI skills most often missing, with how many people each. */
  topMissing: { id: string; label: string; people: number }[]
  /** Functions in the group with the share of postings asking for AI, largest group first. */
  functions: { fn: string; people: number; postingsAskingPct: number }[]
}

export function computeCohortAiGap(members: CohortMember[]): CohortAiGap | null {
  const counted = members.filter((m) => functionCode(m.fn))
  if (counted.length < MIN_COHORT) return null
  let showAnyAi = 0
  let missingAsked = 0
  const missing = new Map<string, number>()
  const byFn = new Map<string, number>()
  for (const m of counted) {
    const code = functionCode(m.fn)!
    byFn.set(code, (byFn.get(code) ?? 0) + 1)
    const mine = memberAiSkillIds(m.keywords)
    if (mine.size > 0) showAnyAi++
    const asked = suggestedAiItems(code, [], ASKED_PER_PERSON)
    const gaps = asked.filter((id) => !mine.has(id))
    if (gaps.length > 0) missingAsked++
    for (const id of gaps) missing.set(id, (missing.get(id) ?? 0) + 1)
  }
  return {
    counted: counted.length,
    showAnyAi,
    missingAsked,
    topMissing: [...missing.entries()]
      .filter(([, n]) => n >= MIN_COHORT)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, people]) => ({ id, label: aiSkillItem(id)?.label ?? id, people })),
    functions: [...byFn.entries()]
      .filter(([, n]) => n >= MIN_COHORT)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([fn, people]) => ({ fn, people, postingsAskingPct: Math.round(AI_FUNCTION_STATS[fn]?.sharePct ?? 0) })),
  }
}

/** "62% of 140 people show no AI skill on their profile" as plain text. */
export function cohortAiGapHeadline(g: CohortAiGap): string {
  const none = g.counted - g.showAnyAi
  const pct = Math.round((none / g.counted) * 100)
  return `${pct}% of the ${g.counted} people we could place in a function show no AI skill on their profile.`
}
