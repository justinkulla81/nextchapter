/**
 * Pure helpers for the layoff alert's context: where a layoff is (from headline
 * text), what job-board industry an industry label belongs to, and what to say
 * to each public partner. Kept free of the database so the wording and mapping
 * are testable; layoff-context.ts gathers the numbers.
 */
import { STATE_NAMES } from '@/lib/workforce/places'

const CODE_BY_NAME = Object.fromEntries(Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]))
const CODES = new Set(Object.keys(STATE_NAMES))

/**
 * A "City, ST" or "City, State" in headlines ("Kroger to cut 3,000 jobs in
 * Cincinnati, Ohio"). The first one found wins; headlines are only trusted for
 * the place they name, never guessed from the company.
 */
export function placeFromHeadlines(headlines: string[]): { city: string; state: string } | null {
  for (const h of headlines) {
    const m = h.match(/\b([A-Z][a-zA-Z.'-]+(?: [A-Z][a-zA-Z.'-]+){0,2}),\s+([A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/g)
    for (const hit of m ?? []) {
      const [city, rest] = hit.split(/,\s+/)
      const state = CODES.has(rest) ? rest : CODE_BY_NAME[rest.toLowerCase()]
      if (state && !/^(?:The|In|At|On|Of)$/.test(city)) return { city, state }
    }
  }
  return null
}

/** Job-board industry keys (CompanyJobOpening.industry) and their plain names. */
export const INDUSTRY_NAME: Record<string, string> = {
  technology: 'technology', industrial: 'manufacturing and industrial', financial_services: 'financial services', healthcare: 'healthcare',
  consumer: 'consumer, retail and hospitality', aerospace_defense: 'aerospace and defense', professional_services: 'professional services',
  education: 'education', life_sciences: 'life sciences', government: 'government', energy: 'energy and utilities', logistics: 'transportation and logistics',
  media: 'media and entertainment', nonprofit: 'nonprofit', real_estate: 'construction and real estate', agriculture: 'agriculture', telecom: 'telecommunications',
}

/** The job board's industry key for one of the CRM's industry labels, or null when there is no fair match. */
const BUCKET_TO_KEY: Record<string, string> = {
  'Technology & Software': 'technology', 'Telecommunications': 'telecom',
  'Financial Services & Banking': 'financial_services', 'Insurance': 'financial_services', 'Venture Capital & Private Equity': 'financial_services',
  'Accounting & Audit': 'professional_services', 'Legal Services': 'professional_services', 'Professional Services & Consulting': 'professional_services', 'Staffing & Human Capital': 'professional_services',
  'Healthcare & Hospital Systems': 'healthcare', 'Pharmaceuticals & Biotech': 'life_sciences', 'Medical Devices': 'life_sciences',
  'Retail & E-commerce': 'consumer', 'Consumer Packaged Goods': 'consumer', 'Hospitality, Travel & Food Service': 'consumer',
  'Agriculture & Food Production': 'agriculture', 'Manufacturing & Industrial': 'industrial', 'Automotive & Mobility': 'industrial',
  'Aerospace & Defense': 'aerospace_defense', 'Energy & Utilities': 'energy', 'Construction & Real Estate': 'real_estate',
  'Transportation & Logistics': 'logistics', 'Media & Entertainment': 'media', 'Advertising, Marketing & PR': 'media',
  'Education & EdTech': 'education', 'Government & Public Sector': 'government', 'Nonprofit & Social Impact': 'nonprofit',
}
export const jobBoardIndustryFor = (bucket: string | null | undefined): string | null => (bucket ? BUCKET_TO_KEY[bucket] ?? null : null)

export interface LocalPicture {
  employer: string
  employees: number | null
  state: string | null
  county: string | null
  /** The layoff's industry as a job-board key, with a plain name; null when unknown. */
  industryKey: string | null
  /** Open white-collar roles on our board in the state, and in the layoff's own industry. */
  openInState: number | null
  openInIndustry: number | null
  openSeniorInState: number | null
  /** The industries with the most open roles in the state, the layoff's own excluded. */
  topIndustries: { key: string; openings: number }[]
  /** From the geography table, for the state or the county. */
  unemploymentRate: number | null
  areaLabel: string | null
  layoffs12mo: number | null
  layoffEvents12mo: number | null
}

const n = (x: number) => x.toLocaleString('en-US')
const name = (key: string) => INDUSTRY_NAME[key] ?? key.replace(/_/g, ' ')
const top = (p: LocalPicture, k = 3) => p.topIndustries.slice(0, k).map((t) => `${name(t.key)} (${n(t.openings)})`).join(', ')
const size = (p: LocalPicture) => (p.employees ? `${n(p.employees)} jobs` : 'jobs')

export type Audience = 'rapid_response' | 'workforce_board' | 'job_centers' | 'economic_development'

/**
 * What to say to each partner, from the numbers in the picture: the openings,
 * the industries hiring, where displaced workers can retrain toward. Every
 * figure is from our own data and says what it counts; nothing is promised
 * beyond sharing it and supporting the people affected.
 */
export function talkingPoints(p: LocalPicture, who: Audience): string | null {
  if (!p.state) return null
  const ind = p.industryKey ? name(p.industryKey) : null
  const where = p.state
  const same = ind && p.openInIndustry != null ? `${n(p.openInIndustry)} of them in ${ind}` : null
  const market = p.openInState != null
    ? `Our job board has ${n(p.openInState)} open white-collar roles in ${where}${p.openSeniorInState ? `, ${n(p.openSeniorInState)} at manager level or above` : ''}${same ? `, ${same}` : ''}.`
    : null
  const hiring = p.topIndustries.length ? `Hiring most outside ${ind ?? 'this industry'}: ${top(p)}.` : null
  const unemployment = p.unemploymentRate != null ? `${p.areaLabel ?? where} unemployment is ${p.unemploymentRate}%` : null
  const recent = p.layoffs12mo ? `${n(p.layoffs12mo)} workers in ${p.layoffEvents12mo ? `${n(p.layoffEvents12mo)} ` : ''}WARN-filed layoffs over the last 12 months` : null

  const lead = `${p.employer} is cutting ${size(p)}${ind ? ` in ${ind}` : ''}.`
  switch (who) {
    case 'rapid_response':
      return [lead, market, hiring, 'Offer: share this openings data in the employer meeting and support the affected workers in finding their next role.'].filter(Boolean).join(' ')
    case 'workforce_board':
      return [lead, [unemployment, recent].filter(Boolean).join('; ') + (unemployment || recent ? '.' : ''), market, hiring,
        'Retraining: the industries above are where displaced workers can move; the board can point retraining funds toward them.'].filter(Boolean).join(' ')
    case 'job_centers':
      return [lead, market, hiring, 'Walk-in help: bring these openings and the industries hiring most to anyone who comes in from this employer.'].filter(Boolean).join(' ')
    case 'economic_development':
      return [lead, ind && p.openInIndustry != null && p.openInState ? `Industries like it in ${where}: ${n(p.openInIndustry)} open roles, ${Math.round((p.openInIndustry / p.openInState) * 100)}% of the state's openings.` : null,
        hiring ? hiring.replace('Hiring most outside', 'Other big hiring industries, outside') : null, recent ? `${recent}.` : null].filter(Boolean).join(' ')
  }
}

const SOURCE_NOTE: Record<string, string> = { company: 'company record', filing: 'WARN filing', sec: 'SEC filing', model: 'classified by model' }

/** The "Local picture" rows for the alert email: industry, openings, who is hiring, and the area's recent layoffs. */
export function pictureRows(p: LocalPicture, m: { industryLabel: string | null; industrySource: string | null }): [string, string][] {
  const rows: [string, string][] = [['Industry', m.industryLabel ? `${m.industryLabel}${m.industrySource ? ` (${SOURCE_NOTE[m.industrySource] ?? m.industrySource})` : ''}` : 'Could not be determined']]
  if (p.state && p.openInState != null) {
    const parts = [`${n(p.openInState)} open white-collar roles in ${p.state}`]
    if (p.openSeniorInState) parts.push(`${n(p.openSeniorInState)} at manager level or above`)
    if (p.industryKey && p.openInIndustry != null) parts.push(`${n(p.openInIndustry)} in ${name(p.industryKey)}`)
    rows.push(['On our job board', parts.join(', ')])
  }
  if (p.topIndustries.length) rows.push(['Hiring most', `${top(p, 4)}, outside ${p.industryKey ? name(p.industryKey) : 'this industry'}`])
  if (p.unemploymentRate != null || p.layoffs12mo) {
    rows.push([p.areaLabel ?? p.state ?? 'Area', [
      p.unemploymentRate != null ? `unemployment ${p.unemploymentRate}%` : null,
      p.layoffs12mo ? `${n(p.layoffs12mo)} workers in ${p.layoffEvents12mo ? `${n(p.layoffEvents12mo)} ` : ''}WARN-filed layoffs in the last 12 months` : null,
    ].filter(Boolean).join(', ')])
  }
  return rows
}

/**
 * SEC industry descriptions ("Railroads, Line-Haul Operating", "Retail-Grocery
 * Stores") the CRM's keyword matcher cannot place, mapped onto its labels. An
 * explicit list, tried only after the matcher; no match means "ask the model".
 */
const SIC_KEYWORDS: [RegExp, string][] = [
  [/railroad|trucking|air transport|air courier|water transport|pipeline|freight|warehous|transportation services|local .*transit/i, 'Transportation & Logistics'],
  [/grocery|retail|stores|catalog|mail-order|eating|drinking/i, 'Retail & E-commerce'],
  [/hotels|motels|casino|amusement|restaurant/i, 'Hospitality, Travel & Food Service'],
  [/electric services|gas production|natural gas|water supply|cogeneration|petroleum|crude|oil & gas|oil and gas|coal/i, 'Energy & Utilities'],
  [/hospital|nursing|home health|medical laborator|health services|offices .* doctors|managed care/i, 'Healthcare & Hospital Systems'],
  [/pharmaceutical|biological|biotech|in vitro|diagnostic/i, 'Pharmaceuticals & Biotech'],
  [/surgical|medical instruments|orthopedic|electromedical/i, 'Medical Devices'],
  [/state commercial banks|national commercial banks|savings institution|security brokers|investment|finance services|loan|credit|asset-backed/i, 'Financial Services & Banking'],
  [/insurance|surety|title insurance/i, 'Insurance'],
  [/prepackaged software|computer|semiconductor|data processing|information retrieval|internet|electronic components/i, 'Technology & Software'],
  [/telephone|telegraph|radiotelephone|cable & other pay|cable and other pay|communications services/i, 'Telecommunications'],
  [/motor vehicle|auto|truck & bus|trailers/i, 'Automotive & Mobility'],
  [/aircraft|guided missile|space vehicle|search, detection|ordnance/i, 'Aerospace & Defense'],
  [/building contractors|heavy construction|real estate|operative builders|land subdividers/i, 'Construction & Real Estate'],
  [/educational services|schools|colleges/i, 'Education & EdTech'],
  [/management consulting|engineering services|accounting|legal services|business services|help supply|employment agencies|advertising/i, 'Professional Services & Consulting'],
  [/motion picture|television|radio broadcasting|newspapers|periodicals|books|video tape|entertainment/i, 'Media & Entertainment'],
  [/agricultur|crops|livestock|food and kindred|meat|dairy|beverages|bottled/i, 'Agriculture & Food Production'],
  [/steel|metal|machinery|chemicals|plastics|paper|manufacturing|industrial|fabricated|electrical equipment|rubber|glass|textile|furniture/i, 'Manufacturing & Industrial'],
]

export function industryFromSicDescription(desc: string | null | undefined): string | null {
  if (!desc) return null
  return SIC_KEYWORDS.find(([re]) => re.test(desc))?.[1] ?? null
}
