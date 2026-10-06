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
}

export interface ScoreParts {
  contacts: number
  fit: number
  size: number
  interest: number
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

export function scoreCollege(c: ScoreInput): { score: number; parts: ScoreParts; tier: 'A' | 'B' | 'C' } {
  const notes: string[] = []

  // Contacts, up to 30: per office, a named leader with their own email 7.5,
  // a named leader 4.5, the office's general line 1.5.
  let contacts = 0
  for (const role of ['career', 'alumni', 'development', 'execEd']) {
    const c0 = c.contacts.filter((x) => x.role === role)
    const best = Math.max(0, ...c0.map((x) => (x.name ? (isPersonalEmail(x.email, x.name) && titleLeadsRole(x.title, role) ? 7.5 : 4.5) : 1.5)))
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
  const relationship = Math.max(c.relationship ? byPriority[c.relationship] ?? 0 : 0, c.dealStatus ? byDeal[c.dealStatus] ?? 0 : 0)
  if (c.relationship) notes.push(`${c.relationship} contact in the CRM`)
  if (c.dealStatus) notes.push(`Deal: ${c.dealStatus.toLowerCase().replace(/_/g, ' ')}`)

  const score = Math.round((contacts + fit + size + interest + relationship) * 10) / 10
  const base = isCommunityCollege(c) ? 'C' : score >= 60 ? 'A' : score >= 45 ? 'B' : 'C'
  const floor = relationship >= 30 ? 'A' : relationship >= 15 ? 'B' : 'C'
  const tier = (base < floor ? base : floor) as 'A' | 'B' | 'C'
  return { score, parts: { contacts, fit, size, interest, relationship, notes }, tier }
}
