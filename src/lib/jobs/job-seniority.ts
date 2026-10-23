import {
  ADMIN_CONTEXT_EXCLUDE,
  ADMIN_FAMILY,
  ALLOW_LOWER,
  ALLOW_LOWER_STRICT,
  ALLOW_MANAGEMENT,
  ALLOW_TWO,
  ALLOW_UPPER,
  BARE_PROFESSIONAL,
  BOARD,
  EARLY_ASSOCIATE,
  EARLY_CAP,
  EARLY_DEFAULT,
  EARLY_DEFAULT_KEEP,
  EARLY_ENTRY_FAMILY,
  EARLY_EXCLUDE,
  EARLY_FAMILY,
  EARLY_FAMILY_EXCLUDE,
  EARLY_HARD_EXCLUDE,
  ENTRY_FAMILY,
  ENTRY_FAMILY_EXCLUDE,
  EXEC_ASSISTANT,
  RECRUIT_FAMILY,
  EARLY_IC_RANK,
  ENTRY_ANALYST,
  ENTRY_EXPLICIT,
  ENTRY_IC_FLOOR,
  ENTRY_IC_RANK,
  ENTRY_MARKER_GLOBAL,
  ENTRY_PREFIX,
  ENTRY_WORDS,
  EXPLICIT_LEVEL,
  BACHELOR,
  DEGREE_GATED,
  DEGREE_NOUN,
  DEGREE_VETO,
  FED_LIFT_VETO,
  SENIOR_SECOND_GRADE,
  GRADE_THREE_IC,
  MID_SPECIALTY_IC,
  IC_MANAGER,
  IC_MANAGER_EARLY,
  PEOPLE_MANAGER_DESC,
  RECENT_GRAD,
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
  APM_EARLY,
  CLINICAL_PRACTITIONER,
  APPRENTICE_GLOBAL,
  APPRENTICE_PRO,
  ASSISTANT_ENGINEER,
  ASSOCIATE_OR_SENIOR,
  BANK_ASSOCIATE,
  BANK_ASSOCIATE_VETO,
  BANK_DESK_GLOBAL,
  CUSTOMER_SUCCESS_ASSOCIATE,
  EXPERIENCED_ASSOCIATE,
  GRADE_RULE_MANAGEMENT,
  GRADE_RULE_VETO,
  PLANNER_ENTRY,
  PROJECT_ANALYST,
  SENIOR_ASSOCIATE_GRADE,
  SOC_ANALYST,
  TECH_LEVEL_TWO,
  TRAINEE_PRO,
  TRAINEE_VETO,
  MANAGER_IN_TRAINING,
  MUNICIPAL_PLANNER_EARLY,
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

// Federal pay grade appended to USAJOBS titles ("Program Analyst (GS-14)", a
// promotion ladder lowest grade first: "(GS-7/11)"). The LOWEST grade sets the
// level. 13 = senior individual, 14 = senior manager, 15 = director; SES, SL,
// ST = executive. A higher rank from the title itself wins (ties keep the title's).
const GRADE_RANK: Record<number, { rung: RungName; rank: number }> = {
  13: { rung: 'SENIOR_IC', rank: 45 },
  14: { rung: 'SR_MANAGER', rank: 52 },
  15: { rung: 'DIRECTOR', rank: 65 },
}
const OTHER: { rung: RungName; rank: number } = { rung: 'OTHER', rank: 0 }

/** Uniformed, clinical-floor, wage-style, clerical and frontline series are never lifted by grade. */
function fedVetoed(bare: string): boolean {
  return MID_GRADE_VETO.test(bare) || FED_LIFT_VETO.test(bare) || FRONTLINE.test(bare) || NEGATIVE.test(bare)
}

export type ClassifyOptions = {
  /** Posted on a school or district board: bare "Superintendent" is the district head. */
  schoolContext?: boolean
  /** A USAJOBS Pathways Recent Graduates posting (the hiring path, not the title). ncrawl recent_graduate. */
  recentGraduate?: boolean
}

export function classifyTitleRung(rawTitle: string | null | undefined, opts: ClassifyOptions = {}): { rung: RungName; rank: number } {
  const m = rawTitle ? GRADE.exec(rawTitle) : null
  if (!m || !rawTitle) return classifyTitleOnly(rawTitle, opts)
  const bare = rawTitle.slice(0, m.index).trim()
  let base = classifyTitleOnly(bare, opts)
  // Level skew audit (2026-10-23): a practising clinician is never lifted by grade
  // ("Physician (Primary Care) (VM-15)", "Staff Psychologist (GS-13)"). Mirrors ncrawl.
  if (CLINICAL_PRACTITIONER.test(bare)) return OTHER
  if (m[3]) return 90 > base.rank ? { rung: 'EVP_SVP', rank: 90 } : base
  // A ladder topping out at GS-12 or below is levelled by its LOWEST grade (where a hire
  // starts); one reaching GS-13+ by its highest, as before.
  const nums = (m[0].match(/\d{1,2}/g) ?? []).map(Number)
  const n = Math.max(...nums) <= 12 ? Math.min(...nums) : Math.max(...nums)
  const graded = n >= 13 ? GRADE_RANK[Math.min(n, 15)] : OTHER
  const gs = ['gs', 'gg', 'gm'].includes(m[1].toLowerCase()) // NH/ND bands use other numbers
  // R6 (owner, 2026-10-19): a Pathways "Recent Graduate" posting on a GS-5/7 or GS-5/7/9
  // ladder is entry-level, the one exception to "GS-6 and below stay out"; same vetoes.
  // 2026-10-23: the hiring path counts too (opts.recentGraduate), and a professional title (one
  // the classifier ranks ENTRY_IC to MID_IC on its own) on a GS-5/7 or GS-5/7/9 ladder is the
  // bachelor's-entry ladder.
  if (gs && Math.min(...nums) === 5 && Math.max(...nums) >= 7 && Math.max(...nums) <= 9 && !fedVetoed(bare) &&
      base.rank <= MID_IC_RANK && (RECENT_GRAD.test(rawTitle) || !!opts.recentGraduate || base.rank >= ENTRY_IC_RANK)) {
    const entry = { rung: 'ENTRY_IC' as RungName, rank: ENTRY_IC_RANK }
    return graded.rank > entry.rank ? graded : entry
  }
  if (gs && n <= 12 && base.rank <= MID_IC_RANK) {
    // OPM education qualifications (owner, 2026-10-16): GS-7/8 entry-level,
    // GS-9/10 early-career, GS-11/12 mid-level; GS-6 and below stay out.
    if (n <= 6 || fedVetoed(bare)) base = OTHER
    else if (n <= 8) base = { rung: 'ENTRY_IC', rank: ENTRY_IC_RANK }
    else if (n <= 10) base = { rung: 'EARLY_IC', rank: EARLY_IC_RANK }
    else base = { rung: 'MID_IC', rank: MID_IC_RANK }
  }
  return graded.rank > base.rank ? graded : base
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
  let base: { rung: RungName; rank: number }
  if (fixed && fixed.mode === 'set') base = { rung: fixed.name, rank: fixed.rank }
  else {
    base = ladder(title)
    if (fixed && fixed.rank > base.rank) base = { rung: fixed.name, rank: fixed.rank }
  }
  // Assistant project / program managers and "Project Manager I" (owner, 2026-10-23): EARLY_IC,
  // never above (a people-manager posting goes back up in refineLevelByYears).
  if ((base.rung === 'MANAGER' || base.rung === 'MID_IC') && APM_EARLY.test(title)) return EARLY
  // Level fix 3 (owner, 2026-10-23): a bare "Manager in Training" is a trainee seat, EARLY_IC
  // ("... Program" ENTRY_IC). Mirrors ncrawl MANAGER_IN_TRAINING.
  const mit = base.rung === 'MANAGER' ? MANAGER_IN_TRAINING.exec(title) : null
  if (mit) return /\bprogram\b/i.test(mit[0]) ? ENTRY : EARLY
  if (fixed && fixed.mode === 'set') return base
  return earlyBroaden(title, base)
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
  if (BARE_PROFESSIONAL.test(residual)) return true
  const rung = classifyTitleOnly(residual).rung
  return rung === 'MID_IC' || rung === 'EARLY_IC' || rung === 'ENTRY_IC'
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

// ── Early-career broadening (ncrawl taxonomy.py _early_allow / _early_broaden, 2026-10-15) ──
// 1. A title the ladder left at OTHER that is an allowlisted early professional office role
//    (administrative assistants and coordinators, executive assistants, paralegals, programmers,
//    designers, recruiters, buyers, planners, claims adjusters, writers, function associates and
//    specialists) joins ENTRY_IC / EARLY_IC. Interns, temporary/hourly, clinical, childcare, retail,
//    hospitality, warehouse and plant work never do.
// 2. An unmarked MID_IC title in a family the market reads as 2-5 years ("Software Engineer",
//    "Financial Analyst", "Recruiter") defaults to EARLY_IC. Nothing above MID_IC moves.
const MID: { rung: RungName; rank: number } = { rung: 'MID_IC', rank: MID_IC_RANK }

function earlyAllow(title: string): { rung: RungName; rank: number } | null {
  if (EARLY_HARD_EXCLUDE.test(title) || FRONTLINE.test(title) || ALLOW_MANAGEMENT.test(title)) return null
  const upper = ALLOW_UPPER.test(title)
  const two = ALLOW_TWO.test(title)
  if (ADMIN_FAMILY.test(title) && !ADMIN_CONTEXT_EXCLUDE.test(title)) {
    return EXEC_ASSISTANT.test(title) || upper || two ? EARLY : ENTRY
  }
  if (RECRUIT_FAMILY.test(title)) return upper ? MID : ALLOW_LOWER_STRICT.test(title) ? ENTRY : EARLY
  if (EARLY_FAMILY.test(title) && !EARLY_FAMILY_EXCLUDE.test(title)) {
    return upper ? MID : two ? EARLY : ALLOW_LOWER.test(title) ? ENTRY : EARLY
  }
  if (EARLY_ENTRY_FAMILY.test(title)) return upper ? MID : EARLY
  if (ENTRY_FAMILY.test(title) && !ENTRY_FAMILY_EXCLUDE.test(title)) return upper || two ? EARLY : ENTRY
  return null
}

// ── Grade ladders and named early-career forms (ncrawl taxonomy.py _grade_rule, 2026-10-23) ──
// Big 4 Senior / Experienced Associate, bank-desk associates, professional apprenticeships and
// trainee programs, customer success associates, assistant engineers and EITs, planners, SOC and
// project analysts, "<tech> Engineer II". Only for a title every rule above left at OTHER.
function gradeRule(rawTitle: string): { rung: RungName; rank: number } | null {
  const t = rawTitle.replace(/_+/g, ' - ')
  if (FRONTLINE.test(t)) return null
  if (new RegExp(APPRENTICE_GLOBAL.source, 'i').test(t)) {
    const rest = t.replace(APPRENTICE_GLOBAL, ' ')
    return APPRENTICE_PRO.test(rest) && !GRADE_RULE_VETO.test(rest) && !GRADE_RULE_MANAGEMENT.test(rest) && !/\btrainee\b/i.test(rest)
      ? ENTRY
      : null
  }
  if (/\btrainee\b/i.test(t)) {
    return TRAINEE_PRO.test(t) && !TRAINEE_VETO.test(t) && !GRADE_RULE_VETO.test(t.replace(/\btrainee\b/gi, ' ')) ? ENTRY : null
  }
  // Bank desks: "Sales Desk Associate" is a markets grade, judged without the desk words.
  if (BANK_ASSOCIATE.test(t)) {
    const rest = t.replace(BANK_DESK_GLOBAL, ' ')
    if (!(GRADE_RULE_VETO.test(rest) || NEGATIVE.test(rest) || BANK_ASSOCIATE_VETO.test(t) ||
          GRADE_RULE_MANAGEMENT.test(rest) || /\b(senior|sr)\b/i.test(t))) return EARLY
  }
  if (GRADE_RULE_VETO.test(t) || NEGATIVE.test(t)) return null
  if (SENIOR_ASSOCIATE_GRADE.test(t) && !GRADE_RULE_MANAGEMENT.test(t)) return ASSOCIATE_OR_SENIOR.test(t) ? EARLY : MID
  if (EXPERIENCED_ASSOCIATE.test(t) && !GRADE_RULE_MANAGEMENT.test(t)) return EARLY
  if (GRADE_RULE_MANAGEMENT.test(t)) return null
  if (CUSTOMER_SUCCESS_ASSOCIATE.test(t) && !ALLOW_UPPER.test(t)) return ENTRY
  if (ASSISTANT_ENGINEER.test(t) && !ALLOW_UPPER.test(t)) return ENTRY
  if (MUNICIPAL_PLANNER_EARLY.test(t)) return EARLY
  if (PLANNER_ENTRY.test(t)) return ENTRY
  const soc = SOC_ANALYST.exec(t)
  if (soc && !ALLOW_UPPER.test(t)) return /\b(ii|2)\s*$/i.test(soc[0]) ? EARLY : ENTRY
  if (PROJECT_ANALYST.test(t)) return ALLOW_UPPER.test(t) ? MID : ALLOW_TWO.test(t) ? EARLY : ALLOW_LOWER_STRICT.test(t) ? ENTRY : EARLY
  if (TECH_LEVEL_TWO.test(t) && !ALLOW_UPPER.test(t)) return EARLY
  return null
}

function earlyBroaden(title: string, base: { rung: RungName; rank: number }): { rung: RungName; rank: number } {
  if (base.rank === 0) return earlyAllow(title) ?? gradeRule(title) ?? base
  if (base.rung === 'MID_IC' && EARLY_DEFAULT.test(title) && !EARLY_DEFAULT_KEEP.test(title)) return EARLY
  return base
}

/**
 * The career stage a posting's years-of-experience requirement points to
 * (ncrawl years.py years_stage): ENTRY for 0-1 years ("0-2", "1+", "1-3"),
 * EARLY for a 2-3 year minimum, MID for 4+; null when the text names none.
 */
export function yearsStage(description: string | null | undefined): 'ENTRY' | 'EARLY' | 'MID' | null {
  if (!description) return null
  const text = description.replace(/\u00a0/g, ' ')
  if (YEARS_ZERO_RANGE.test(text)) return 'ENTRY'
  const y = parseYearsRequired(text)
  if (!y) return null
  if ((y.min <= 1 && (y.max === null || y.max <= 3)) || (y.max !== null && y.max <= 2)) return 'ENTRY'
  // About 2-4 years is early-career, 4-7 mid-level (owner, 2026-10-16): a 4-year minimum is mid.
  if (y.min <= 3) return 'EARLY'
  return 'MID'
}

/** Minimum years a posting states (0 for "0-2 years" forms), or null (ncrawl years.py years_min). */
export function yearsMin(description: string | null | undefined): number | null {
  if (!description) return null
  const text = description.replace(/\u00a0/g, ' ')
  if (YEARS_ZERO_RANGE.test(text)) return 0
  return parseYearsRequired(text)?.min ?? null
}

/** "Senior" titles asking this many years or fewer are mid-level. */
const SENIOR_YEARS_MAX = 5

const STAGE_RUNG = { ENTRY, EARLY, MID: { rung: 'MID_IC' as RungName, rank: MID_IC_RANK } }

/**
 * R1-R4 allowlists (ncrawl _years_rule_rung): the rung a SENIOR_IC / MANAGER title comes down to
 * at 5 years or fewer — MID_IC, or EARLY_IC for an assistant / associate / level-I
 * individual-contributor manager — or null.
 */
function yearsRuleRung(title: string, rung: RungName, description: string): { rung: RungName; rank: number } | null {
  if (rung === 'SENIOR_IC' && SENIOR_SECOND_GRADE.test(title)) return STAGE_RUNG.MID
  if (GRADE_THREE_IC.test(title) || MID_SPECIALTY_IC.test(title)) return STAGE_RUNG.MID
  if (IC_MANAGER.test(title) && !PEOPLE_MANAGER_DESC.test(description)) return IC_MANAGER_EARLY.test(title) ? STAGE_RUNG.EARLY : STAGE_RUNG.MID
  return null
}

/**
 * An early or mid-level professional title without its own level marker takes
 * its stage from the posting's years requirement ("Financial Analyst" asking
 * 0-2 years is entry, 2-3 early, 4+ mid). Never moves a job above MID_IC or
 * touches anything ranked above it, except an allowlisted SENIOR_IC / MANAGER title
 * (yearsRuleRung, owner R1-R4) asking 5 years or fewer, which comes down to MID_IC (EARLY_IC
 * for an assistant / associate / level-I individual-contributor manager).
 * Mirrors ncrawl refine_level_by_years.
 */
export function refineLevelByYears(
  title: string,
  level: { rung: RungName; rank: number },
  description: string | null | undefined
): { rung: RungName; rank: number } {
  // R1-R4 (owner, 2026-10-16 / 2026-10-19): allowlisted SENIOR_IC / MANAGER titles asking
  // 5 years or fewer are mid-level (never lower). Mirrors ncrawl _years_rule_rung.
  if (level.rung === 'SENIOR_IC' || level.rung === 'MANAGER') {
    const target = description ? yearsRuleRung(title, level.rung, description) : null
    if (target && description) {
      const m = yearsMin(description)
      if (m !== null && m <= SENIOR_YEARS_MAX) return target
    }
    return level
  }
  if (!['ENTRY_IC', 'EARLY_IC', 'MID_IC'].includes(level.rung) || !description) return level
  // An assistant project / program manager (APM_EARLY) whose posting has people-management
  // language manages people: MANAGER (owner, 2026-10-23). Mirrors ncrawl refine_level_by_years.
  if (level.rung === 'EARLY_IC' && APM_EARLY.test(title) && PEOPLE_MANAGER_DESC.test(description)) return { rung: 'MANAGER', rank: 40 }
  if (EXPLICIT_LEVEL.test(title) || ENTRY_EXPLICIT.test(title)) return level
  let stage = yearsStage(description)
  // Assistant and coordinator roles top out at early-career, however many years the posting asks for.
  if (stage === 'MID' && EARLY_CAP.test(title)) stage = 'EARLY'
  return stage ? STAGE_RUNG[stage] : level
}

/**
 * Bachelor's-degree signal (ncrawl taxonomy.py degree_lift, 2026-10-16): an excluded title whose
 * posting asks for a bachelor's joins ENTRY_IC (EARLY_IC with a level-II marker, MID_IC when
 * senior) when it is an allowlisted unsure professional title (DEGREE_GATED, DEGREE_NOUN). Never
 * for frontline, clinical, retail, store, hourly or commission work, or a manager/supervisor title.
 */
export function degreeLift(title: string, description: string | null | undefined): { rung: RungName; rank: number } | null {
  if (!title || !description || !BACHELOR.test(description)) return null
  if (DEGREE_VETO.test(title) || EARLY_HARD_EXCLUDE.test(title) || FRONTLINE.test(title) || NEGATIVE.test(title) ||
      ALLOW_MANAGEMENT.test(title) || /\bsupervisor\b/i.test(title)) return null
  if (!DEGREE_GATED.test(title) && !DEGREE_NOUN.test(title)) return null
  if (ALLOW_UPPER.test(title)) return MID
  if (ALLOW_TWO.test(title)) return EARLY
  return ENTRY
}

/** A posting's level (ncrawl level_for_posting): the title's rung, the bachelor's lift for an excluded title, then the years refinement. */
export function levelForPosting(title: string, description: string | null | undefined, opts: ClassifyOptions = {}): { rung: RungName; rank: number } {
  let level = classifyTitleRung(title, opts)
  if (level.rank === 0) level = degreeLift(title, description) ?? level
  level = refineLevelByYears(title, level, description)
  // Level fix 3 (owner, 2026-10-23): the bachelor's lift and the years refinement don't know the
  // federal grade. A Recent Graduates posting on a ladder starting at grade 7 or below and topping
  // out by grade 9 that they put between ENTRY_IC and MID_IC comes down to ENTRY_IC.
  if (level.rank > ENTRY_IC_RANK && level.rank <= MID_IC_RANK && fedRecentGradEntry(title, !!opts.recentGraduate)) return ENTRY
  return level
}

/** ncrawl fed_recent_grad_entry: a Pathways Recent Graduates GS/GG/GM posting (title or hiring path), ladder from grade <= 7 to <= 9. */
export function fedRecentGradEntry(title: string, recentGraduate = false): boolean {
  const m = title ? GRADE.exec(title) : null
  if (!m || !m[1] || !['gs', 'gg', 'gm'].includes(m[1].toLowerCase())) return false
  if (!recentGraduate && !RECENT_GRAD.test(title)) return false
  const nums = (m[0].match(/\d{1,2}/g) ?? []).map(Number)
  return nums.length > 0 && Math.min(...nums) <= 7 && Math.max(...nums) <= 9
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
