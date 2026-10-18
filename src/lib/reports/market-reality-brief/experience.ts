// Experience analysis for the Market Reality Report: the things a recruiter
// reads off a career history in the first minute — tenure pattern, gaps,
// pace of progression, plateau, level against target, industry breadth.
// Pure (no I/O, no AI), unit-tested in src/test/market-reality-brief.test.ts.
//
// Every finding states the measure, the screening norm it is read against, an
// assessment, and — where there is one — what to do about it. The norms are
// the rules of thumb recruiters screen on, not statistics about the
// candidate's market; the copy says "reviewers" for that reason.
//
// Contract, fractional and interim engagements are real work: they fill the
// timeline (no gap) but do not count as short tenures. Roles that ended in a
// layoff, closure, acquisition or offshoring do not count as an unexplained
// short stint either — the reason is already on file.

import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { isInternshipRole, type EducationDateRange, type WorkHistoryEntryInput } from '@/lib/resume/work-history-facts'
import type { Assessment } from './types'

export const GAP_REPORT_MONTHS = 3
export const GAP_LONG_MONTHS = 6
export const GAP_SIGNIFICANT_MONTHS = 12
export const SHORT_STINT_MONTHS = 12
export const LOOKBACK_YEARS = 10
export const RECENT_YEARS = 5
export const PLATEAU_YEARS = 10

/** The reason on file already explains a short stint or a gap to a reviewer. */
const EXPLAINED_REASONS = new Set([
  'COMPANY_WIDE_LAYOFF',
  'DIVISION_ELIMINATED',
  'COMPANY_SHUTDOWN',
  'ACQUISITION_REDUNDANCY',
  'OFFSHORED_OUTSOURCED',
  'LEFT_TO_START_SOMETHING',
  'CAREGIVER_LEAVE',
  'SABBATICAL',
  'MEDICAL_LEAVE',
  'RELOCATED_FOR_FAMILY',
  'RETURNING_AFTER_ABSENCE',
  'CAREER_PIVOT',
])

export interface ExperienceFinding {
  key: string
  label: string
  /** What the history shows, with the numbers. */
  measure: string
  /** The screening norm it is read against. */
  norm: string
  assessment: Assessment
  /** What to do about it, when there is something to do. */
  action: string | null
  /** The question a reviewer will put to the candidate because of this finding, in their words. Null for a strength. */
  objection: string | null
  /** How to answer it: the structure of a good one-minute answer. */
  answer: string | null
}

export interface TimelineRow {
  company: string
  title: string
  period: string
  tenure: string
  note: string | null
}

export interface ExperienceAnalysis {
  /** False when the history is too thin to read (fewer than two roles). */
  assessable: boolean
  careerYears: number | null
  roleCount: number
  employerCount: number
  findings: ExperienceFinding[]
  timeline: TimelineRow[]
  developmentCount: number
  /** Gaps and short stints a reviewer will ask about and the record does not explain. */
  openQuestions: number
  /** Plain facts the evaluator lenses quote. */
  facts: ExperienceFacts
}

export interface ExperienceFacts {
  latest: { title: string; company: string; months: number; current: boolean } | null
  /** Employers before the latest role, most recent first, at most three. */
  priorEmployers: string[]
  teamSizeMax: number | null
  longest: { company: string; months: number } | null
}

export interface ExperienceInput {
  workHistory: (WorkHistoryEntryInput & { companyIndustry?: string | null })[]
  education: EducationDateRange[]
  /** The level of the role being sought (title or level word), when known. */
  targetRole: string | null
  /** Highest level the member says they reached ("Director"), when known. */
  highestLevelReached: string | null
  asOf?: Date
}

const LEVELS = HIGHEST_LEVEL_OPTIONS as readonly string[]

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
}

function years(months: number): string {
  const y = months / 12
  return `${y >= 10 ? Math.round(y) : Math.round(y * 10) / 10} years`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function monthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function levelIndex(title: string): number {
  return LEVELS.indexOf(inferLevelFromTitle(title))
}

/** "Director", "VP", "CFO", "Head of Sales" -> an index into HIGHEST_LEVEL_OPTIONS, or -1 when unreadable. */
export function levelIndexOf(text: string | null | undefined): number {
  const t = (text ?? '').trim()
  if (!t) return -1
  const exact = LEVELS.findIndex((l) => l.toLowerCase() === t.toLowerCase())
  return exact >= 0 ? exact : levelIndex(t)
}

interface Prepared {
  e: ExperienceInput['workHistory'][number]
  start: Date
  end: Date
  months: number
  contract: boolean
  level: number
}

function overlapsEducation(from: Date, to: Date, education: EducationDateRange[], asOf: Date): boolean {
  return education.some((edu) => {
    if (!edu.startDate && !edu.graduationDate) return false
    const end = edu.graduationDate ?? asOf
    const start = edu.startDate ?? new Date(end.getFullYear() - 4, end.getMonth(), 1)
    return from <= end && start <= to
  })
}

export function analyzeExperience(input: ExperienceInput): ExperienceAnalysis {
  const asOf = input.asOf ?? new Date()
  const lookbackStart = new Date(asOf.getFullYear() - LOOKBACK_YEARS, asOf.getMonth(), 1)
  const recentStart = new Date(asOf.getFullYear() - RECENT_YEARS, asOf.getMonth(), 1)

  const roles: Prepared[] = input.workHistory
    .filter((e) => !isInternshipRole(e))
    .map((e) => {
      const end = e.isCurrent ? asOf : (e.endDate ?? asOf)
      return {
        e,
        start: e.startDate,
        end,
        months: monthsBetween(e.startDate, end),
        contract: e.engagementType !== 'FULL_TIME',
        level: levelIndex(e.roleTitle),
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const employerCount = new Set(roles.map((r) => r.e.companyName.trim().toLowerCase())).size
  const careerYears = roles.length > 0 ? Math.round(monthsBetween(roles[0].start, asOf) / 12) : null

  const timeline: TimelineRow[] = [...roles]
    .reverse()
    .slice(0, 8)
    .map((r) => ({
      company: r.e.companyName,
      title: r.e.roleTitle,
      period: `${monthYear(r.start)} – ${r.e.isCurrent ? 'Present' : monthYear(r.end)}`,
      tenure: r.months < 1 ? '<1 month' : r.months < 24 ? plural(r.months, 'month') : years(r.months),
      note: r.contract ? (r.e.engagementType === 'FRACTIONAL' ? 'Fractional' : r.e.engagementType === 'INTERIM' ? 'Interim' : 'Consulting') : null,
    }))

  const latestRole = roles.length > 0 ? [...roles].sort((a, b) => b.end.getTime() - a.end.getTime() || b.start.getTime() - a.start.getTime())[0] : null
  const permanentRoles = roles.filter((r) => !r.contract)
  const longestRole = permanentRoles.length > 0 ? permanentRoles.reduce((m, r) => (r.months > m.months ? r : m)) : null
  const teamSizes = roles.map((r) => r.e.teamSize).filter((t): t is number => typeof t === 'number' && t > 0)
  const facts: ExperienceFacts = {
    latest: latestRole ? { title: latestRole.e.roleTitle, company: latestRole.e.companyName, months: latestRole.months, current: latestRole.e.isCurrent } : null,
    priorEmployers: [...new Set([...roles].reverse().filter((r) => r !== latestRole).map((r) => r.e.companyName))].slice(0, 3),
    teamSizeMax: teamSizes.length > 0 ? Math.max(...teamSizes) : null,
    longest: longestRole ? { company: longestRole.e.companyName, months: longestRole.months } : null,
  }

  if (roles.length < 2) {
    return { assessable: false, careerYears, roleCount: roles.length, employerCount, findings: [], timeline, developmentCount: 0, openQuestions: 0, facts }
  }

  const findings: ExperienceFinding[] = []
  let openQuestions = 0

  // ── 1. Tenure pattern ────────────────────────────────────────────────────
  {
    const permanent = roles.filter((r) => !r.contract)
    const completed = permanent.filter((r) => !r.e.isCurrent)
    const avgMonths = completed.length > 0 ? completed.reduce((s, r) => s + r.months, 0) / completed.length : null
    const short = completed.filter((r) => r.months < SHORT_STINT_MONTHS && r.start >= lookbackStart)
    const unexplained = short.filter((r) => !EXPLAINED_REASONS.has(r.e.departureReason ?? ''))
    const recentUnexplained = unexplained.filter((r) => r.start >= recentStart)
    const explainedCount = short.length - unexplained.length

    let assessment: Assessment = 'adequate'
    if (unexplained.length >= 3 || recentUnexplained.length >= 2) assessment = 'development'
    else if (unexplained.length === 0 && (avgMonths === null || avgMonths >= 30)) assessment = 'strength'
    if (unexplained.length > 0) openQuestions += unexplained.length >= 2 ? 1 : unexplained.length

    const parts = [
      avgMonths !== null ? `Average tenure ${years(avgMonths)} across ${plural(completed.length, 'completed role')}` : `${plural(permanent.length, 'role')} on file`,
      short.length > 0
        ? `${plural(short.length, 'stint')} under 12 months in the last ${LOOKBACK_YEARS} years${explainedCount > 0 ? ` (${explainedCount} with a reason on file, such as a layoff or closure)` : ''}`
        : `no stints under 12 months in the last ${LOOKBACK_YEARS} years`,
    ]
    findings.push({
      key: 'tenure',
      label: 'Tenure pattern',
      measure: `${parts.join('; ')}.`,
      norm: 'Reviewers read an average above 2.5 years as stable, and two or more unexplained stints under a year inside five years as a pattern.',
      assessment,
      action:
        assessment === 'development'
          ? 'Name the real reason for each short stint in one line on the resume (restructuring, a fixed-term role, a deliberate move), and lead with the longest, strongest tenure.'
          : assessment === 'adequate' && unexplained.length > 0
            ? 'One short stint is normal. Be ready with a one-line reason.'
            : null,
      objection:
        unexplained.length >= 2
          ? `${unexplained.length} stints under a year. Will this person stay, or is this one more?`
          : unexplained.length === 1
            ? `One stint under a year, at ${unexplained[0].e.companyName}. What happened?`
            : null,
      answer:
        unexplained.length > 0
          ? 'Name the cause of each in one clause (a restructuring, a fixed-term role, a poor fit), then prove the opposite pattern since: how long you have stayed and what you delivered there.'
          : null,
    })
  }

  // ── 2. Employment gaps ───────────────────────────────────────────────────
  {
    let coveredUntil = roles[0].end
    let coveredRole = roles[0]
    const gaps: { from: Date; to: Date; months: number; explained: boolean; after: Prepared }[] = []
    for (const r of roles.slice(1)) {
      const months = monthsBetween(coveredUntil, r.start)
      if (months >= GAP_REPORT_MONTHS && coveredUntil >= lookbackStart) {
        const explained = overlapsEducation(coveredUntil, r.start, input.education, asOf) || EXPLAINED_REASONS.has(coveredRole.e.departureReason ?? '')
        gaps.push({ from: coveredUntil, to: r.start, months, explained, after: coveredRole })
      }
      if (r.end > coveredUntil) {
        coveredUntil = r.end
        coveredRole = r
      }
    }
    const working = roles.some((r) => r.e.isCurrent)
    const lastEnd = roles.reduce((m, r) => (r.end > m ? r.end : m), roles[0].end)
    const currentGap = working ? 0 : monthsBetween(lastEnd, asOf)

    const unexplainedGaps = gaps.filter((g) => !g.explained)
    const longest = gaps.reduce((m, g) => Math.max(m, g.months), 0)
    const longestUnexplained = unexplainedGaps.reduce((m, g) => Math.max(m, g.months), 0)

    let assessment: Assessment = 'strength'
    if (longestUnexplained >= GAP_LONG_MONTHS || currentGap >= GAP_LONG_MONTHS) assessment = 'development'
    else if (gaps.length > 0 || currentGap >= GAP_REPORT_MONTHS) assessment = 'adequate'
    openQuestions += unexplainedGaps.filter((g) => g.months >= GAP_LONG_MONTHS).length + (currentGap >= GAP_LONG_MONTHS ? 1 : 0)

    const text: string[] = []
    if (gaps.length === 0) text.push(`No gaps of ${GAP_REPORT_MONTHS} months or more in the last ${LOOKBACK_YEARS} years`)
    else
      text.push(
        `${plural(gaps.length, 'gap')} of ${GAP_REPORT_MONTHS}+ months in the last ${LOOKBACK_YEARS} years (longest ${plural(longest, 'month')}${
          unexplainedGaps.length < gaps.length ? `; ${gaps.length - unexplainedGaps.length} explained by school, a layoff or a leave on file` : ''
        })`
      )
    if (!working && currentGap >= GAP_REPORT_MONTHS) text.push(`not currently in a role — ${plural(currentGap, 'month')} since the last one ended`)

    findings.push({
      key: 'gaps',
      label: 'Employment gaps',
      measure: `${text.join('; ')}.`,
      norm: `Reviewers ask about any gap over ${GAP_LONG_MONTHS} months; beyond ${GAP_SIGNIFICANT_MONTHS} months an unexplained gap is screened as a risk.`,
      assessment,
      action:
        assessment === 'strength'
          ? null
          : 'Close the gap on paper: a one-line reason on the resume, or interim, fractional or contract work that is current and quantified. Unexplained is worse than any actual reason.',
      objection:
        assessment === 'strength'
          ? null
          : !working && currentGap >= GAP_REPORT_MONTHS && currentGap >= longestUnexplained
            ? 'What have you been doing since your last role ended, and why are you looking now?'
            : longestUnexplained > 0
              ? `What were you doing in the ${longestUnexplained}-month gap?`
              : 'There is a gap on the page. What was it?',
      answer:
        assessment === 'strength'
          ? null
          : 'Three sentences: the cause, what you did with the time (contract work, advising, caregiving, study), and what you are targeting now. Keep it factual and short; length reads as discomfort.',
    })
    // The gap is rendered per se above; keep the longest one visible in the timeline.
    if (gaps.length > 0) {
      const g = gaps.sort((a, b) => b.months - a.months)[0]
      const row = timeline.find((t) => t.company === g.after.e.companyName && t.title === g.after.e.roleTitle)
      if (row) row.note = [row.note, `${plural(g.months, 'month')} gap after`].filter(Boolean).join(' · ')
    }
  }

  // ── 3. Pace of progression ───────────────────────────────────────────────
  {
    const known = roles.filter((r) => r.level >= 0)
    if (known.length >= 2) {
      const first = known[0]
      const last = known[known.length - 1]
      const gain = last.level - first.level
      const spanYears = Math.max(1, monthsBetween(first.start, last.e.isCurrent ? asOf : last.end) / 12)
      let biggestJump = 0
      let jumpRole: Prepared | null = null
      let stepDowns = 0
      for (let i = 1; i < known.length; i++) {
        const diff = known[i].level - known[i - 1].level
        if (diff > biggestJump) {
          biggestJump = diff
          jumpRole = known[i]
        }
        if (diff < 0 && known[i].start >= recentStart) stepDowns++
      }
      const velocity = gain / spanYears
      const rapid = (gain >= 2 && velocity >= 0.75) || biggestJump >= 2
      const unbacked = rapid && known.filter((r) => r.level > first.level).some((r) => r.e.teamSize == null)

      let assessment: Assessment = 'adequate'
      let measure: string
      let action: string | null = null
      if (rapid) {
        assessment = unbacked ? 'development' : 'adequate'
        measure = `${LEVELS[first.level]} to ${LEVELS[last.level]} in ${years(spanYears * 12)}${biggestJump >= 2 && jumpRole ? `, including a ${biggestJump}-level step into ${jumpRole.e.roleTitle}` : ''}.`
        action = unbacked
          ? 'Fast moves are sized by scope, not title. Put a team size, budget or revenue number beside each step up so the title is backed on the page.'
          : 'The pace is a strength when the scope is visible. Keep the numbers beside each step up.'
      } else if (stepDowns > 0) {
        assessment = 'adequate'
        measure = `${plural(stepDowns, 'step')} down in level in the last ${RECENT_YEARS} years.`
        action = 'Say why in one line (mission, flexibility, a turnaround). A deliberate trade reads credibly; an unexplained one reads as a setback.'
        openQuestions += 1
      } else if (gain > 0) {
        assessment = 'strength'
        measure = `${LEVELS[first.level]} to ${LEVELS[last.level]} over ${years(spanYears * 12)}, a steady climb.`
      } else {
        measure = `Level has held at ${LEVELS[last.level]} across ${years(spanYears * 12)}.`
      }
      findings.push({
        key: 'progression',
        label: 'Pace of progression',
        measure,
        norm: 'Roughly one level every three to five years reads as steady. Two or more levels at once, or one a year, makes reviewers check the scope behind the title.',
        assessment,
        action,
        objection: rapid ? 'Titles rose quickly. Was that scope, or title inflation?' : stepDowns > 0 ? 'Why did you take a smaller role?' : null,
        answer: rapid
          ? 'Pin every step up to a number: team size, budget, revenue, geography. Let the numbers carry the title.'
          : stepDowns > 0
            ? 'Name the deliberate trade (mission, flexibility, a turnaround) and what the role gave you that the bigger one did not.'
            : null,
      })
    }
  }

  // ── 4. Plateau ───────────────────────────────────────────────────────────
  {
    const known = roles.filter((r) => r.level >= 0)
    if (known.length >= 2) {
      const lastLevel = known[known.length - 1].level
      let sinceIdx = known.length - 1
      while (sinceIdx > 0 && known[sinceIdx - 1].level === lastLevel) sinceIdx--
      const heldYears = monthsBetween(known[sinceIdx].start, asOf) / 12
      const targetLevel = levelIndexOf(input.targetRole)
      const reachingUp = targetLevel > lastLevel
      if (heldYears >= PLATEAU_YEARS) {
        findings.push({
          key: 'plateau',
          label: 'Time at current level',
          measure: `${Math.round(heldYears)} years at ${LEVELS[lastLevel]} level without a step up.`,
          norm: `A decade at one level reads as a plateau unless scope visibly grew inside it.`,
          assessment: reachingUp ? 'development' : 'adequate',
          action: 'Show growth inside the level: larger teams, budgets, geographies or a first-time mandate. Reviewers look for scope, not titles.',
          objection: `${Math.round(heldYears)} years at ${LEVELS[lastLevel]} level. Why has the next step not come?`,
          answer: 'Show how the scope grew inside the level, then say plainly what you are now deliberately seeking and why it is the right next move.',
        })
      }
    }
  }

  // ── 5. Level against target ──────────────────────────────────────────────
  {
    const held = Math.max(levelIndexOf(input.highestLevelReached), ...roles.map((r) => r.level))
    const target = levelIndexOf(input.targetRole)
    if (held >= 0 && target >= 0) {
      const diff = target - held
      findings.push({
        key: 'level_fit',
        label: 'Target level against history',
        measure:
          diff > 0
            ? `Target is ${LEVELS[target]}; the highest level held is ${LEVELS[held]}.`
            : diff < 0
              ? `Target is ${LEVELS[target]}; the highest level held is ${LEVELS[held]}.`
              : `Target and highest level held are both ${LEVELS[held]}.`,
        norm: 'The easiest searches are at the level already held. A step up needs proof of the next level; a step down raises questions of pay and staying power.',
        assessment: diff > 0 ? 'development' : diff < 0 ? 'adequate' : 'strength',
        action:
          diff > 0
            ? 'A step up is won through people, not postings. Collect evidence you have already done the next level’s job, and get references who will say so.'
            : diff < 0
              ? 'Address “overqualified” before it is asked: one line on why this level, and a pay expectation that matches it.'
              : null,
        objection:
          diff > 0
            ? `You have not held ${LEVELS[target]} level. Why are you ready for it?`
            : diff < 0
              ? `Will a ${LEVELS[target]}-level role hold you, or will you leave when something bigger comes?`
              : null,
        answer:
          diff > 0
            ? 'Show you already do the next level’s work: ownership of a P&L or budget, directors as direct reports, board exposure. Bring a reference who will say so.'
            : diff < 0
              ? 'Say why this level, now; make the pay expectation match it; and state how long you intend to stay.'
              : null,
      })
    }
  }

  // ── 6. Industry breadth ──────────────────────────────────────────────────
  {
    const recent = roles.filter((r) => r.end >= lookbackStart)
    const withIndustry = recent.filter((r) => r.e.companyIndustry)
    if (recent.length >= 3 && withIndustry.length / recent.length >= 0.6) {
      const distinct = new Set(withIndustry.map((r) => r.e.companyIndustry!.trim().toLowerCase())).size
      findings.push({
        key: 'industry',
        label: 'Industry breadth',
        measure: `${plural(distinct, 'industry')} across ${plural(withIndustry.length, 'role')} in the last ${LOOKBACK_YEARS} years.`,
        norm: 'Hiring managers favor candidates who have solved the problem in their own industry. Three or more industries needs a clear through-line.',
        assessment: distinct >= 4 ? 'development' : distinct === 3 ? 'adequate' : 'strength',
        action: distinct >= 3 ? 'Write the through-line into the summary: the one capability that travelled across every industry, with a result from each.' : null,
        objection: distinct >= 3 ? `${distinct} industries in ${LOOKBACK_YEARS} years. What is the common thread?` : null,
        answer: distinct >= 3 ? 'Name the single capability that travelled and give one result from each industry. A through-line turns breadth from drift into range.' : null,
      })
    }
  }

  const developmentCount = findings.filter((f) => f.assessment === 'development').length
  return { assessable: true, careerYears, roleCount: roles.length, employerCount, findings, timeline, developmentCount, openQuestions, facts }
}
