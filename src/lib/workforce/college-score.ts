import { titleLeadsRole } from './college-contacts'

/**
 * Ranking colleges as pilot partners for mid-career alumni hit by layoffs
 * and AI: who to reach (contacts), whether their alumni are the people this
 * is for (fit), whether there are enough of them without the college being
 * one that runs everything itself (size), and whether the college is
 * already talking about it (interest). Every part is shown, so a rank can
 * always be explained.
 */

/** Themes a college raises on its own office pages — listed phrases, not inference. */
export const INTEREST_THEMES = {
  ai: { label: 'AI', re: /\b(artificial intelligence|generative ai|\bAI\b (skills|literacy|tools|certificate|bootcamp|course|program|workforce|ready|readiness|in the workplace)|machine learning|ChatGPT)\b/i },
  reskilling: { label: 'Reskilling', re: /\b(reskill(ing)?|upskill(ing)?|retrain(ing)?|career (change|changers?|pivot|transition)|mid-?career|returning adults?|adult learners?|career switchers?)\b/i },
  alumniCareers: { label: 'Alumni career help', re: /\b(alumni (career|job|professional) (services|support|coaching|resources|network|advising)|career (services|coaching|support|advising|resources) (for|to) (alumni|graduates)|lifetime career|alumni (can|may) (use|access|schedule|meet))\b/i },
  lifelong: { label: 'Lifelong learning', re: /\b(lifelong learning|micro-?credentials?|professional certificates?|continuing education|non-?credit|stackable credentials?|workforce (training|education|development))\b/i },
  execEd: { label: 'Executive education', re: /\b(executive education|executive (certificate|program|leadership program)s?|custom(ized)? corporate (training|programs?)|corporate (training|education|partnerships?))\b/i },
} as const
export type InterestTheme = keyof typeof INTEREST_THEMES

export function interestSignals(texts: string[]): InterestTheme[] {
  const all = texts.join('\n')
  return (Object.keys(INTEREST_THEMES) as InterestTheme[]).filter((t) => INTEREST_THEMES[t].re.test(all))
}

/** Associate's colleges and two-year special focus — community colleges, whatever their sector says. */
export function isCommunityCollege(c: { carnegie: number | null; sector: number | null }): boolean {
  if (c.carnegie != null) return c.carnegie <= 14
  return c.sector != null && c.sector >= 4
}

/** Generic inboxes and office aliases — not a person you can write to. */
const GENERIC_LOCAL = /^(info|office|contact|hello|team|staff|admin|help|support|career|careers|careercenter|careerservices|career\.services|ccd|alumni|alumniassoc|alumnirelations|giving|give|gift|gifts|donate|foundation|advancement|development|devoffice|ce|conted|continuinged|continuing|pace|execed|exec\.ed|workforce|training|admissions|registrar|events?|news|web|marketing|vp|president|advancementvp|[a-z]+vp|[a-z]*office|[a-z]*center)$/i

/**
 * A person's own address: not an office alias, and built from their name
 * (first or last name, or an initial and the last name).
 */
export function isPersonalEmail(email: string | null, name: string | null): boolean {
  if (!email || !name) return false
  const local = email.split('@')[0].toLowerCase()
  if (GENERIC_LOCAL.test(local)) return false
  const parts = name
    // Credentials and class years after a comma, honorifics before the name.
    .split(',')[0]
    .replace(/\b(dr|mr|mrs|ms|mx|prof|rev|jr|sr|ii|iii)\b\.?/gi, ' ')
    .replace(/\b[A-Z]?'\d{2}\b/g, ' ')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/).filter((p) => p.length >= 2)
  if (!parts.length) return false
  const first = parts[0]
  const last = parts[parts.length - 1]
  const flat = local.replace(/[^a-z]/g, '')
  // Initials and a number ("dc114") is a personal account too.
  const initials = new RegExp(`^${first[0]}[a-z]?${last[0]}\\d+$`)
  return flat.includes(last) || (first.length >= 3 && flat.includes(first)) || flat.startsWith(first[0] + last.slice(0, 4)) || initials.test(local)
}

export interface ScoreInput {
  sector: number | null
  carnegie: number | null
  size: number | null
  admitRate: number | null
  interestSignals: string[]
  contacts: { role: string; name: string | null; title: string | null; email: string | null }[]
  /** WARN-filed jobs lost in the last year across the boards that serve the college's county. */
  areaJobsLost: number
  /** The highest priority of anyone in the CRM at the college. */
  relationship?: 'P0' | 'P1' | 'P2' | null
  /** The college's deal status in the CRM. */
  dealStatus?: string | null
  /**
   * The strongest contact we have at the college, whatever their priority or
   * role: 'hot' (HOT warmth), 'warm' (WARM warmth or a first-degree connection),
   * 'any' (someone in the CRM works there).
   */
  contactStrength?: ContactStrength | null
  /**
   * Facts from CollegeProfile (alumni, budget, outcomes, programs). When given,
   * they fill the last 20 of the 100. Left out, the other four parts (80) are
   * scaled to 100, so tier cut-offs keep their meaning.
   */
  profile?: CollegeFacts | null
}

export type { ContactStrength } from '@/lib/crm/contact-strength'
import type { ContactStrength } from '@/lib/crm/contact-strength'
/** What a contact is worth, outside the 100: a warm one helps a lot, any one helps a little. */
export const CONTACT_POINTS: Record<ContactStrength, number> = { hot: 25, warm: 20, any: 5 }

export interface CollegeFacts {
  /** Reported alumni, else the estimate from annual degrees. */
  alumni: number | null
  expenses: number | null
  endowment: number | null
  privateGifts: number | null
  earnings10: number | null
  employedShare10: number | null
  hasExecEd: boolean | null
  hasRetraining: boolean | null
}

export interface ScoreParts {
  contacts: number
  fit: number
  size: number
  interest: number
  /** Alumni base, budget and giving, graduate outcomes, programs: up to 20 (0 when no facts). */
  profile?: number
  /** Added for an existing relationship or deal, outside the 100. */
  relationship: number
  notes: string[]
}

/** Carnegie class → how likely the alumni are white-collar, mid-career professionals. */
function programFit(carnegie: number | null, sector: number | null): number {
  if (carnegie == null) return sector === 1 || sector === 2 ? 12 : 0
  if (carnegie >= 15 && carnegie <= 20) return 20 // doctoral and master's universities
  if (carnegie === 29) return 18 // business and management schools
  if (carnegie === 21 || carnegie === 22 || carnegie === 27 || carnegie === 28) return 14 // baccalaureate, engineering and technology
  if (carnegie === 23) return 6 // mixed baccalaureate/associate's
  if (carnegie <= 14) return 0 // community colleges
  return 5 // faith, medical, arts, law and other special focus
}


const logFrac = (v: number | null | undefined, lo: number, hi: number): number | null =>
  v == null || !(v > 0) ? null : Math.min(1, Math.max(0, (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))))

/**
 * The college's own facts, up to 20: alumni base 8 (more graduates is a bigger
 * pool of people who will need this), money to act with 6 (budget, endowment,
 * private gifts), weak graduate outcomes 2 (an opening for career help), an
 * executive-education arm 3 and a retraining arm 1 (already sells to working
 * adults). Retraining is worth less because researched colleges answered yes
 * about 90% of the time, so it barely separates them; the executive-education
 * flag also counts executive-format degrees such as an Executive MBA. A fact we do not have scores a neutral 40% of its share and
 * is listed in the notes, so an unresearched college never beats a researched
 * one on ignorance alone.
 */
export function profilePart(f: CollegeFacts, notes: string[]): number {
  const N = 0.4
  const alumni = logFrac(f.alumni, 2_000, 300_000)
  const money = (() => {
    const e = logFrac(f.expenses, 10e6, 3e9), en = logFrac(f.endowment, 1e6, 10e9), g = logFrac(f.privateGifts, 1e6, 1e9)
    return e === null && en === null && g === null ? null : 0.6 * (e ?? 0.3) + 0.25 * (en ?? 0.2) + 0.15 * (g ?? 0.2)
  })()
  const gap = f.employedShare10 == null ? null : 1 - Math.min(1, Math.max(0, (f.employedShare10 - 0.6) / 0.3))
  const flag = (v: boolean | null) => (v == null ? N : v ? 1 : 0)
  if (f.alumni) notes.push(`${f.alumni.toLocaleString()} alumni (estimated unless reported)`)
  if (f.hasExecEd) notes.push('Has an executive-education program')
  if (f.hasRetraining) notes.push('Runs retraining programs')
  if (f.employedShare10 != null && gap !== null && gap > 0.6) notes.push(`Only ${Math.round(f.employedShare10 * 100)}% of entrants working at 10 years`)
  return Math.round((8 * (alumni ?? N) + 6 * (money ?? N) + 2 * (gap ?? N) + 3 * flag(f.hasExecEd) + 1 * flag(f.hasRetraining)) * 10) / 10
}

export function scoreCollege(c: ScoreInput): { score: number; parts: ScoreParts; tier: 'A' | 'B' | 'C' } {
  const notes: string[] = []

  // Contact details, up to 10 ("any contact helps a little"; a warm contact in
  // the CRM is worth 20-25 on its own, below): per office, a named leader with
  // their own email 2.5, a named leader 1.5, the office's general line 0.5.
  let contacts = 0
  for (const role of ['career', 'alumni', 'development', 'execEd']) {
    const c0 = c.contacts.filter((x) => x.role === role)
    const best = Math.max(0, ...c0.map((x) => (x.name ? (isPersonalEmail(x.email, x.name) && titleLeadsRole(x.title, role) ? 2.5 : 1.5) : 0.5)))
    contacts += best
  }

  // Fit, up to 30: the kind of college (20) and layoffs around it (10).
  let fit = programFit(c.carnegie, c.sector)
  const area = c.areaJobsLost > 0 ? Math.min(10, Math.round(Math.log10(c.areaJobsLost) * 3 * 10) / 10) : 0
  fit += area
  if (isCommunityCollege(c)) notes.push('Community college')
  if (c.areaJobsLost > 0) notes.push(`${c.areaJobsLost.toLocaleString()} jobs in WARN filings nearby in the last year`)

  // Size, up to 20: 5,000–20,000 students is the sweet spot; very selective
  // schools lose most of it — they run their own alumni career programs.
  const bySize: Record<number, number> = { 1: 3, 2: 10, 3: 18, 4: 20, 5: 15 }
  let size = c.size ? bySize[c.size] ?? 0 : 0
  if (c.admitRate != null && c.admitRate < 0.15) { size = Math.max(0, size - 15); notes.push(`Very selective (${Math.round(c.admitRate * 100)}% admitted)`) }
  else if (c.admitRate != null && c.admitRate < 0.3) { size = Math.max(0, size - 8); notes.push(`Selective (${Math.round(c.admitRate * 100)}% admitted)`) }

  // Interest, up to 20: what its own pages talk about.
  const weights: Record<string, number> = { ai: 6, reskilling: 5, alumniCareers: 5, lifelong: 2, execEd: 2 }
  const interest = Math.min(20, c.interestSignals.reduce((s, t) => s + (weights[t] ?? 0), 0))

  // Relationship: someone you have already prioritized there, or a live
  // deal, outranks anything the public data says. P0 and P1 contacts and
  // live deals put the college in tier A; a P2 contact or first contact, in B
  // at least — community colleges included, since you chose them.
  const byPriority: Record<string, number> = { P0: 40, P1: 30, P2: 15 }
  const byDeal: Record<string, number> = { CUSTOMER: 40, PILOT: 40, PROPOSAL: 30, IN_CONVERSATION: 30, CONTACTED: 15, PROSPECT: 5 }
  const byContact = c.contactStrength ? CONTACT_POINTS[c.contactStrength] : 0
  const relationship = Math.max(c.relationship ? byPriority[c.relationship] ?? 0 : 0, c.dealStatus ? byDeal[c.dealStatus] ?? 0 : 0, byContact)
  if (c.contactStrength === 'hot' || c.contactStrength === 'warm') notes.push('Warm contact in the CRM')
  else if (c.contactStrength === 'any') notes.push('A contact in the CRM')
  if (c.relationship) notes.push(`${c.relationship} contact in the CRM`)
  if (c.dealStatus) notes.push(`Deal: ${c.dealStatus.toLowerCase().replace(/_/g, ' ')}`)

  // Contacts 10 + fit 30 + size 20 + interest 20 = 80; the profile part is the
  // other 20. With no facts for the college, scale the 80 to the same 100.
  const profile = c.profile ? profilePart(c.profile, notes) : 0
  const body = contacts + fit + size + interest
  const score = Math.round(((c.profile ? body + profile : (body * 100) / 80) + relationship) * 10) / 10
  // Cut-offs sit at 66 and 52 (they were 60 and 45 before the facts part was added
  // and the contact details part cut from 30 to 10, which moved the scale up by
  // about 7 points); on today's data that keeps the same number of A and B colleges.
  const base = isCommunityCollege(c) ? 'C' : score >= 66 ? 'A' : score >= 52 ? 'B' : 'C'
  const floor = relationship >= 30 ? 'A' : relationship >= 15 ? 'B' : 'C'
  const tier = (base < floor ? base : floor) as 'A' | 'B' | 'C'
  return { score, parts: { contacts, fit, size, interest, ...(c.profile ? { profile } : {}), relationship, notes }, tier }
}
