import {
  BOARD,
  FRONTLINE,
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
  STAFF_ENTRY,
  GRADE,
  UNDER_DIRECTOR,
  type RungName,
} from './job-seniority-rules.generated'

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
export { MANAGER_FLOOR, MID_IC_FLOOR }

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

export function classifyTitleRung(rawTitle: string | null | undefined): { rung: RungName; rank: number } {
  const m = rawTitle ? GRADE.exec(rawTitle) : null
  if (!m || !rawTitle) return classifyTitleOnly(rawTitle)
  const bare = rawTitle.slice(0, m.index).trim()
  let base = classifyTitleOnly(bare)
  let grade = m[3] ? { rung: 'EVP_SVP' as RungName, rank: 90 } : (GRADE_RANK[Math.min(Number(m[2]), 15)] ?? { rung: 'OTHER' as RungName, rank: 0 })
  if (!m[3]) {
    const n = Number(m[2])
    const gs = ['gs', 'gg', 'gm'].includes(m[1].toLowerCase()) // NH/ND bands use other numbers
    // GS-11/12: mid-level professional, unless the series is uniformed,
    // clinical-floor or frontline (or the title screens itself out).
    if (gs && (n === 11 || n === 12) && !MID_GRADE_VETO.test(bare) && !FRONTLINE.test(bare) && !NEGATIVE.test(bare)) {
      grade = { rung: 'MID_IC', rank: MID_IC_RANK }
    }
    // GS-10 and below are the federal entry grades: the title alone must not lift them to mid-level.
    if (gs && n <= 10 && base.rung === 'MID_IC') base = { rung: 'OTHER', rank: 0 }
  }
  return grade.rank > base.rank ? grade : base
}

/** Mid-level professional allowlist (ncrawl/taxonomy.py MID_IC), minus entry/support/frontline markers. */
function isMidIc(title: string): boolean {
  return MID_IC.test(title) && !MID_EXCLUDE.test(title)
}

function classifyTitleOnly(rawTitle: string | null | undefined): { rung: RungName; rank: number } {
  if (!rawTitle) return { rung: 'OTHER', rank: 0 }
  // An assistant or numbered GM runs a station, store or shift, not a company.
  if (/\bassistant general manager\b|\bgeneral manager\s+(i{1,3}|[123])\b/i.test(rawTitle)) return { rung: 'MANAGER', rank: 40 }
  // In manufacturing, CMO/CDMO means a contract manufacturer, not a CMO.
  if (/manufactur|\bcdmo\b|contract\s+(development|manufactur)|\bpharma/i.test(rawTitle)) {
    rawTitle = rawTitle.replace(/\(?\b(cmo|cdmo|cmos|cdmos)\b\)?/gi, ' ').trim()
  }
  // Classify the role, not the person it reports to.
  const title = stripReportingRef(rawTitle)
  if (BOARD.test(title)) return { rung: 'BOARD', rank: 95 }
  if (NEGATIVE.test(title)) return { rung: 'OTHER', rank: 0 }
  if (FRONTLINE.test(title) || JUNIOR_PREFIX.test(title)) return { rung: 'OTHER', rank: 0 }
  // In accounting, audit and nursing "Staff" is the entry grade.
  if (STAFF_ENTRY.test(title)) return { rung: 'OTHER', rank: 0 }
  if (UNDER_DIRECTOR.test(title) && !JUNIOR_EXEMPT.test(title)) return { rung: 'SR_MANAGER', rank: 52 }
  // A senior-prefixed professional title ("Senior Financial Analyst") is a
  // senior individual role even though its bare noun reads entry-level.
  const seniorIc = LOWER_LADDER[0].pattern.test(title)
  // "Financial Analyst" reads entry-level to the JUNIOR screen; the mid-level
  // allowlist rescues the professional ones.
  if (JUNIOR.test(title) && !JUNIOR_EXEMPT.test(title) && !seniorIc) {
    return isMidIc(title) ? { rung: 'MID_IC', rank: MID_IC_RANK } : { rung: 'OTHER', rank: 0 }
  }
  for (const { name, rank, pattern } of [...LADDER, ...LOWER_LADDER]) {
    if (!pattern.test(title)) continue
    const veto = RUNG_VETO[name]
    if (veto && veto.test(title)) continue
    return { rung: name, rank }
  }
  if (isMidIc(title)) return { rung: 'MID_IC', rank: MID_IC_RANK }
  return { rung: 'OTHER', rank: 0 }
}

/** The six seniority groups shown to people, most senior first. */
export const SENIORITY_GROUPS = [
  { key: 'EXECUTIVE', label: 'Executive' },
  { key: 'VP', label: 'VP & Head of' },
  { key: 'DIRECTOR', label: 'Director' },
  { key: 'SENIOR_MANAGER', label: 'Senior manager' },
  { key: 'MANAGER', label: 'Manager' },
  { key: 'SENIOR_IC', label: 'Senior individual' },
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
    case 'SENIOR_IC': return 'IC'
    default: return null
  }
}

/**
 * The verdict an automated feed applies: the level to store, or why the job
 * is screened out.
 */
export function screenJobTitle(title: string): { keep: true; level: RungName } | { keep: false; reason: string } {
  const { rung, rank } = classifyTitleRung(title)
  if (rank >= MANAGER_FLOOR) return { keep: true, level: rung }
  return { keep: false, reason: 'below seniority floor (manager and up, plus senior individual roles)' }
}
