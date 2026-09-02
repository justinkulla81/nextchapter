// Seniority band detection — spec §5: "Bands set by stated level and scope
// first, years second." Title alone is deliberately never the primary
// signal (see scope-over-title invariant); scope numbers and the model's
// own seniorityLevelStated read take priority, with years of experience
// only breaking ties or filling in when scope data is thin.

import type { ResumeAnalysisFacts } from './extract-facts'
import type { SeniorityBand } from './types'
import { isAmbiguousPartnerTitle } from '@/lib/jobs/infer-job-function'

const EXECUTIVE_TITLE_PATTERN = /\b(chief|ceo|coo|cfo|cto|cmo|chro|president|evp|executive vice president|svp|senior vice president)\b/i
const SENIOR_TITLE_PATTERN = /\b(vp|vice president|director|head of|senior director)\b/i
const MID_TITLE_PATTERN = /\b(manager|senior manager|lead|principal)\b/i

function yearsOfExperience(facts: ResumeAnalysisFacts): number {
  const dated = facts.roles
    .filter((r) => r.startDate && !r.isInternship)
    .map((r) => ({
      start: new Date(r.startDate as string).getTime(),
      end: r.endDate ? new Date(r.endDate).getTime() : Date.now(),
    }))
  if (dated.length === 0) return 0
  const earliest = Math.min(...dated.map((d) => d.start))
  const latest = Math.max(...dated.map((d) => d.end))
  return Math.max(0, (latest - earliest) / (1000 * 60 * 60 * 24 * 365))
}

// Scope magnitude, spec §4.4 — reduces a role to one comparable number so
// bands and trajectory can compare "bigger vs smaller" without ever
// touching title rank. Budget/quota dominate when present (dollar-scale is
// the clearest signal); headcount is the fallback.
function scopeMagnitude(role: ResumeAnalysisFacts['roles'][number]): number {
  if (role.budgetOrPnlUsd) return role.budgetOrPnlUsd
  if (role.quotaUsd) return role.quotaUsd * 3 // rough multiplier so quota-scale roles aren't dwarfed by budget-scale ones in cross-comparisons
  if (role.headcount) return role.headcount * 200_000 // rough per-head proxy, same purpose
  return 0
}

export function detectSeniorityBand(facts: ResumeAnalysisFacts): SeniorityBand {
  const mostRecent = facts.roles.find((r) => r.isCurrent) ?? facts.roles[0]
  const titleText = [facts.seniorityLevelStated, mostRecent?.title].filter(Boolean).join(' ')
  const maxScope = Math.max(0, ...facts.roles.map(scopeMagnitude))
  const years = yearsOfExperience(facts)

  let titleScore = 0
  if (EXECUTIVE_TITLE_PATTERN.test(titleText)) titleScore = 3
  else if (SENIOR_TITLE_PATTERN.test(titleText)) titleScore = 2
  else if (MID_TITLE_PATTERN.test(titleText)) titleScore = 1
  // A bare "Partner" title matches none of the three patterns above (real
  // bug, fixed here per the Market Reality Grade recalibration): without
  // this, a genuine 20-year Partner with no stated budget/headcount number
  // fell all the way to titleScore=0, dragging a senior candidate down to
  // MID band since years-of-experience alone (weighted 1x against title's
  // 2x below) can't fully compensate. Default it to the same SENIOR-tier
  // score SENIOR_TITLE_PATTERN gets — scope and years still modulate the
  // final band up or down from there via the existing logic below.
  else if (isAmbiguousPartnerTitle(titleText)) titleScore = 2

  let scopeScore = 0
  if (maxScope >= 500_000_000) scopeScore = 3
  else if (maxScope >= 20_000_000) scopeScore = 2
  else if (maxScope >= 1_000_000) scopeScore = 1

  let yearsScore = 0
  if (years >= 20) yearsScore = 3
  else if (years >= 13) yearsScore = 2
  else if (years >= 6) yearsScore = 1

  // Level/scope first, years second — years only nudges when they disagree
  // with the stronger of the two, never overrides both.
  const primary = Math.max(titleScore, scopeScore)
  const composite = primary * 2 + yearsScore >= 7 ? 3 : primary * 2 + yearsScore >= 4 ? 2 : primary * 2 + yearsScore >= 2 ? 1 : 0

  const bands: SeniorityBand[] = ['EARLY', 'MID', 'SENIOR', 'EXECUTIVE']
  return bands[composite]
}
