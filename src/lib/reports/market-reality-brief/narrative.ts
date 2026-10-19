// The "overall read": four short paragraphs a consultant would open with —
// who you are on paper, what holds it back, what the market does with that,
// and the one thing to do first. Composed by rules from the findings already
// in the report, with the wording chosen by the data (what is strongest, what
// is weakest, how scarce the market is), so two members with different records
// read differently. Every number in it is read from the same objects the
// sections below use, so it cannot disagree with them.

import type { ExperienceAnalysis } from './experience'
import type { CaseItem } from './case'
import type { HiringReason } from './hiring-case'

export interface NarrativeInput {
  experience: ExperienceAnalysis
  strengths: CaseItem[]
  hiringCase: HiringReason[]
  market: { prompt: 'too_many' | 'too_few' | 'shrinking' | 'healthy'; openRoles: number; trend: string | null } | null
  effort: { applicationsPerInterview: number; conversationsPerInterview: number; competitiveness: string } | null
  topPriority: { title: string } | null
  firstStep: { title: string } | null
  targetRole: string | null
}

/** Short noun phrases for each hiring reason, to name gaps in a sentence. */
const SHORT: Record<string, string> = {
  results: 'results sized with numbers',
  level: 'proof at the next level',
  recency: 'recent relevant work',
  stability: 'an explained work history',
  references: 'references',
  skills: 'current skills',
  ai: 'AI skills',
  positioning: 'a clear target',
  presence: 'a confirmed LinkedIn presence',
  access: 'introductions',
  proof: 'proof beyond the resume',
  pay: 'a pay floor',
  findable: 'a file software can read',
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const stripEnd = (s: string) => s.replace(/[.\s]+$/, '')

export function buildOverallRead(i: NarrativeInput): string[] {
  const out: string[] = []
  const x = i.experience
  const counts = { in_place: 0, issue: 0, missing: 0, unknown: 0 }
  for (const r of i.hiringCase) counts[r.status]++
  const total = i.hiringCase.length

  // 1. Who you are on paper
  const latest = x.facts.latest
  const opener = latest
    ? `${x.careerYears ? `${x.careerYears} years` : 'Your career'} across ${x.roleCount} roles, most recently ${latest.title} at ${latest.company}.`
    : 'There is not yet enough work history on file to describe a career.'
  if (i.strengths.length >= 2) {
    out.push(`${opener} The record is doing real work for you: ${lower(stripEnd(i.strengths[0].headline))} (${lower(stripEnd(i.strengths[0].evidence))}) and ${lower(stripEnd(i.strengths[1].headline))}.`)
  } else if (i.strengths.length === 1) {
    out.push(`${opener} One thing stands out on the page: ${lower(stripEnd(i.strengths[0].headline))}, ${lower(stripEnd(i.strengths[0].evidence))}.`)
  } else {
    out.push(`${opener} The page does not yet carry a strength a reader can verify at a glance. That is the first thing to change, and most of it is presentation rather than substance.`)
  }

  // 2. What holds it back
  const gaps = i.hiringCase.filter((r) => r.status === 'missing' || r.status === 'issue').slice(0, 3).map((r) => SHORT[r.key] ?? r.key)
  const unknown = counts.unknown
  if (gaps.length > 0) {
    out.push(
      `${counts.in_place} of the ${total} things employers hire for are in place. What holds the search back is mostly ${list(gaps)}${counts.missing + counts.issue > 3 ? `, among ${counts.missing + counts.issue} gaps in all` : ''}. ${unknown > 0 ? `${unknown} more cannot be judged until you answer a question or take an assessment, so they are not counted against you.` : 'Each of them can be built or fixed inside NextChapter.'}`
    )
  } else if (unknown > 0) {
    out.push(`Nothing on file is a problem. ${unknown} of the ${total} things employers hire for cannot be judged yet because the inputs are missing, so the next step is to supply them, not to fix anything.`)
  } else {
    out.push(`All ${total} things employers hire for are in place. The work now is selection and volume, not repair.`)
  }

  // 3. The market
  if (i.market && i.effort) {
    const m = i.market
    const needs = `one interview takes about ${i.effort.applicationsPerInterview.toLocaleString()} applications or ${i.effort.conversationsPerInterview.toLocaleString()} real conversations`
    const role = i.targetRole ?? 'your target'
    if (m.prompt === 'too_few') out.push(`The market is the harder part. Only ${m.openRoles.toLocaleString()} open roles fit ${role} on level, field, place and skills, so the search depends on a few postings and on people who hear about roles first. In a market like this ${needs}.`)
    else if (m.prompt === 'shrinking') out.push(`The market is moving against you: ${m.openRoles.toLocaleString()} open roles fit ${role}, and that pool is ${m.trend ? `trending ${m.trend}` : 'shrinking'} against the rest of the board. In a market like this ${needs}, so position for the nearby areas that are not shrinking.`)
    else if (m.prompt === 'too_many') out.push(`The market is not the constraint: ${m.openRoles.toLocaleString()} open roles fit ${role}, more than anyone can work well. The task is choosing where your story is strongest; ${needs}.`)
    else out.push(`The market is workable: ${m.openRoles.toLocaleString()} open roles fit ${role}. It is ${i.effort.competitiveness.toLowerCase()} for this profile; ${needs}.`)
  }

  // 4. What to do first
  if (i.topPriority) {
    out.push(`If you do one thing first: ${lower(stripEnd(i.topPriority.title))}. ${i.firstStep ? `Your first move in NextChapter is to ${lower(stripEnd(i.firstStep.title))}.` : ''}`.trim())
  }
  return out
}
