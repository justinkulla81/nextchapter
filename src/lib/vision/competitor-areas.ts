/**
 * The vocabulary and small parsers behind the Competitors page. Pure functions, so the rules can be tested.
 */

/** Where a competitor can overlap with us. A fixed list so "who competes in coaching" is a query, not a read. */
export const COMPETITOR_AREAS = [
  { key: 'coaching', label: 'Coaching' },
  { key: 'career_exploration', label: 'Career exploration & pivots' },
  { key: 'job_search', label: 'Job search & job board' },
  { key: 'resume', label: 'Resume & applications' },
  { key: 'interview_prep', label: 'Interview prep' },
  { key: 'networking', label: 'Networking' },
  { key: 'learning', label: 'Learning & courses' },
  { key: 'ai_reskilling', label: 'AI reskilling' },
  { key: 'fractional', label: 'Fractional & gig work' },
  { key: 'community', label: 'Support community' },
  { key: 'recruiters', label: 'Recruiters & staffing' },
  { key: 'benefits', label: 'Benefits & money help' },
  { key: 'outplacement', label: 'Outplacement & layoff support' },
  { key: 'workforce_system', label: 'Workforce-system software' },
  { key: 'labor_data', label: 'Labor market data' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'employer_hiring', label: 'Employer hiring tools' },
  { key: 'higher_ed', label: 'Higher-ed career services' },
] as const
export type CompetitorAreaKey = (typeof COMPETITOR_AREAS)[number]['key']
const AREA_KEYS = new Set<string>(COMPETITOR_AREAS.map((a) => a.key))
export const areaLabel = (key: string) => COMPETITOR_AREAS.find((a) => a.key === key)?.label ?? key

export const RELATIONSHIPS = [
  { key: 'DIRECT', label: 'Direct competitor', hint: 'Sells what we sell to the people we sell to.' },
  { key: 'ADJACENT', label: 'Adjacent', hint: 'Overlaps in part, or sells to a different buyer.' },
  { key: 'PARTNER', label: 'Possible partner', hint: 'More useful beside us than against us.' },
  { key: 'SUPPLIER', label: 'Data or tool supplier', hint: 'We could buy from them or build on them.' },
] as const
export const relationshipLabel = (key: string) => RELATIONSHIPS.find((r) => r.key === key)?.label ?? key
const REL_KEYS = new Set<string>(RELATIONSHIPS.map((r) => r.key))

/** Only vocabulary keys survive; anything a model invents is dropped. */
export function cleanAreas(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  return [...new Set(list.map((x) => String(x).trim().toLowerCase().replace(/[\s&/-]+/g, '_')).filter((x) => AREA_KEYS.has(x)))]
}
export const cleanRelationship = (v: unknown): string => (REL_KEYS.has(String(v)) ? String(v) : 'DIRECT')

/** One item per non-empty line, trimmed, de-duplicated, capped. */
export function parseLines(v: unknown, max = 12): string[] {
  const text = Array.isArray(v) ? v.join('\n') : String(v ?? '')
  return [...new Set(text.split('\n').map((l) => l.replace(/^[\s\-•*]+/, '').trim()).filter(Boolean))].slice(0, max)
}

export interface NamedEntry { name: string; note?: string; url?: string }
export interface WinEntry { what: string; buyer?: string; amount?: string; year?: string; url?: string }

/** "Name | note | https://url", one per line. */
export function parseCustomers(v: unknown, max = 40): NamedEntry[] {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === 'string' ? { name: x } : { name: String((x as NamedEntry).name ?? '').trim(), note: (x as NamedEntry).note?.trim() || undefined, url: cleanUrl((x as NamedEntry).url) }))
      .filter((x) => x.name).slice(0, max)
  }
  return String(v ?? '').split('\n').map((l) => l.split('|').map((p) => p.trim())).filter((p) => p[0])
    .map(([name, a, b]) => {
      const url = cleanUrl(/^https?:/i.test(a ?? '') ? a : b)
      const note = a && !/^https?:/i.test(a) ? a : undefined
      return { name, ...(note ? { note } : {}), ...(url ? { url } : {}) }
    }).slice(0, max)
}

/** "What | buyer | amount | year | https://url", one per line. */
export function parseWins(v: unknown, max = 40): WinEntry[] {
  if (Array.isArray(v)) {
    return v.map((x) => {
      const w = x as WinEntry
      return { what: String(w.what ?? '').trim(), buyer: w.buyer?.toString().trim() || undefined, amount: w.amount?.toString().trim() || undefined, year: w.year?.toString().trim() || undefined, url: cleanUrl(w.url) }
    }).filter((x) => x.what).slice(0, max)
  }
  return String(v ?? '').split('\n').map((l) => l.split('|').map((p) => p.trim())).filter((p) => p[0])
    .map(([what, buyer, amount, year, url]) => ({ what, ...(buyer ? { buyer } : {}), ...(amount ? { amount } : {}), ...(year ? { year } : {}), ...(cleanUrl(url) ? { url: cleanUrl(url) } : {}) }))
    .slice(0, max)
}

export function cleanUrl(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  return /^https?:\/\/\S+$/i.test(s) ? s : undefined
}

/** "example.com" from anything a person might paste: a bare domain, a full link, a link with a path. */
export function hostOf(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    return host.includes('.') ? host : null
  } catch { return null }
}
export const homepageOf = (input: string): string | null => { const h = hostOf(input); return h ? `https://${h}` : null }

/** A whole-dollar amount from "$24M", "24,000,000", "C$5.7M" or "about 3 million"; null when it cannot be read. */
export function parseUsd(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : null
  const s = String(v ?? '').toLowerCase().replace(/,/g, '')
  const m = s.match(/(\d+(?:\.\d+)?)\s*(b(?:illion)?|m(?:illion)?|k|thousand)?/)
  if (!m) return null
  const n = parseFloat(m[1])
  const mult = m[2]?.startsWith('b') ? 1e9 : m[2]?.startsWith('m') ? 1e6 : m[2] === 'k' || m[2] === 'thousand' ? 1e3 : 1
  const out = Math.round(n * mult)
  return out > 0 && out < 1e12 ? out : null
}

export const STATUSES = [
  { key: 'ACTIVE', label: 'Operating' },
  { key: 'ACQUIRED', label: 'Acquired' },
  { key: 'PIVOTED', label: 'Left this market' },
  { key: 'SHUT_DOWN', label: 'Shut down' },
] as const
export const statusLabel = (key: string) => STATUSES.find((x) => x.key === key)?.label ?? key
export const cleanStatus = (v: unknown): string => (STATUSES.some((x) => x.key === String(v)) ? String(v) : 'ACTIVE')

/** The market a company was found in. Mirrors scripts/vision/research-landscape.ts. */
export const CATEGORIES = [
  { key: 'job_transition', label: 'Job transition platforms' },
  { key: 'outplacement', label: 'Outplacement' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'career_exploration', label: 'Career exploration & pivots' },
  { key: 'higher_ed', label: 'Higher-ed alumni, career & exec ed' },
  { key: 'recruiter_crm', label: 'Recruiter CRMs & ATS' },
  { key: 'retention', label: 'Retention & internal mobility' },
  { key: 'job_boards', label: 'Job boards & hiring tools' },
  { key: 'assessments', label: 'Assessments & references' },
  { key: 'networking', label: 'Networking & mentoring' },
  { key: 'job_search_tools', label: 'Resume, tracking & interview tools' },
  { key: 'job_data', label: 'Employee & job data' },
  { key: 'early_career', label: 'Early career & entry level' },
  { key: 'retraining', label: 'Retraining & bootcamps' },
  { key: 'older_workers', label: 'Older workers & returners' },
  { key: 'fractional_gig', label: 'Fractional & gig' },
  { key: 'community', label: 'Support communities' },
  { key: 'workforce_gov', label: 'Vendors to workforce agencies' },
  { key: 'nonprofit_providers', label: 'Nonprofit & faith-based providers' },
  { key: 'failed', label: 'Failed or distressed' },
] as const
export const categoryLabel = (key: string | null | undefined) => CATEGORIES.find((c) => c.key === key)?.label ?? null
