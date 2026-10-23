/**
 * Which geographies, industries and job functions a recruiter covers. One
 * vocabulary for the recruiter tags, the Industries and Functions CRM pages and
 * the layoff alert, so a layoff in "Information" in Texas finds the same people
 * a recruiter tagged "technology" in "TX" does. Pure: no database.
 *
 * Industry keys are the job board's (CompanyJobOpening.industry), the same ones
 * jobBoardIndustryFor() returns, so a recruiter tag, a posting and a layoff
 * compare directly.
 */
import { INDUSTRY_NAME } from '@/lib/warn/layoff-picture'

export const INDUSTRY_KEYS = Object.keys(INDUSTRY_NAME)
export const industryName = (key: string): string => INDUSTRY_NAME[key] ?? key

export const FUNCTIONS: Record<string, string> = {
  engineering: 'Software and engineering', data_ai: 'Data, AI and analytics', it_security: 'IT and security', product_design: 'Product and design',
  sales: 'Sales and business development', marketing: 'Marketing and communications', finance: 'Finance and accounting', hr: 'HR and people',
  legal: 'Legal and compliance', operations: 'Operations and supply chain', clinical: 'Clinical and healthcare', executive: 'Executive and board',
  customer: 'Customer success and support', education: 'Education and academic', trades: 'Engineering (non-software) and technical',
}
export const FUNCTION_KEYS = Object.keys(FUNCTIONS)
export const functionName = (key: string): string => FUNCTIONS[key] ?? key

/** Keyword rules, tested against a title, a firm's name or its specialty line. Order does not matter; every match counts. */
const FUNCTION_RULES: [string, RegExp][] = [
  ['engineering', /\b(software|engineer(ing)?|developer|devops|full.?stack|backend|front.?end|technical recruit|tech recruit|\bit recruit|technology (search|recruit))/i],
  ['data_ai', /\b(data|machine learning|\bml\b|\bai\b|artificial intelligence|analytics|data science|llm)\b/i],
  ['it_security', /\b(cyber|security|infosec|information technology|\bit\b|infrastructure|cloud|network)\b/i],
  ['product_design', /\b(product (management|manager|search)|\bux\b|\bui\b|design(er)?)\b/i],
  ['sales', /\b(sales|business development|revenue|go.to.market|\bgtm\b|account executive)\b/i],
  ['marketing', /\b(marketing|communications|brand|advertising|\bpr\b|public relations)\b/i],
  ['finance', /\b(finance|financial|accounting|accountant|audit|\bcfo\b|treasury|tax|actuar|banking|investment)\b/i],
  ['hr', /\b(human resources|\bhr\b|people (ops|operations|team)|talent management|compensation|benefits)\b/i],
  ['legal', /\b(legal|attorney|lawyer|counsel|compliance|paralegal|regulatory)\b/i],
  ['operations', /\b(operations|supply chain|logistics|procurement|manufacturing|plant|warehouse|distribution|program management)\b/i],
  ['clinical', /\b(health ?care|clinical|nurs(e|ing)|physician|medical|pharma|life sciences?|biotech|hospital)\b/i],
  ['executive', /\b(executive (search|recruit)|c.suite|board (search|placement)|retained (search|executive)|chief|\bceo\b|president|managing director|senior leadership|leadership (search|practice))\b/i],
  ['customer', /\b(customer (success|support|service|experience)|client services)\b/i],
  ['education', /\b(higher ed|university|college|academic|school|faculty|provost|dean)\b/i],
  ['trades', /\b(mechanical|electrical|civil|chemical|aerospace|manufacturing engineer|construction|engineering firm|technical (staffing|search))\b/i],
]

const INDUSTRY_RULES: [string, RegExp][] = [
  ['technology', /\b(software|saas|tech(nology)?|internet|cyber|semiconductor|cloud|ai\b|artificial intelligence|data center|startup|information)\b/i],
  ['financial_services', /\b(financial|finance|bank(ing)?|insurance|investment|private equity|venture|wealth|asset management|fintech|accounting|credit|mortgage)\b/i],
  ['healthcare', /\b(health ?care|hospital|medical|clinical|nursing|physician|health system|senior living|behavioral health|dental)\b/i],
  ['life_sciences', /\b(life sciences?|pharma(ceutical)?|biotech|medical device|clinical research|\bcro\b|diagnostics)\b/i],
  ['industrial', /\b(manufactur|industrial|automotive|plant|engineering|chemical|materials|machinery)\b/i],
  ['aerospace_defense', /\b(aerospace|defense|defence|government contract|space|aviation)\b/i],
  ['energy', /\b(energy|utilities|oil|gas|power|renewable|solar|nuclear|mining)\b/i],
  ['logistics', /\b(logistics|supply chain|transportation|freight|shipping|trucking|warehouse)\b/i],
  ['consumer', /\b(consumer|retail|e.?commerce|cpg|hospitality|restaurant|food|beverage|fashion|apparel|travel)\b/i],
  ['media', /\b(media|entertainment|advertising|marketing|publishing|gaming|sports|creative)\b/i],
  ['professional_services', /\b(consulting|professional services|legal|law firm|accounting firm|management consult)\b/i],
  ['real_estate', /\b(real estate|construction|architecture|property|homebuilding|facilities)\b/i],
  ['education', /\b(higher ed|education|university|college|school|edtech)\b/i],
  ['nonprofit', /\b(nonprofit|non.profit|foundation|association|philanthrop|social impact|ngo)\b/i],
  ['government', /\b(government|public sector|municipal|federal|state agency|public service)\b/i],
  ['telecom', /\b(telecom|wireless|broadband|cable|communications provider)\b/i],
  ['agriculture', /\b(agricultur|farm|agribusiness)\b/i],
]

const keysFor = (rules: [string, RegExp][], text: string): string[] => rules.filter(([, re]) => re.test(text)).map(([k]) => k)

/** Job functions a text points to. An "executive search" firm with no other cue gets only 'executive'. */
export const classifyFunctions = (text: string | null | undefined): string[] => (text ? keysFor(FUNCTION_RULES, text) : [])
export const classifyIndustries = (text: string | null | undefined): string[] => (text ? keysFor(INDUSTRY_RULES, text) : [])

/** The job-board industry key for a WARN notice's NAICS sector text ("Information", "Health Care and Social Assistance"). */
const NAICS_RULES: [string, RegExp][] = [
  ['technology', /information|professional, scientific|computer|software|data processing/i],
  ['financial_services', /finance|insurance|credit|bank/i],
  ['healthcare', /health care|hospital|ambulatory|nursing/i],
  ['life_sciences', /pharma|biotech|medical (equipment|device)|scientific research/i],
  ['industrial', /manufactur/i],
  ['energy', /utilit|mining|oil|gas|extraction/i],
  ['logistics', /transportation|warehous|wholesale/i],
  ['consumer', /retail|accommodation|food service|arts, entertainment/i],
  ['real_estate', /real estate|construction/i],
  ['education', /educational/i],
  ['government', /public administration/i],
  ['media', /publishing|broadcast|motion picture/i],
  ['telecom', /telecommunication/i],
  ['agriculture', /agricultur|forestry|fishing/i],
  ['professional_services', /management of companies|administrative and support|other services/i],
]
export function industryKeyForNaics(industry: string | null | undefined): string | null {
  if (!industry) return null
  return NAICS_RULES.find(([, re]) => re.test(industry))?.[0] ?? null
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
const BY_NAME = Object.entries(STATE_NAMES).sort((a, b) => b[1].length - a[1].length)

/** Two-letter state from free text like "Austin, Texas, United States" or "Chicago, IL". Null when none is named. */
export function stateFromLocation(text: string | null | undefined): string | null {
  if (!text) return null
  const abbr = text.match(/,\s*([A-Z]{2})\b(?:\s*\d{5})?(?:\s*,|\s*$)/)
  if (abbr && STATE_NAMES[abbr[1]]) return abbr[1]
  for (const [code, name] of BY_NAME) if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return code
  return null
}

/** The coverage a recruiter record carries. Empty arrays mean "not tagged yet", never "covers nothing". */
export interface Coverage {
  states: string[]
  industries: string[]
  functions: string[]
}

/** True when the recruiter covers the state, or is a national one (tagged NATIONAL). */
export const coversState = (c: { states: string[] }, state: string): boolean => c.states.includes(state) || c.states.includes('NATIONAL')

/**
 * How well a recruiter fits one layoff, higher is better: the state counts most
 * (a local recruiter beats a national one), an industry match next, then a
 * function match when the laid-off roles are known. Zero means do not show.
 */
export function recruiterFit(c: Coverage, want: { state: string | null; industry: string | null; functions?: string[] }): number {
  if (want.state && !coversState(c, want.state)) return 0
  let s = want.state && c.states.includes(want.state) ? 4 : 1
  if (want.industry && c.industries.includes(want.industry)) s += 3
  else if (want.industry && c.industries.length) s -= 0.5
  if (want.functions?.length && want.functions.some((f) => c.functions.includes(f))) s += 1
  return s
}

import { jobBoardIndustryFor } from '@/lib/warn/layoff-picture'

export interface CoverageEvidence {
  title: string | null
  /** Free-text location on the person, e.g. "Austin, Texas, United States". */
  location: string | null
  orgName: string | null
  orgIndustry: string | null
  orgState: string | null
  /** The employer is a search or staffing firm (a SearchFirm row, or an organization typed as one). */
  isSearchFirm: boolean
  /** Titles the firm places, from the SearchFirm row. */
  firmTitles: string[]
}

/**
 * Coverage read off what we already know, never invented. A search firm with no
 * known state is tagged NATIONAL (retained search is a national business; a
 * recruiter whose own location is known is tagged with that state instead). An
 * in-house recruiter at an employer gets no state unless their location says one,
 * since they hire for that employer's sites, not for a market.
 */
export function deriveCoverage(e: CoverageEvidence): Coverage {
  const state = stateFromLocation(e.location) ?? (e.orgState && e.orgState !== 'NATIONAL' && e.orgState !== 'GLOBAL' ? e.orgState : null)
  const states = state ? [state] : e.isSearchFirm || e.orgState === 'NATIONAL' ? ['NATIONAL'] : []
  const text = [e.title, e.orgName, ...e.firmTitles].filter(Boolean).join(' · ')
  const industries = new Set(classifyIndustries(text))
  const bucket = jobBoardIndustryFor(e.orgIndustry)
  if (bucket && !e.isSearchFirm) industries.add(bucket)
  const functions = new Set(classifyFunctions([e.title, ...e.firmTitles].filter(Boolean).join(' · ')))
  // A bare "Talent Acquisition" or "Managing Partner" title says nothing about the work; leave functions empty rather than guess.
  functions.delete('hr')
  return { states, industries: [...industries], functions: [...functions] }
}
