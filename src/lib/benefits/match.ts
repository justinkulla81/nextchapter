// Which funding programs fit a member, best first. Pure and client-safe: the page loads the rows and the
// member's facts, this decides what to show and in what order.
//
// The rule is an allowlist (see feedback "allowlist not blanket rules"). A row is shown only when every
// gate positively passes: it is verified against an official page, it is not closed, its place fits, and
// any audience it is written for is one the member holds. A row whose audience we cannot read is hidden,
// never shown "just in case".

import { US_STATES } from '@/lib/constants/us-states'
import type { BenefitCategory, BenefitProgramRow } from './types'

export type AudienceTag =
  | 'federal' | 'veteran' | 'military_spouse' | 'educator' | 'clinician' | 'lawyer' | 'tech' | 'finance'
  | 'journalist' | 'age40' | 'age50' | 'disabled' | 'immigrant' | 'reentry' | 'rural' | 'entrepreneur'
  | 'returner' | 'student'

/** What a member can say about themselves. Optional, private, and only used to match. */
export const SELF_TAGS: { tag: AudienceTag; label: string }[] = [
  { tag: 'veteran', label: 'I served in the military' },
  { tag: 'military_spouse', label: 'I am a military spouse' },
  { tag: 'federal', label: 'I work or worked for the federal government or a federal contractor' },
  { tag: 'age50', label: 'I am 50 or older' },
  { tag: 'disabled', label: 'I have a disability' },
  { tag: 'immigrant', label: 'I am an immigrant or refugee' },
  { tag: 'reentry', label: 'I have a criminal record' },
  { tag: 'rural', label: 'I live in a rural area' },
  { tag: 'entrepreneur', label: 'I want to start a business' },
  { tag: 'returner', label: 'I am returning after a career break or caregiving' },
  { tag: 'student', label: 'I am a student or recent graduate' },
]
const SELF_TAG_SET = new Set<string>(SELF_TAGS.map((t) => t.tag))
export const cleanSelfTags = (v: unknown): AudienceTag[] =>
  Array.isArray(v) ? [...new Set(v.filter((t): t is AudienceTag => typeof t === 'string' && SELF_TAG_SET.has(t)))] : []

/** Pieces of a segment string, then the tags one piece needs. */
const GENERAL = /career changers?|region workforce|workers\/states|^all laid-off|^laid-off$/i

function pieceTags(piece: string): Set<AudienceTag | 'employer'> | null {
  const p = piece.trim()
  if (!p) return null
  const t = new Set<AudienceTag | 'employer'>()
  if (/\bemployers?\b|fair chance|hiring bills/i.test(p)) t.add('employer')
  if (/\bfed(eral)?\b|usaid|\brif\b|contractor/i.test(p)) t.add('federal')
  if (/spouse/i.test(p)) t.add('military_spouse')
  else if (/\bvets?\b|veterans?|military|\bmil\b|enlisted|service members?/i.test(p)) t.add('veteran')
  if (/teachers?|educators?|education students|school/i.test(p)) t.add('educator')
  if (/clinicians?|nurs|\brns?\b|aprn|physicians?|health|behavioral|doctors?/i.test(p)) t.add('clinician')
  if (/lawyers?|attorneys?|defenders|prosecutors|legal/i.test(p)) t.add('lawyer')
  if (/\btech\b|\bai\b|ai-exposed|software/i.test(p)) t.add('tech')
  if (/financ|securities/i.test(p)) t.add('finance')
  if (/journalists?|\bnews\b|media/i.test(p)) t.add('journalist')
  if (/\b(50|55)\+/.test(p)) t.add('age50')
  else if (/\b40\+/.test(p)) t.add('age40')
  if (/disab|ssdi|\bssi\b/i.test(p)) t.add('disabled')
  if (/immigrant|refugee|asylee|foreign|internationally|wes global|work-authorized/i.test(p)) t.add('immigrant')
  if (/reentry|second chance/i.test(p)) t.add('reentry')
  if (/\brural\b/i.test(p)) t.add('rural')
  if (/entrepreneur/i.test(p)) t.add('entrepreneur')
  if (/returner|returning|career-break|caregiver/i.test(p)) t.add('returner')
  if (/students?|grads?\b/i.test(p)) t.add('student')
  return t.size ? t : null
}

export type Audience =
  | { kind: 'general' }
  | { kind: 'unreadable' }
  /** Satisfied by holding ANY of these sets; a set needs ALL of its tags. */
  | { kind: 'tags'; options: AudienceTag[][] }

export function audienceOf(segments: string[]): Audience {
  if (segments.length === 0) return { kind: 'general' }
  const options: AudienceTag[][] = []
  for (const seg of segments) {
    if (GENERAL.test(seg.trim())) return { kind: 'general' }
    for (const piece of seg.split(/[/,]|\band\b/i)) {
      const tags = pieceTags(piece)
      if (!tags) continue
      if (tags.has('employer')) continue // for the employer, not the member
      options.push([...tags] as AudienceTag[])
    }
  }
  return options.length ? { kind: 'tags', options } : { kind: 'unreadable' }
}

const age40Implied = (held: Set<AudienceTag>) => held.has('age50') && held.add('age40')

/** The tags a member's work history implies, so a nurse is not asked whether they are a clinician. */
export function deriveWorkTags(p: { primaryFunction?: string | null; industryContext?: string | null; industryBucket?: string | null; targetFunction?: string | null }): AudienceTag[] {
  const text = [p.primaryFunction, p.industryContext, p.industryBucket, p.targetFunction].filter(Boolean).join(' | ')
  const out: AudienceTag[] = []
  if (/teach|educat|school|universit|higher ed/i.test(text)) out.push('educator')
  if (/health|clinic|nurs|physician|medical|hospital|pharma/i.test(text)) out.push('clinician')
  if (/\blegal\b|\blaw\b|attorney|counsel/i.test(text)) out.push('lawyer')
  if (/\btech|software|engineer|data|\bai\b|\bit\b|product/i.test(text)) out.push('tech')
  if (/financ|bank|account|invest|insurance/i.test(text)) out.push('finance')
  if (/journal|media|news|editor|publishing/i.test(text)) out.push('journalist')
  return out
}

export type Goal = 'move' | 'retrain' | 'tax' | 'learn'
/** Real money first, free learning last. */
export const GOAL_ORDER: Goal[] = ['move', 'retrain', 'tax', 'learn']
export const GOAL_OF: Record<BenefitCategory, Goal> = {
  RELOCATION: 'move',
  STATE_TRAINING: 'retrain',
  FEDERAL: 'retrain',
  PRIVATE: 'retrain',
  SEGMENT: 'retrain',
  PAID: 'retrain',
  TAX: 'tax',
  COURSES: 'learn',
}
export const GOAL_LABEL: Record<Goal, { title: string; blurb: string }> = {
  move: { title: 'Money to move', blurb: 'Relocation grants, home-buying help and moving incentives.' },
  retrain: { title: 'Tuition and training money', blurb: 'Real dollars toward tuition, training and your next credential.' },
  tax: { title: 'Tax credits and deductions', blurb: 'Money back at tax time that a job change can unlock.' },
  learn: { title: 'Free courses', blurb: 'Learning that costs nothing. Useful, but not money in your pocket.' },
}

export interface MemberFacts {
  /** Two-letter state they live in. */
  state: string | null
  relocation: { scope: 'LOCAL' | 'RADIUS' | 'STATES' | 'ANYWHERE'; states: string[] }
  laidOff: boolean
  pivoting: boolean
  /** Self-declared plus implied by work history. */
  tags: AudienceTag[]
}

export interface Match {
  program: BenefitProgramRow
  goal: Goal
  score: number
  /** One plain sentence on why this is shown to this member. */
  why: string
  amount: number | null
}

const US_STATE = /^[A-Z]{2}$/

/**
 * Some catalog rows carry no segment but are plainly for one group (the GI Bill is for veterans) or are
 * not a job-transition benefit at all (a food bank, the Child Tax Credit, a research fund). Those are
 * decided here by name, because the free-text segment column is blank for them.
 */
const NOT_FOR_THIS_PAGE =
  /rapid response|child tax credit|child and dependent|relocation incentive act|liheap|trump accounts|food bank|\b988\b|\bnami\b|open path|mental health|lawhelp|legal services|warn act|layoffs\.fyi|trueup|united way|catholic charities|emergency grants|self-sufficiency|rx kids|givedirectly|abundant birth|guaranteed income|f4gi|bonding program|work share|short-time|pslf employer|job accommodation|openai foundation|anthropic economic|^[a-z]\d{3,5}\b|executive order|wage-insurance|state pilot bill|entertainment community|motion picture|sag-aftra|authors league|aicpa|dress for success|appalachian regional|^\d+$/i
// A row filed as nationwide whose name is one state's program (the catalog has a few) is not nationwide.
const STATE_NAMED = new RegExp(`\\b(${US_STATES.filter((x) => x.code !== 'DC').map((x) => x.name).join('|')})\\b`, 'i')
/**
 * Training money is often paid to employers or is a directory, not something a member can claim. A
 * state-training, federal or private row is shown only when its own text says it pays a person (tuition,
 * a scholarship, free classes, an individual training account) and does not say it pays a business.
 */
const PAYS_THE_PERSON = /tuition|scholarship|\bfree\b|dislocated worker|individual training|\bita\b|training expenses|financial assistance|promise|last-dollar|paid training|per credential|certificate programs|reconnect|stipend|upskill|apprenticeship|career training|training for/i
const PAYS_A_BUSINESS = /\bemployers? (relocating|hiring)|sponsors?\b|states, tribes|local boards|industry partnerships?|young adults|\byouth\b|techcred|on-the-job|\bojt\b|incumbent worker|reimburses? employers?|employer (training |reimbursement|grant)|customized (workforce )?training|skills development fund|self-sufficiency fund|small business|for new and expanding|sector partnership|training panel|eligible training provider|\bdirectory\b|policy framework|case management|\bresea\b|job-search platform|job search platform|grant opportunities page|financial aid page|\bunemployment insurance\b|work-search|free advising|lists? providers?|not a payment/i
function memberFacing(r: BenefitProgramRow): boolean {
  const text = `${r.name} | ${r.amount ?? ''} | ${r.eligibility ?? ''}`
  if (PAYS_A_BUSINESS.test(text)) return false
  // Relocation rows are allowlisted: the catalog files some scholarships, training and aid for people in
  // crisis under "relocation". A row stays only if its own text is about moving or buying a home, it names
  // who it is for, and that is not one employer's staff, existing residents or a group in crisis.
  if (r.category === 'RELOCATION') {
    const el = (r.eligibility ?? '').trim()
    if (el.length < 12) return false
    if (!/down payment|closing cost|homebuyer|home buyer|first-time buyer|homeownership|\bbuyer|relocat|remote worker|remote (job|work)|\bmov(e|ing)\b|new residents?|newcomers?|student loan/i.test(`${r.name} | ${r.amount ?? ''} | ${el}`)) return false
    if (/homeless|developer|employees?\b|county government|scholar|adult learners|college|basic income|training|income support/i.test(el)) return false
    if (/\bresidents?\b/i.test(el) && !/non-?residents|new residents|relocat|\bmov(e|ing)\b|newcomers/i.test(el)) return false
  }
  if (r.category === 'PAID') return !/leave|family|medical|insurance|\bpaid sick/i.test(text) && /returnship|paid (training|program|internship|apprentice)|stipend|fellowship|apprenticeship/i.test(text)
  // A course is listed as free only if its own amount line is free with no price in it.
  if (r.category === 'COURSES') {
    const a = r.amount ?? ''
    return !/\$\s?\d|paid|\bpro\b|tier|trial|shown|start free|freemium|premium|\bplus\b|\*|discount|aid/i.test(a) && /free|no cost|tuition-free/i.test(a)
  }
  if (r.category === 'TAX') return true
  if (r.category === 'STATE_TRAINING' || r.category === 'FEDERAL' || r.category === 'PRIVATE') return PAYS_THE_PERSON.test(text)
  return true
}
/** A program tied to one employer is for that employer's staff. */
const eligibleKind = (r: BenefitProgramRow) => !r.employer && !r.employerKey

const NAME_AUDIENCE: [RegExp, AudienceTag][] = [
  [/\bva\b|gi bill|vet tec|hire heroes|ascend heroes|veterans?\b|military|soldiers|operation homefront|choose topeka|hiring our heroes|vr&e/i, 'veteran'],
  [/\bsba\b|sbdc|microloan|business center|amber grant|kiva|liftfund|grameen|fedex small|ifundwomen|cartier/i, 'entrepreneur'],
  [/ticket to work|disability:in|workforce recruitment/i, 'disabled'],
  [/scsep/i, 'age50'],
  [/40plus/i, 'age40'],
  [/upwardly global|wes global|refugee employment/i, 'immigrant'],
  [/path forward|irelaunch/i, 'returner'],
  [/teacher|teach grant|teach for america/i, 'educator'],
  [/nurse|indian health|medical licensure/i, 'clinician'],
]

export function parseAmount(text: string | null): number | null {
  if (!text) return null
  const m = text.match(/\$\s?([\d,]+(?:\.\d+)?)(\s?[kK]\b)?/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return m[2] ? n * 1000 : n
}

/** The gates. Returns why the row fits, or null to hide it. */
function fits(r: BenefitProgramRow, m: MemberFacts, held: Set<AudienceTag>): { place: string; specific: boolean } | null {
  if (!r.verified || !r.url || r.status === 'CLOSED') return null
  if (!eligibleKind(r) || NOT_FOR_THIS_PAGE.test(r.name.trim()) || !memberFacing(r)) return null
  const goal = GOAL_OF[r.category]
  const rowState = r.state && US_STATE.test(r.state) ? r.state : null

  let place: string
  if (r.scope === 'NATIONAL') {
    // Filed as nationwide but written for one state ("Job seekers in California"): not nationwide.
    if (STATE_NAMED.test(r.name) || STATE_NAMED.test(r.eligibility ?? '')) return null
    place = r.category === 'TAX' ? 'A federal tax rule, subject to the limits below' : 'Anyone can use it, in any state'
  } else if (!rowState) {
    return null
  } else if (goal === 'move') {
    // Money for moving INTO a state: fits only a state they would move to.
    if (m.relocation.scope === 'STATES' && m.relocation.states.includes(rowState)) place = `You said you would move to ${rowState}`
    else if (m.relocation.scope === 'ANYWHERE') place = `You said you would move anywhere, and ${rowState} pays`
    else if (m.state === rowState && m.relocation.scope === 'RADIUS') place = `In your state, ${rowState}`
    else return null
  } else {
    // Money for residents: fits only the state they live in.
    if (!m.state || m.state !== rowState) return null
    place = `You live in ${rowState}`
  }

  // Veteran-only by name and the like: every tag the name implies must be held.
  const named = NAME_AUDIENCE.filter(([re]) => re.test(r.name)).map(([, t]) => t)
  if (named.some((t) => !held.has(t))) return null
  // A relocation row that says veterans in its eligibility needs the veteran tag, like a segment would.
  if (goal === 'move' && /veterans?/i.test(r.eligibility ?? '') && !held.has('veteran')) return null
  const a = audienceOf(r.segments)
  if (a.kind === 'unreadable') return null
  if (a.kind === 'general' && named.length > 0) return { place, specific: true }
  if (a.kind === 'tags') {
    const ok = a.options.some((opt) => opt.every((t) => held.has(t)))
    if (!ok) return null
    return { place, specific: true }
  }
  return { place, specific: false }
}

export function matchPrograms(rows: BenefitProgramRow[], m: MemberFacts): Match[] {
  const held = new Set<AudienceTag>(m.tags)
  age40Implied(held)
  const out: Match[] = []
  for (const r of rows) {
    const f = fits(r, m, held)
    if (!f) continue
    const goal = GOAL_OF[r.category]
    const amount = parseAmount(r.amount)
    let score = 50
    let why = f.place
    if (r.scope === 'STATE' && goal !== 'move') score += 20
    if (r.scope === 'STATE' && goal === 'move') score += m.relocation.scope === 'STATES' ? 18 : 6
    if (f.specific) {
      score += 25
      why = `Built for people like you. ${f.place}.`
    }
    if (r.status === 'OPEN' || r.status === 'ROLLING') score += 12
    if (goal === 'retrain' && (m.pivoting || m.laidOff)) score += 8
    if (goal === 'move' && m.relocation.scope !== 'LOCAL') score += 6
    if (amount !== null) score += amount >= 50000 ? 16 : amount >= 10000 ? 12 : amount >= 2500 ? 7 : 3
    // Real dollars always list above free learning.
    if (goal === 'learn') score -= 60
    else score += 10
    out.push({ program: r, goal, score, why, amount })
  }
  out.sort((a, b) => b.score - a.score || (b.amount ?? 0) - (a.amount ?? 0) || a.program.name.localeCompare(b.program.name))
  // The same program is filed under two categories in places (Google certificates, SCSEP): keep the best.
  const seen = new Set<string>()
  return out.filter((x) => {
    const k = x.program.name.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Best first within each goal, at most `per` of each plus a count of the rest. */
export function groupByGoal(matches: Match[]): Record<Goal, Match[]> {
  const g: Record<Goal, Match[]> = { move: [], retrain: [], tax: [], learn: [] }
  for (const x of matches) g[x.goal].push(x)
  return g
}

/** A real program a person can claim: verified, open, aimed at a person, and with an audience we can read. */
export function isMemberProgram(r: BenefitProgramRow): boolean {
  if (!r.verified || !r.url || r.status === 'CLOSED') return false
  if (!eligibleKind(r) || NOT_FOR_THIS_PAGE.test(r.name.trim()) || !memberFacing(r)) return false
  if (r.scope === 'NATIONAL' && (STATE_NAMED.test(r.name) || STATE_NAMED.test(r.eligibility ?? ''))) return false
  return audienceOf(r.segments).kind !== 'unreadable'
}

/** A row safe to name in public: a member program with no audience restriction. */
export function publicShowable(r: BenefitProgramRow): boolean {
  return isMemberProgram(r) && audienceOf(r.segments).kind === 'general' && !NAME_AUDIENCE.some(([re]) => re.test(r.name))
}
