import {
  BARE_PROFESSIONAL,
  BOARD,
  EARLY_ASSOCIATE,
  EARLY_EXCLUDE,
  EARLY_IC_RANK,
  ENTRY_ANALYST,
  ENTRY_EXPLICIT,
  ENTRY_IC_FLOOR,
  ENTRY_IC_RANK,
  ENTRY_MARKER_GLOBAL,
  ENTRY_PREFIX,
  ENTRY_WORDS,
  EXPLICIT_LEVEL,
  FRONTLINE,
  JUNIOR_MARK,
  LEVEL_ONE,
  LEVEL_TWO,
  MID_ASSOCIATE_GRADE,
  SENIOR_MARK,
  GM_CORPORATE,
  GM_UNIT,
  JUNIOR,
  JUNIOR_EXEMPT,
  LADDER,
  LOWER_LADDER,
  MANAGER_FLOOR,
  MID_EXCLUDE,
  MID_GRADE_VETO,
  MID_IC,
  MID_IC_FLOOR,
  MID_IC_RANK,
  NEGATIVE,
  REPORTING_REF_GLOBAL,
  RUNG_VETO,
  SCHOOL_CONTEXT_OVERRIDES,
  STAFF_ENTRY,
  TITLE_OVERRIDES,
  GRADE,
  UNDER_DIRECTOR,
  YEARS_ZERO_RANGE,
  type RungName,
} from './job-seniority-rules.generated'
import { parseYearsRequired } from './years-required'

/**
 * Seniority of a job, from its title. The same rules ncrawl uses at crawl
 * time (ncrawl/taxonomy.py, exported by export-taxonomy.py into
 * job-seniority-rules.generated.ts), so an imported job and a job our own ATS
 * feed finds are judged identically. Parity with the Python is pinned by
 * src/test/job-seniority.test.ts.
 *
 * NextChapter serves manager-and-up plus senior individual roles; anything
 * ranked below MANAGER_FLOOR (entry-level, hourly/frontline, assistants) is
 * screened out of every automated feed. Jobs posted by a person (employer,
 * recruiter) are not screened.
 */

export type { RungName }
export { ENTRY_IC_FLOOR, MANAGER_FLOOR, MID_IC_FLOOR }

const JUNIOR_PREFIX = /\b(junior|jr\.?)\s/i
const STRIP_EDGES = /^[ ,\-–—]+|[ ,\-–—]+$/g

function stripReportingRef(title: string): string {
  const out = title.replace(REPORTING_REF_GLOBAL, '').replace(STRIP_EDGES, '')
  return out || title
}

// Federal pay grade appended to USAJOBS titles ("Program Analyst (GS-14)"):
// 13 = senior individual, 14 = senior manager, 15 = director; SES, SL, ST =
// executive. A higher rank from the title itself wins (ties keep the title's).
const GRADE_RANK: Record<number, { rung: RungName; rank: number }> = {
  13: { rung: 'SENIOR_IC', rank: 45 },
  14: { rung: 'SR_MANAGER', rank: 52 },
  15: { rung: 'DIRECTOR', rank: 65 },
}

export type ClassifyOptions = {
  /** Posted on a school or district board: bare "Superintendent" is the district head. */
  schoolContext?: boolean
}

export function classifyTitleRung(rawTitle: string | null | undefined, opts: ClassifyOptions = {}): { rung: RungName; rank: number } {
  const m = rawTitle ? GRADE.exec(rawTitle) : null
  if (!m || !rawTitle) return classifyTitleOnly(rawTitle, opts)
  const bare = rawTitle.slice(0, m.index).trim()
  let base = classifyTitleOnly(bare, opts)
  let grade = m[3] ? { rung: 'EVP_SVP' as RungName, rank: 90 } : (GRADE_RANK[Math.min(Number(m[2]), 15)] ?? { rung: 'OTHER' as RungName, rank: 0 })
  if (!m[3]) {
    const n = Number(m[2])
    const gs = ['gs', 'gg', 'gm'].includes(m[1].toLowerCase()) // NH/ND bands use other numbers
    // GS-11/12: mid-level professional, unless the series is uniformed,
    // clinical-floor or frontline (or the title screens itself out).
    if (gs && (n === 11 || n === 12) && !MID_GRADE_VETO.test(bare) && !FRONTLINE.test(bare) && !NEGATIVE.test(bare)) {
      grade = { rung: 'MID_IC', rank: MID_IC_RANK }
    }
    // GS-10 and below are the federal entry grades: the title alone must not lift them to
    // mid-level. A professional series at GS-5 to GS-8 is entry-level, at GS-9/10 early-career.
    if (gs && n <= 10 && (base.rung === 'MID_IC' || base.rung === 'ENTRY_IC' || base.rung === 'EARLY_IC')) {
      if (n >= 5 && n <= 8 && !MID_GRADE_VETO.test(bare)) base = { rung: 'ENTRY_IC', rank: ENTRY_IC_RANK }
      else if (n >= 9 && !MID_GRADE_VETO.test(bare)) base = { rung: 'EARLY_IC', rank: EARLY_IC_RANK }
      else base = { rung: 'OTHER', rank: 0 }
    }
  }
  return grade.rank > base.rank ? grade : base
}

/** Mid-level professional allowlist (ncrawl/taxonomy.py MID_IC), minus entry/support/frontline markers. */
function isMidIc(title: string): boolean {
  return MID_IC.test(title) && !MID_EXCLUDE.test(title)
}

// Ordered title overrides (ncrawl TITLE_OVERRIDES): "set" is the verdict,
// "floor" the least the title ranks. Promotions never apply to NEGATIVE titles.
function titleOverride(title: string, schoolContext: boolean) {
  for (const o of [...(schoolContext ? SCHOOL_CONTEXT_OVERRIDES : []), ...TITLE_OVERRIDES]) {
    if (!o.pattern.test(title)) continue
    if (o.rank > 0 && NEGATIVE.test(title)) continue
    return o
  }
  return null
}

function classifyTitleOnly(rawTitle: string | null | undefined, opts: ClassifyOptions = {}): { rung: RungName; rank: number } {
  if (!rawTitle) return { rung: 'OTHER', rank: 0 }
  // An assistant or numbered GM runs a station, store or shift, not a company.
  if (/\bassistant general manager\b|\bgeneral manager\s+(i{1,3}|[123])\b/i.test(rawTitle)) return { rung: 'MANAGER', rank: 40 }
  // A General Manager of one restaurant, store, hotel or branch runs a unit.
  if (GM_UNIT.test(rawTitle) && !GM_CORPORATE.test(rawTitle)) return { rung: 'MANAGER', rank: 40 }
  // In manufacturing, CMO/CDMO means a contract manufacturer, not a CMO.
  if (/manufactur|\bcdmo\b|contract\s+(development|manufactur)|\bpharma/i.test(rawTitle)) {
    rawTitle = rawTitle.replace(/\(?\b(cmo|cdmo|cmos|cdmos)\b\)?/gi, ' ').trim()
  }
  // Classify the role, not the person it reports to.
  const title = stripReportingRef(rawTitle)
  if (BOARD.test(title)) return { rung: 'BOARD', rank: 95 }
  const fixed = titleOverride(title, !!opts.schoolContext)
  if (fixed && fixed.mode === 'set') return { rung: fixed.name, rank: fixed.rank }
  const base = ladder(title)
  return fixed && fixed.rank > base.rank ? { rung: fixed.name, rank: fixed.rank } : base
}

function ladder(title: string): { rung: RungName; rank: number } {
  if (NEGATIVE.test(title)) return { rung: 'OTHER', rank: 0 }
  if (FRONTLINE.test(title)) return { rung: 'OTHER', rank: 0 }
  // "Junior X" is never mid-level or above; a junior professional role is entry-level.
  if (JUNIOR_PREFIX.test(title)) return earlyStage(title) ?? { rung: 'OTHER', rank: 0 }
  // In accounting, audit and nursing "Staff" is the entry grade.
  if (STAFF_ENTRY.test(title)) return earlyStage(title) ?? { rung: 'OTHER', rank: 0 }
  if (UNDER_DIRECTOR.test(title) && !JUNIOR_EXEMPT.test(title)) return { rung: 'SR_MANAGER', rank: 52 }
  // A senior-prefixed professional title ("Senior Financial Analyst") is a
  // senior individual role even though its bare noun reads entry-level.
  const seniorIc = LOWER_LADDER[0].pattern.test(title)
  // "Financial Analyst" reads entry-level to the JUNIOR screen; the mid-level
  // allowlist rescues the professional ones.
  if (JUNIOR.test(title) && !JUNIOR_EXEMPT.test(title) && !seniorIc) {
    const early = earlyStage(title)
    if (early) return early
    return isMidIc(title) ? { rung: 'MID_IC', rank: MID_IC_RANK } : { rung: 'OTHER', rank: 0 }
  }
  for (const { name, rank, pattern } of [...LADDER, ...LOWER_LADDER]) {
    if (!pattern.test(title)) continue
    const veto = RUNG_VETO[name]
    if (veto && veto.test(title)) continue
    return { rung: name, rank }
  }
  const early = earlyStage(title)
  if (early) return early
  if (isMidIc(title)) return { rung: 'MID_IC', rank: MID_IC_RANK }
  return { rung: 'OTHER', rank: 0 }
}

// ── Early-career rungs (ncrawl taxonomy.py _early_stage, 2026-10-15) ─────────
// ENTRY_IC 20 (0-2 years) and EARLY_IC 25 (2-5 years): professional titles
// only — a title qualifies when, with its entry or level marker off, what is
// left is a mid-level professional role, or it is a named program / first
// grade. Internships, students, temporary, hourly, clerical, support and
// frontline work never do. Reached only where the ladder used to answer
// MID_IC or OTHER, so nothing ranked above MID_IC moves down.

function stripEntry(title: string): string {
  return title.replace(ENTRY_MARKER_GLOBAL, ' ').replace(/\s+/g, ' ').replace(/^[ ,\-–—|:/]+|[ ,\-–—|:/]+$/g, '')
}

function isMidRole(residual: string, title: string): boolean {
  if (!residual || residual.toLowerCase() === title.toLowerCase()) return false
  return BARE_PROFESSIONAL.test(residual) || classifyTitleOnly(residual).rung === 'MID_IC'
}

const ENTRY: { rung: RungName; rank: number } = { rung: 'ENTRY_IC', rank: ENTRY_IC_RANK }
const EARLY: { rung: RungName; rank: number } = { rung: 'EARLY_IC', rank: EARLY_IC_RANK }

function earlyStage(title: string): { rung: RungName; rank: number } | null {
  if (EARLY_EXCLUDE.test(title) || NEGATIVE.test(title) || FRONTLINE.test(title)) return null
  // "Staff Accountant" / "Staff Auditor": the entry grade in accounting.
  if (STAFF_ENTRY.test(title)) return isMidRole(stripEntry(title.replace(/\bstaff\s+/gi, ' ')), title) ? ENTRY : null
  if (SENIOR_MARK.test(title)) return null
  const fullMid = isMidIc(title)
  if (LEVEL_TWO.test(title)) {
    const two = title.replace(/\s*[-,]?\s*(level\s*)?\b(ii|2)\b/i, ' ')
    return fullMid || isMidRole(stripEntry(two), title) || ENTRY_EXPLICIT.test(title) ? EARLY : null
  }
  if (ENTRY_EXPLICIT.test(title)) return ENTRY
  const stripped = LEVEL_ONE.test(title) || ENTRY_PREFIX.test(title) || ENTRY_WORDS.test(title) ? stripEntry(title) : title
  if (isMidRole(stripped, title)) {
    // "Associate Attorney" is a post-degree grade the mid tier already holds.
    if (fullMid && MID_ASSOCIATE_GRADE.test(title) && !JUNIOR_MARK.test(title) && !LEVEL_ONE.test(title)) return null
    return ENTRY
  }
  if (EARLY_ASSOCIATE.test(title)) return EARLY
  if (ENTRY_ANALYST.test(title)) return ENTRY
  return null
}

/**
 * The career stage a posting's years-of-experience requirement points to
 * (ncrawl years.py years_stage): ENTRY for 0-1 years ("0-2", "1+", "1-3"),
 * EARLY for a 2-4 year minimum, MID for 5+; null when the text names none.
 */
export function yearsStage(description: string | null | undefined): 'ENTRY' | 'EARLY' | 'MID' | null {
  if (!description) return null
  const text = description.replace(/\u00a0/g, ' ')
  if (YEARS_ZERO_RANGE.test(text)) return 'ENTRY'
  const y = parseYearsRequired(text)
  if (!y) return null
  if ((y.min <= 1 && (y.max === null || y.max <= 3)) || (y.max !== null && y.max <= 2)) return 'ENTRY'
  if (y.min <= 4) return 'EARLY'
  return 'MID'
}

const STAGE_RUNG = { ENTRY, EARLY, MID: { rung: 'MID_IC' as RungName, rank: MID_IC_RANK } }

/**
 * An early or mid-level professional title without its own level marker takes
 * its stage from the posting's years requirement ("Financial Analyst" asking
 * 0-2 years is entry, 3+ early, 5+ mid). Never moves a job above MID_IC or
 * touches anything ranked above it. Mirrors ncrawl refine_level_by_years.
 */
export function refineLevelByYears(
  title: string,
  level: { rung: RungName; rank: number },
  description: string | null | undefined
): { rung: RungName; rank: number } {
  if (!['ENTRY_IC', 'EARLY_IC', 'MID_IC'].includes(level.rung) || !description) return level
  if (EXPLICIT_LEVEL.test(title) || ENTRY_EXPLICIT.test(title)) return level
  const stage = yearsStage(description)
  return stage ? STAGE_RUNG[stage] : level
}

/** The seniority groups shown to people, most senior first. */
export const SENIORITY_GROUPS = [
  { key: 'EXECUTIVE', label: 'Executive' },
  { key: 'VP', label: 'VP & Head of' },
  { key: 'DIRECTOR', label: 'Director' },
  { key: 'SENIOR_MANAGER', label: 'Senior manager' },
  { key: 'MANAGER', label: 'Manager' },
  { key: 'SENIOR_IC', label: 'Senior individual' },
  { key: 'MID_LEVEL', label: 'Mid-level' },
  { key: 'EARLY_CAREER', label: 'Early career (2–5 yrs)' },
  { key: 'ENTRY_LEVEL', label: 'Entry level (0–2 yrs)' },
] as const

export type SeniorityGroup = (typeof SENIORITY_GROUPS)[number]['key']

const GROUP_OF_RUNG: Partial<Record<RungName, SeniorityGroup>> = {
  C_SUITE: 'EXECUTIVE',
  BOARD: 'EXECUTIVE',
  EVP_SVP: 'EXECUTIVE',
  VP: 'VP',
  HEAD: 'VP',
  PARTNER: 'VP',
  DIRECTOR: 'DIRECTOR',
  PRINCIPAL: 'DIRECTOR',
  CHIEF_OF_STAFF: 'DIRECTOR',
  SCHOOL_LEADER: 'DIRECTOR',
  SR_MANAGER: 'SENIOR_MANAGER',
  MANAGER: 'MANAGER',
  SENIOR_IC: 'SENIOR_IC',
  MID_IC: 'MID_LEVEL',
  EARLY_IC: 'EARLY_CAREER',
  ENTRY_IC: 'ENTRY_LEVEL',
}

/** The group a stored `level` (a rung name) belongs to; null for unknown or below the floor. */
export function seniorityGroupOf(level: string | null | undefined): SeniorityGroup | null {
  return (level && GROUP_OF_RUNG[level as RungName]) || null
}

/** Label for a group key ("DIRECTOR" -> "Director"); null for unknown. */
export function seniorityGroupLabel(group: string | null | undefined): string | null {
  return SENIORITY_GROUPS.find((g) => g.key === group)?.label ?? null
}

export function seniorityLabel(level: string | null | undefined): string | null {
  const group = seniorityGroupOf(level)
  return SENIORITY_GROUPS.find((g) => g.key === group)?.label ?? null
}

/** Levels (rung names) in a group — for filtering stored rows by group. */
export function levelsInGroup(group: SeniorityGroup): RungName[] {
  return (Object.keys(GROUP_OF_RUNG) as RungName[]).filter((r) => GROUP_OF_RUNG[r] === group)
}

/**
 * A stored level (rung) on the candidate-level scale (level-rank.ts's
 * IC / Manager / Director / VP / C-Suite), so a job's seniority can be
 * compared with a candidate's.
 */
export function candidateScaleLevel(level: string | null | undefined): string | null {
  switch (seniorityGroupOf(level)) {
    case 'EXECUTIVE': return 'C-Suite'
    case 'VP': return 'VP'
    case 'DIRECTOR': return 'Director'
    case 'SENIOR_MANAGER':
    case 'MANAGER': return 'Manager'
    case 'SENIOR_IC':
    case 'MID_LEVEL':
    case 'EARLY_CAREER':
    case 'ENTRY_LEVEL': return 'IC'
    default: return null
  }
}

/**
 * The verdict an automated feed applies: the level to store, or why the job
 * is screened out.
 */
export function screenJobTitle(
  title: string,
  opts: ClassifyOptions & { floor?: number } = {}
): { keep: true; level: RungName } | { keep: false; reason: string } {
  const { rung, rank } = classifyTitleRung(title, opts)
  const floor = opts.floor ?? MANAGER_FLOOR
  if (rank >= floor) return { keep: true, level: rung }
  return {
    keep: false,
    reason: floor <= ENTRY_IC_FLOOR
      ? 'below seniority floor (early-career professional and up)'
      : floor <= MID_IC_FLOOR
      ? 'below seniority floor (mid-level professional and up)'
      : 'below seniority floor (manager and up, plus senior individual roles)',
  }
}
