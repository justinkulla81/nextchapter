/**
 * What counts as relevant, and how a federal notice becomes a CRM lead.
 *
 * Pure functions only — no network, no database — so the rules can be tested
 * and so the two sources (Grants.gov, SAM.gov) cannot drift apart.
 */
import type { P0Lead } from '@/lib/crm/p0-leads-parse'
import type { ApplicantKind, Eligibility } from './eligibility'

/**
 * Grants.gov full-text keywords, one search each. An explicit list: adding a
 * subject is adding a line. Grants.gov ORs nothing, so each is its own request.
 */
export const GRANT_KEYWORDS = [
  'dislocated worker',
  'reemployment',
  'outplacement',
  'rapid response',
  'career services',
  'job placement',
  'workforce development',
  'career coaching',
  'layoff aversion',
  'worker transition',
] as const

/**
 * SAM.gov NAICS codes searched, one request each — the public API key is
 * rationed (10 requests a day without a SAM role), so this is a short list and
 * the keyword filter below does the narrowing locally.
 */
export const SAM_NAICS = [
  '561311', // Employment placement agencies
  '541612', // Human resources consulting
  '611430', // Professional and management development training
  '541611', // Administrative management consulting
] as const

/** A notice title that names our subject. Allowlist, not "everything except". */
const TITLE_SIGNALS: [RegExp, number][] = [
  [/outplacement/i, 5],
  [/dislocated worker|displaced worker|laid.?off|layoff|rapid response|reemployment|re-employment/i, 4],
  [/career (transition|coaching|services|navigation|counsel)/i, 4],
  [/job (placement|search|matching|readiness|training)/i, 3],
  [/workforce (development|innovation|system|board|services|technology)|WIOA/i, 3],
  [/employment (services|assistance|and training)|reentry|re-entry/i, 2],
  [/resume|talent (pipeline|acquisition)|upskill|reskill|apprentice/i, 2],
]

/** Score a notice title: 0 means leave it out. */
export function titleScore(title: string): number {
  return TITLE_SIGNALS.reduce((sum, [re, w]) => (re.test(title) ? sum + w : sum), 0)
}

export type NoticeKind = 'GRANT' | 'FORECAST' | 'RFP' | 'RFI' | 'PRESOLICITATION'

export interface FundingNotice {
  source: 'grants.gov' | 'sam.gov'
  /** Stable per notice; keys the dedupe. */
  id: string
  title: string
  kind: NoticeKind
  /** Issuing organization, display form. */
  agency: string
  agencyType: 'GOVERNMENT' | 'FUNDER_GRANT'
  postedAt: Date | null
  closesAt: Date | null
  url: string
  state: string | null
  city: string | null
  /** Subjects that matched: the keyword searches that returned it, or title signals. */
  matched: string[]
  /** Issuer's agency code where the source gives one (Grants.gov: "DOL-ETA"). */
  agencyCode?: string
  /** The source's own record id (Grants.gov numeric id) where it differs from `id`. */
  externalId?: string
  /** Set once the notice has been read for eligibility; absent means not yet classified. */
  eligibility?: Eligibility
  applicantKinds?: ApplicantKind[]
  partnerKinds?: ApplicantKind[]
  eligibilityNote?: string
  awardCeiling?: number | null
  /** States applicants are restricted to, read from the eligibility prose; absent/empty = nationwide. */
  states?: string[]
  contact: { fullName: string; title: string | null; email: string | null; phone: string | null } | null
}

/**
 * Who can win it. A grant is awarded to states, workforce boards, colleges and
 * nonprofits — our customers and partners — so we file it as one for them to
 * win and a reason to call them. A solicitation or RFI is ours to bid on.
 */
export type Audience = 'CUSTOMERS' | 'US'

export function audienceOf(kind: NoticeKind): Audience {
  return kind === 'GRANT' || kind === 'FORECAST' ? 'CUSTOMERS' : 'US'
}

const ELIGIBILITY_TAG: Record<Eligibility, string> = {
  DIRECT: 'we can apply',
  VIA_PARTNER: 'via partner',
  NOT_ELIGIBLE: 'not eligible',
  UNKNOWN: 'eligibility unconfirmed',
}

const AUDIENCE_TAG: Record<Audience, string> = {
  CUSTOMERS: 'For customers to win',
  US: 'For us to bid',
}

const KIND_LABEL: Record<NoticeKind, string> = {
  GRANT: 'Grant open',
  FORECAST: 'Grant forecast',
  RFP: 'Solicitation',
  RFI: 'Sources sought / RFI',
  PRESOLICITATION: 'Presolicitation',
}

/** MM/DD/YYYY, as both federal APIs print dates. */
export function parseUsDate(s: unknown): Date | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s.trim())
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]))
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim())
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Guidance letters, planning targets and the like: published by the same
 * agencies as the grants, but nothing anyone applies to.
 */
const NOT_AN_OPPORTUNITY = /guidance letter|\bTEGL\b|\bTEN\b\s*\d|\bUIPL\b|resource planning|planning targets|targets and guidelines/i

/** A title must name the subject strongly unless the Labor Department issued it. */
const MIN_TITLE_SCORE = 4

/**
 * Relevant means: not a guidance document, and either the Department of Labor
 * issued it (its grants are on-subject by construction) or the title names the
 * subject strongly. One bare "workforce development" is not enough — it is how an
 * EPA water grant gets in. Grants.gov's full-text search is loose too (an NIH
 * pain-management grant "matches" dislocated worker), so a hit returned by
 * several keywords is not evidence of anything.
 */
export function isRelevant(n: Pick<FundingNotice, 'title' | 'agencyCode'>): boolean {
  if (NOT_AN_OPPORTUNITY.test(n.title)) return false
  if (/^DOL(-|$)/i.test(n.agencyCode ?? '')) return true
  return titleScore(n.title) >= MIN_TITLE_SCORE
}

/**
 * Open means open: a notice with a future close date stays live however long ago
 * it was posted, so the first run picks up everything currently accepting
 * applications. With no close date, only a recent posting counts.
 */
export function isLive(n: Pick<FundingNotice, 'postedAt' | 'closesAt'>, now: Date, lookbackDays: number): boolean {
  if (n.closesAt) return n.closesAt.getTime() >= now.getTime() - 86_400_000
  return !n.postedAt || n.postedAt.getTime() >= now.getTime() - lookbackDays * 86_400_000
}

/** Grants.gov's "close date" of years out is a standing guidance page, not a deadline worth a task. */
export function meaningfulDeadline(n: Pick<FundingNotice, 'closesAt'>, now: Date): Date | null {
  if (!n.closesAt) return null
  return n.closesAt.getTime() - now.getTime() > 2 * 365 * 86_400_000 ? null : n.closesAt
}

/** "LABOR, DEPARTMENT OF.EMPLOYMENT AND TRAINING ADMINISTRATION.REGION 4" → readable two-level name. */
export function agencyFromSamPath(path: string): string {
  const title = (s: string) =>
    s.toLowerCase().replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
      .replace(/\b(Of|The|And|For)\b/g, (w) => w.toLowerCase())
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean)
  const top = parts[0] ?? ''
  const dept = /^(.*),\s*(DEPARTMENT|DEPT\.?) OF(?: THE)?$/i.exec(top)
  const topName = dept ? `Department of ${title(dept[1])}` : title(top)
  const sub = parts[1] ? title(parts[1]) : ''
  return [topName, sub].filter(Boolean).join(' — ') || 'Federal agency'
}

/** One notice as a CRM lead. Informational: p0 stays false so it is recorded, not tiered. */
export function toLead(n: FundingNotice, now: Date): P0Lead {
  const deadline = meaningfulDeadline(n, now)
  return {
    trigger: {
      kind: 'RFP',
      headline: `[${AUDIENCE_TAG[audienceOf(n.kind)]}${n.eligibility ? ` · ${ELIGIBILITY_TAG[n.eligibility]}` : ''}] ${KIND_LABEL[n.kind]} — ${n.title}`.slice(0, 280),
      sourceUrl: n.url,
      publishedAt: n.postedAt,
      state: n.state,
      county: null,
      city: n.city,
      employees: null,
      deadline,
      summary: `${AUDIENCE_TAG[audienceOf(n.kind)]}.${n.eligibilityNote ? ` ${n.eligibilityNote}` : ''} ${n.source === 'grants.gov' ? 'Grants.gov' : 'SAM.gov'} ${n.id}. Matched: ${n.matched.join(', ')}.`,
    },
    org: { name: n.agency, type: n.agencyType, website: null, city: n.city, state: n.state },
    person: n.contact
      ? { fullName: n.contact.fullName, title: n.contact.title, linkedinUrl: null, email: n.contact.email, role: 'GRANTS', quote: null, phone: n.contact.phone }
      : null,
    p0: false,
    why: `${KIND_LABEL[n.kind]} on ${n.source === 'grants.gov' ? 'Grants.gov' : 'SAM.gov'} in our subject area${deadline ? `, closes ${deadline.toISOString().slice(0, 10)}` : ''}. ${audienceOf(n.kind) === 'CUSTOMERS' ? 'Workforce boards, states and nonprofits can apply: a reason to call them, not a bid for us.' : 'A contract we could bid on.'}`,
  }
}
