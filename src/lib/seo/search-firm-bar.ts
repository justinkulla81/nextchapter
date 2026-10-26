// Public pages for search firms, recruiting firms, staffing companies and outplacement firms (/search-firms/<slug>).
// Pure — no I/O — so the page bar and the numbers are unit-tested (src/test/search-firm-pages.test.ts). The database
// side is search-firm-pages.ts.
//
// THE PAGE BAR (decided here, and only here): a page is offered to search engines (indexable, in the sitemap, in the hub,
// pinged to IndexNow) when the firm has at least SEARCH_FIRM_MIN_PUBLIC_ROLES searches with a public job page right now.
// Below that the page still renders (a firm can be claimed) but is noindex and out of the sitemap. The sitemap SQL
// (search-firm-pages.ts) interpolates the same constant.

export const SEARCH_FIRM_MIN_PUBLIC_ROLES = 3

export function isSearchFirmIndexable(publicRoles: number): boolean {
  return publicRoles >= SEARCH_FIRM_MIN_PUBLIC_ROLES
}

/** A real firm name makes a short address. A longer slug means the CRM name is scraped page text (one was a whole HTML page), so the firm gets no page. */
export const SEARCH_FIRM_MAX_SLUG = 80
export const isUsableFirmSlug = (slug: string | null): slug is string => !!slug && slug.length <= SEARCH_FIRM_MAX_SLUG

export type FirmKind = 'retained' | 'contingent' | 'nonprofit_higher_ed' | 'staffing' | 'outplacement' | 'search'

export const FIRM_KIND_LABEL: Record<FirmKind, string> = {
  retained: 'Retained search firm',
  contingent: 'Contingent recruiting firm',
  nonprofit_higher_ed: 'Nonprofit and higher-ed search firm',
  staffing: 'Staffing company',
  outplacement: 'Outplacement firm',
  search: 'Search firm',
}

export const FIRM_KIND_PLURAL: Record<FirmKind, string> = {
  retained: 'Retained search firms',
  contingent: 'Contingent recruiting firms',
  nonprofit_higher_ed: 'Nonprofit and higher-ed search firms',
  staffing: 'Staffing companies',
  outplacement: 'Outplacement firms',
  search: 'Search firms',
}

export const isFirmKind = (v: string | null | undefined): v is FirmKind => !!v && v in FIRM_KIND_LABEL

/** Which kind of firm this is: the search-firm segment when we have one, else staffing / outplacement by what the CRM knows. */
export function firmKind(input: { segment: string | null; staffing: boolean; orgTypes: string[] }): FirmKind {
  if (isFirmKind(input.segment) && input.segment !== 'staffing' && input.segment !== 'outplacement') return input.segment
  if (input.staffing) return 'staffing'
  if (input.orgTypes.includes('OUTPLACEMENT_FIRM') && !input.orgTypes.includes('SEARCH_FIRM')) return 'outplacement'
  return 'search'
}

export interface SearchRow {
  id: string
  title: string
  level: string | null
  fn: string | null
  industry: string | null
  location: string | null
  state: string | null
  workArrangement: string | null
  salaryMin: number | null
  salaryMax: number | null
  payPeriod: string | null
  entryPhrase: boolean
  aiSkill: boolean
  openSince: Date | null
}

const LEVEL_LABEL: Record<string, string> = {
  ENTRY_IC: 'Entry level', EARLY_IC: 'Early career', MID_IC: 'Mid level', SENIOR_IC: 'Senior', MANAGER: 'Manager',
  SR_MANAGER: 'Senior manager', PRINCIPAL: 'Principal', DIRECTOR: 'Director', HEAD: 'Head of function', CHIEF_OF_STAFF: 'Director',
  VP: 'VP', PARTNER: 'Partner', EVP_SVP: 'Executive', C_SUITE: 'Executive',
}
export const levelLabel = (level: string | null): string | null => (level ? (LEVEL_LABEL[level] ?? null) : null)

export const INDUSTRY_LABEL: Record<string, string> = {
  technology: 'Technology', financial_services: 'Financial services', healthcare: 'Healthcare', life_sciences: 'Life sciences',
  professional_services: 'Professional services', industrial: 'Industrial and manufacturing', consumer: 'Consumer', energy: 'Energy',
  real_estate: 'Real estate', logistics: 'Logistics', media: 'Media', telecom: 'Telecommunications', education: 'Education',
  nonprofit: 'Nonprofit', government: 'Government', aerospace_defense: 'Aerospace and defense', agriculture: 'Agriculture',
}
export const industryLabel = (code: string | null): string | null => (code ? (INDUSTRY_LABEL[code] ?? null) : null)

const rank = <T extends string>(values: (T | null | undefined)[], take: number): { value: T; count: number }[] => {
  const m = new Map<T, number>()
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value))).slice(0, take)
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** Yearly pay the posting states, or null (hourly and implausible figures are left out). */
export function yearlyRange(r: Pick<SearchRow, 'salaryMin' | 'salaryMax' | 'payPeriod'>): [number, number] | null {
  const { salaryMin: lo, salaryMax: hi, payPeriod } = r
  if (!lo || !hi || hi < lo) return null
  if (payPeriod && payPeriod !== 'year') return null
  if (lo < 20_000 || hi >= 2_000_000) return null
  return [lo, hi]
}

export interface SearchSummary {
  publicRoles: number
  entryLevel: number
  aiSkill: number
  withPay: number
  remote: number
  levels: { label: string; count: number }[]
  functions: { label: string; count: number }[]
  industries: { label: string; count: number }[]
  states: { state: string; count: number }[]
  medianDaysOpen: number | null
  oldestDaysOpen: number | null
  medianPay: [number, number] | null
}

/** What a firm's live searches say about it. Only counts and labels; never a client name. */
export function summarizeSearches(rows: SearchRow[], now: number): SearchSummary {
  const days = rows.filter((r) => r.openSince).map((r) => Math.max(0, Math.floor((now - r.openSince!.getTime()) / 86_400_000)))
  const pays = rows.map(yearlyRange).filter((x): x is [number, number] => !!x)
  return {
    publicRoles: rows.length,
    entryLevel: rows.filter((r) => r.level === 'ENTRY_IC' || r.entryPhrase).length,
    aiSkill: rows.filter((r) => r.aiSkill).length,
    withPay: pays.length,
    remote: rows.filter((r) => r.workArrangement === 'remote').length,
    levels: rank(rows.map((r) => levelLabel(r.level)), 6).map((x) => ({ label: x.value, count: x.count })),
    functions: rank(rows.map((r) => r.fn), 6).map((x) => ({ label: x.value, count: x.count })),
    industries: rank(rows.map((r) => industryLabel(r.industry)), 5).map((x) => ({ label: x.value, count: x.count })),
    states: rank(rows.map((r) => r.state), 8).map((x) => ({ state: x.value, count: x.count })),
    medianDaysOpen: median(days),
    oldestDaysOpen: days.length ? Math.max(...days) : null,
    medianPay: pays.length >= 3 ? [median(pays.map((p) => p[0]))!, median(pays.map((p) => p[1]))!] : null,
  }
}

/** The specialties line: the functions and industries most of its live searches fall in. Null when the data names none. */
export function specialties(s: SearchSummary): string[] {
  const out: string[] = []
  for (const f of s.functions.slice(0, 3)) if (f.count >= 2 || s.publicRoles <= 3) out.push(f.label)
  for (const i of s.industries.slice(0, 2)) if (i.count >= 2 || s.publicRoles <= 3) out.push(i.label)
  return [...new Set(out)]
}
