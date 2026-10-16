import { classifyTitleRung, type RungName } from '@/lib/jobs/job-seniority'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { nameParts } from '@/lib/crm/email-pattern'

/**
 * "Who to contact" for one job — the pure parts, computed only from the job (and the
 * member's own headline for the note). No database, no LLM, no paid API, so the rules
 * are unit-tested (src/test/who-to-contact.test.ts).
 *
 * Every title here is a LIKELY title, never a person we claim exists: the member opens
 * a LinkedIn people search themselves to find who actually holds it. We do not scrape.
 */

// ── The safe projection sent to a member ────────────────────────────────────
// This is the WHOLE shape that leaves the server for the panel. Nothing from the CRM
// appears in it except `knownSomeone` (a yes/no) and a guessed address for the
// posting's OWN named contact, built from the company's email format. The keys are
// pinned by src/test/who-to-contact.test.ts so a new field is a deliberate change.

export type ContactSearchKind = 'recruiter' | 'hiring_manager'

export interface ContactTarget {
  kind: ContactSearchKind
  /** e.g. "VP of Finance" — always a likely title, never a known person. */
  title: string
  linkedinSearchUrl: string
}

export interface WhoToContactPanel {
  jobId: string
  /** The person the posting itself names as its contact or poster (public on the listing). */
  recruiter: { name: string; guessedEmail: string | null; linkedinSearchUrl: string } | null
  /** NextChapter has a warm relationship at this employer — no names, no details. */
  knownSomeone: boolean
  /** The directory company, for the intro request and its event. */
  companyId: string | null
  targets: ContactTarget[]
  /** The level the likely-manager titles were read from, e.g. "Director". */
  hiringManagerBasis: string | null
  template: string
  /** Which sources contributed — for who_to_contact_opened. */
  sources: string[]
}

export const PANEL_KEYS = [
  'jobId',
  'recruiter',
  'knownSomeone',
  'companyId',
  'targets',
  'hiringManagerBasis',
  'template',
  'sources',
] as const satisfies readonly (keyof WhoToContactPanel)[]

// ── Hiring manager: same function, one or two rungs up ──────────────────────

// The management ladder the rungs in job-seniority.ts collapse onto. A job's likely
// hiring manager sits one or two steps above it.
const STEPS = ['IC', 'MANAGER', 'SR_MANAGER', 'DIRECTOR', 'VP', 'C_SUITE'] as const
type Step = (typeof STEPS)[number] | 'EVP'

const STEP_OF_RUNG: Partial<Record<RungName, Step>> = {
  ENTRY_IC: 'IC',
  EARLY_IC: 'IC',
  MID_IC: 'IC',
  SENIOR_IC: 'IC',
  MANAGER: 'MANAGER',
  SR_MANAGER: 'SR_MANAGER',
  DIRECTOR: 'DIRECTOR',
  PRINCIPAL: 'DIRECTOR',
  CHIEF_OF_STAFF: 'DIRECTOR',
  SCHOOL_LEADER: 'DIRECTOR',
  HEAD: 'DIRECTOR',
  VP: 'VP',
  PARTNER: 'VP',
  EVP_SVP: 'EVP',
  C_SUITE: 'C_SUITE',
}

const BASIS_LABEL: Record<Step, string> = {
  IC: 'Individual contributor',
  MANAGER: 'Manager',
  SR_MANAGER: 'Senior manager',
  DIRECTOR: 'Director',
  VP: 'VP',
  EVP: 'SVP',
  C_SUITE: 'Executive',
}

// Each function's name in a title and the executive it reports up to.
const FUNCTION_TITLES: Record<string, { noun: string; chief: string }> = {
  Finance: { noun: 'Finance', chief: 'CFO' },
  Engineering: { noun: 'Engineering', chief: 'CTO' },
  Product: { noun: 'Product', chief: 'Chief Product Officer' },
  Design: { noun: 'Design', chief: 'Chief Product Officer' },
  Marketing: { noun: 'Marketing', chief: 'CMO' },
  Sales: { noun: 'Sales', chief: 'Chief Revenue Officer' },
  'Customer Success': { noun: 'Customer Success', chief: 'Chief Customer Officer' },
  'Human Resources': { noun: 'People', chief: 'Chief People Officer' },
  Legal: { noun: 'Legal', chief: 'General Counsel' },
  'Data & Analytics': { noun: 'Data & Analytics', chief: 'Chief Data Officer' },
  Operations: { noun: 'Operations', chief: 'COO' },
  Administration: { noun: 'Operations', chief: 'COO' },
}

// "Chief Executive Officer" / "CEO" / "President" (not "Vice President").
const TOP_JOB = /\b(chief executive|ceo|(?<!vice )(?<!vice-)president)\b/i

function titleAt(step: (typeof STEPS)[number], fn: { noun: string; chief: string } | null): string {
  switch (step) {
    case 'C_SUITE': return fn ? fn.chief : 'CEO'
    case 'VP': return fn ? `VP of ${fn.noun}` : 'VP (same department)'
    case 'DIRECTOR': return fn ? `Director of ${fn.noun}` : 'Director (same department)'
    case 'SR_MANAGER': return fn ? `Senior ${fn.noun} Manager` : 'Senior Manager (same department)'
    case 'MANAGER': return fn ? `${fn.noun} Manager` : 'Manager (same department)'
    case 'IC': return fn ? `${fn.noun} Lead` : 'Team Lead'
  }
}

/**
 * The likely hiring manager's titles for a job: same function, one and two rungs
 * above its level, most likely first. A Director of FP&A → VP of Finance, CFO.
 * A VP → the function's chief, then the CEO. An executive reports to the CEO; the
 * CEO to the board. SVP is not a separate hop (most companies skip it).
 */
export function likelyHiringManagerTitles(jobTitle: string, level?: string | null): { titles: string[]; basis: string | null } {
  const rung = (level as RungName | null | undefined) || classifyTitleRung(jobTitle).rung
  if (rung === 'BOARD') return { titles: ['Board Chair'], basis: 'Board' }
  const step = STEP_OF_RUNG[rung]
  if (!step) return { titles: [], basis: null }

  const fnName = inferFunctionFromTitle(jobTitle)
  if (step === 'C_SUITE' || fnName === 'Executive Leadership') {
    return { titles: [TOP_JOB.test(jobTitle) ? 'Board Chair' : 'CEO'], basis: 'Executive' }
  }
  const fn = fnName ? FUNCTION_TITLES[fnName] ?? null : null
  const up = step === 'EVP' ? (['C_SUITE'] as const) : STEPS.slice(STEPS.indexOf(step) + 1, STEPS.indexOf(step) + 3)
  const titles = up.map((s) => titleAt(s, fn))
  // Above the function's chief is the CEO (a VP of Finance → CFO, then CEO).
  if (up.length === 1 || up[up.length - 1] === 'C_SUITE') {
    if (fn) titles.push('CEO')
  }
  return { titles: [...new Set(titles)].slice(0, 2), basis: BASIS_LABEL[step] }
}

// ── Recruiting / HR titles to look for ──────────────────────────────────────

const SENIOR_STEPS = new Set<Step>(['DIRECTOR', 'VP', 'EVP', 'C_SUITE'])

export function recruiterTitlesFor(jobTitle: string, level?: string | null): string[] {
  const fnName = inferFunctionFromTitle(jobTitle)
  const fn = fnName ? FUNCTION_TITLES[fnName] : null
  const rung = (level as RungName | null | undefined) || classifyTitleRung(jobTitle).rung
  const senior = SENIOR_STEPS.has(STEP_OF_RUNG[rung] ?? 'IC')
  return [
    senior ? 'Executive Recruiter' : 'Talent Acquisition',
    fn ? `${fn.noun} Recruiter` : 'Recruiter',
    'HR Business Partner',
  ]
}

// ── LinkedIn people search ──────────────────────────────────────────────────

/** A plain link the member opens themselves: company + title keywords. */
export function linkedinPeopleSearchUrl(company: string, title: string): string {
  const keywords = `${company} ${title}`.replace(/\s+/g, ' ').trim()
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`
}

export function contactTargets(input: { title: string; companyName: string; level?: string | null }): {
  targets: ContactTarget[]
  basis: string | null
} {
  const hm = likelyHiringManagerTitles(input.title, input.level)
  const targets: ContactTarget[] = [
    ...recruiterTitlesFor(input.title, input.level).map((t) => ({
      kind: 'recruiter' as const,
      title: t,
      linkedinSearchUrl: linkedinPeopleSearchUrl(input.companyName, t),
    })),
    ...hm.titles.map((t) => ({
      kind: 'hiring_manager' as const,
      title: t,
      linkedinSearchUrl: linkedinPeopleSearchUrl(input.companyName, t),
    })),
  ]
  return { targets, basis: hm.basis }
}

// ── The posting's named contact ─────────────────────────────────────────────

// A source's "contact" is often a team or an office, not a person.
const NOT_A_PERSON =
  /\b(team|hr|human resources|department|dept|office|recruit\w*|talent|staffing|careers?|jobs?|hiring|district|schools?|university|college|county|city|services|admin\w*|personnel|payroll|employment|benefits|inc|llc|corp\w*|company|group|center|centre|staff|contact|posting|listed|primary|unified|public|board|association|foundation|academy|institute|system)\b/i

/** A real person's name ("Lisa Garvic"), not a team ("UCPS HR TEAM"). */
export function isPersonName(name: string | null | undefined): boolean {
  const n = name?.trim()
  if (!n || n.length > 60 || /[@\d]/.test(n) || NOT_A_PERSON.test(n)) return false
  const words = n.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return nameParts(n) !== null
}

/** "LAURA ROUSSEL" → "Laura Roussel"; mixed case is left as the source wrote it. */
export function displayPersonName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ')
  if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n
  return n.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m, sep: string, c: string) => sep + c.toUpperCase())
}

// ── The outreach note ───────────────────────────────────────────────────────

/**
 * The member's one-line headline from their own work history: "Director of FP&A at
 * Acme" — or, in Confidential Search Mode, the role alone, so a note never names the
 * current employer. Null when we know nothing to say.
 */
export function memberHeadline(input: {
  latestRole: { roleTitle: string; companyName: string; isCurrent: boolean } | null
  yearsExperience: number | null
  confidential: boolean
}): string | null {
  const r = input.latestRole
  const years = input.yearsExperience && input.yearsExperience >= 3 ? ` with ${input.yearsExperience} years of experience` : ''
  if (!r?.roleTitle.trim()) return null
  const role = r.roleTitle.trim()
  if (input.confidential) return `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}${years}`
  return `${r.isCurrent ? 'currently' : 'most recently'} ${role} at ${r.companyName.trim()}${years}`
}

export function outreachTemplate(input: {
  jobTitle: string
  companyName: string
  recipientName?: string | null
  headline: string | null
  memberFirstName: string | null
}): string {
  const first = input.recipientName ? nameParts(input.recipientName) : null
  const greeting = first ? `Hi ${first.first.charAt(0).toUpperCase()}${first.first.slice(1)},` : 'Hi,'
  const intro = input.headline ? `I'm ${input.headline}, and I` : 'I'
  return [
    greeting,
    '',
    `${intro} saw the ${input.jobTitle} opening at ${input.companyName}. I'm very interested and wanted to reach out directly rather than only apply online.`,
    '',
    `Would you have 15 minutes in the next week or two? I'd like to learn what matters most for this role and share briefly how my background fits.`,
    '',
    'Thank you,',
    input.memberFirstName?.trim() || '[Your name]',
  ].join('\n')
}
