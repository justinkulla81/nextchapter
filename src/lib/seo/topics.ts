// The map behind the public industry, function, conference and association pages. Pure, no I/O, so the
// rules are unit-tested (src/test/seo-topics.test.ts). The database side is topic-data.ts.
//
// Three systems name an industry and they do not agree: conferences and companies use the 27 buckets in
// src/lib/constants/industry-buckets.ts; the job board carries the crawler's 18 codes (technology,
// financial_services, ...); WARN notices carry NAICS text. The page for each bucket joins all three here,
// and where the crawler code is coarser than the bucket (insurance inside financial_services) a name or
// title pattern narrows it. A bucket with no honest rule gets no jobs block rather than a guess.

import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'

export function topicSlug(s: string): string {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** How to pick a bucket's jobs from the live board (SQL built in topic-data.ts). Patterns are Postgres case-insensitive regex. */
export interface JobRule {
  /** Crawler industry codes (ExclusiveJobPosting.industry). */
  codes?: string[]
  /** Employer name pattern. */
  company?: string
  /** Job title pattern. */
  title?: string
  /** ExclusiveJobPosting.sourceCategory values. */
  sourceCategory?: string[]
}

export interface Industry {
  name: string
  slug: string
  /** One plain sentence for the page intro. */
  blurb: string
  rule: JobRule | null
}

const RULES: Record<string, { blurb: string; rule: JobRule | null }> = {
  'Venture Capital & Private Equity': { blurb: 'Investment firms, the portfolio companies they back, and the operating roles that grow them.', rule: { sourceCategory: ['venture', 'pe'] } },
  'Financial Services & Banking': { blurb: 'Banks, credit unions, lenders, payments, wealth and asset managers.', rule: { codes: ['financial_services'] } },
  'Insurance': { blurb: 'Carriers, brokers and reinsurers: underwriting, claims, actuarial and distribution.', rule: { codes: ['financial_services'], company: 'insur|assurance|reinsur|\\mmutual\\M|underwrit', title: undefined } },
  'Accounting & Audit': { blurb: 'Public accounting, tax, internal audit and corporate accounting.', rule: { title: '\\m(accountant|auditor|cpa|accounting manager|controller|tax (accountant|manager|senior|analyst))\\M' } },
  'Legal Services': { blurb: 'Law firms, in-house legal teams, legal operations and legal technology.', rule: { company: '\\m(law|llp|attorneys?|legal)\\M' } },
  'Professional Services & Consulting': { blurb: 'Management, technology and specialist consulting and advisory firms.', rule: { codes: ['professional_services'] } },
  'Technology & Software': { blurb: 'Software, cloud, cybersecurity, data and AI companies.', rule: { codes: ['technology'] } },
  'Telecommunications': { blurb: 'Wireless, broadband and network operators and their suppliers.', rule: { codes: ['telecom'] } },
  'Healthcare & Hospital Systems': { blurb: 'Hospitals, health systems, payers and the administrative and clinical leadership roles inside them.', rule: { codes: ['healthcare'] } },
  'Pharmaceuticals & Biotech': { blurb: 'Drug developers, biotech and life sciences companies.', rule: { codes: ['life_sciences'] } },
  'Medical Devices': { blurb: 'Makers of devices, diagnostics and surgical products.', rule: { codes: ['life_sciences'], company: 'medical|surgical|device|diagnostic|orthop|cardio|dental|implant' } },
  'Retail & E-commerce': { blurb: 'Retailers, marketplaces and direct-to-consumer brands.', rule: { codes: ['consumer'], company: 'retail|\\mstores?\\M|shop|\\mmart\\M|outlet|e-?commerce|depot|boutique' } },
  'Consumer Packaged Goods': { blurb: 'Food, beverage, beauty and household brands and the companies that make them.', rule: { codes: ['consumer'], company: 'foods?\\M|brands?\\M|beverage|consumer products|cosmetic|beauty|household|packaged' } },
  'Hospitality, Travel & Food Service': { blurb: 'Hotels, restaurants, airlines, cruise and travel companies.', rule: { codes: ['consumer'], company: 'hotel|resort|restaurant|hospitality|casino|airlines?|cruise|travel|marriott|hilton|hyatt' } },
  'Agriculture & Food Production': { blurb: 'Farms, agricultural technology and food producers.', rule: { codes: ['agriculture'] } },
  'Manufacturing & Industrial': { blurb: 'Factories, industrial products and the engineering and operations teams that run them.', rule: { codes: ['industrial'] } },
  'Automotive & Mobility': { blurb: 'Vehicle makers, suppliers, electric vehicles and mobility services.', rule: { codes: ['industrial', 'consumer'], company: 'motors?\\M|automotive|\\mauto\\M|\\mford\\M|tesla|vehicle|\\mev\\M|tire' } },
  'Aerospace & Defense': { blurb: 'Aircraft, space, defense contractors and government suppliers.', rule: { codes: ['aerospace_defense'] } },
  'Energy & Utilities': { blurb: 'Utilities, oil and gas, renewables and power generation.', rule: { codes: ['energy'] } },
  'Construction & Real Estate': { blurb: 'Builders, developers, brokerages and property managers.', rule: { codes: ['real_estate'] } },
  'Transportation & Logistics': { blurb: 'Freight, shipping, trucking, warehousing and supply chain.', rule: { codes: ['logistics'] } },
  'Media & Entertainment': { blurb: 'Publishing, streaming, film, music and games.', rule: { codes: ['media'] } },
  'Advertising, Marketing & PR': { blurb: 'Agencies and brands: advertising, marketing, public relations and communications.', rule: { company: 'advertising|marketing agency|creative agency|public relations|\\mpr (firm|agency)\\M|media agency|communications group|\\mwpp\\M|omnicom|publicis|interpublic' } },
  'Education & EdTech': { blurb: 'Universities, colleges, school systems and education technology.', rule: { codes: ['education'] } },
  'Government & Public Sector': { blurb: 'Federal, state and local government agencies.', rule: { codes: ['government'] } },
  'Nonprofit & Social Impact': { blurb: 'Nonprofits, foundations and mission-driven organizations.', rule: { codes: ['nonprofit'] } },
  'Staffing & Human Capital': { blurb: 'Staffing, executive search and workforce firms.', rule: { codes: ['professional_services'], company: 'staffing|recruit|talent|\\msearch\\M|workforce' } },
}

export const INDUSTRIES: Industry[] = INDUSTRY_BUCKET_NAMES.filter((n) => n !== 'Other').map((name) => ({
  name,
  slug: topicSlug(name),
  blurb: RULES[name]?.blurb ?? '',
  rule: RULES[name]?.rule ?? null,
}))

const INDUSTRY_BY_SLUG = new Map(INDUSTRIES.map((i) => [i.slug, i]))
const INDUSTRY_BY_NAME = new Map(INDUSTRIES.map((i) => [i.name, i]))
export const industryBySlug = (slug: string) => INDUSTRY_BY_SLUG.get(slug) ?? null
export const industryByName = (name: string | null | undefined) => (name ? INDUSTRY_BY_NAME.get(name) ?? null : null)
export const industryPath = (name: string) => `/industries/${topicSlug(name)}`

/** The crawler's industry code -> the bucket that most plainly holds it (an employer's one industry). */
export const CRAWLER_INDUSTRY_BUCKET: Record<string, string> = {
  technology: 'Technology & Software',
  industrial: 'Manufacturing & Industrial',
  financial_services: 'Financial Services & Banking',
  healthcare: 'Healthcare & Hospital Systems',
  consumer: 'Retail & E-commerce',
  professional_services: 'Professional Services & Consulting',
  aerospace_defense: 'Aerospace & Defense',
  education: 'Education & EdTech',
  life_sciences: 'Pharmaceuticals & Biotech',
  government: 'Government & Public Sector',
  energy: 'Energy & Utilities',
  media: 'Media & Entertainment',
  nonprofit: 'Nonprofit & Social Impact',
  logistics: 'Transportation & Logistics',
  real_estate: 'Construction & Real Estate',
  agriculture: 'Agriculture & Food Production',
  telecom: 'Telecommunications',
}

/** A company's free-text or coded industry -> a bucket name, or null when it names none. */
export function bucketFromIndustryText(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  if (!t) return null
  if (INDUSTRY_BY_NAME.has(t)) return t
  return CRAWLER_INDUSTRY_BUCKET[t.toLowerCase()] ?? null
}

/**
 * A WARN notice's industry: its own NAICS text first ("62 Healthcare and Social Assistance", "tech: Finance",
 * "54 (NAICS 541512)"), then the matched company's industry. Sectors that span several buckets with no
 * safe way to choose (56 Administrative and Support, 42 Wholesale) map to nothing.
 */
export function bucketFromWarn(industry: string | null | undefined, employer: string, companyIndustry: string | null | undefined): string | null {
  const t = (industry ?? '').trim()
  const fromCompany = bucketFromIndustryText(companyIndustry)
  if (t && !/^n\/?a$/i.test(t)) {
    if (/^tech:/i.test(t)) return 'Technology & Software'
    const naics = /\bNAICS\s+(\d{3,6})/.exec(t)?.[1]
    const lead = naics ?? /^(\d{2})/.exec(t)?.[1] ?? ''
    const two = lead.slice(0, 2)
    if (naics?.startsWith('5415')) return 'Technology & Software'
    if (two === '52') return /insur|assurance/i.test(employer) || naics?.startsWith('524') ? 'Insurance' : 'Financial Services & Banking'
    const byTwo: Record<string, string> = {
      '62': 'Healthcare & Hospital Systems', '31': 'Manufacturing & Industrial', '32': 'Manufacturing & Industrial', '33': 'Manufacturing & Industrial',
      '54': 'Professional Services & Consulting', '53': 'Construction & Real Estate', '23': 'Construction & Real Estate', '44': 'Retail & E-commerce', '45': 'Retail & E-commerce',
      '48': 'Transportation & Logistics', '49': 'Transportation & Logistics', '92': 'Government & Public Sector', '71': 'Media & Entertainment',
      '72': 'Hospitality, Travel & Food Service', '61': 'Education & EdTech', '22': 'Energy & Utilities', '21': 'Energy & Utilities', '11': 'Agriculture & Food Production',
    }
    if (byTwo[two]) return byTwo[two]
  }
  return fromCompany
}

export interface JobFunction {
  /** Display label, as stored in ExclusiveJobPosting.targetFunction. */
  name: string
  slug: string
  blurb: string
}

const FUNCTION_BLURB: Record<string, string> = {
  Engineering: 'Software, hardware, mechanical and electrical engineering roles.',
  Operations: 'Running the business: operations, supply chain, facilities and program delivery.',
  Finance: 'Accounting, FP&A, treasury, controllership and finance leadership.',
  'Data & Analytics': 'Data science, analytics, data engineering and machine learning.',
  Sales: 'Account executives, business development, sales leadership and partnerships.',
  'Human Resources': 'Talent acquisition, HR business partners, compensation and people operations.',
  Marketing: 'Brand, growth, product marketing, communications and content.',
  Legal: 'Counsel, compliance, contracts, privacy and legal operations.',
  Product: 'Product management and product leadership.',
  Design: 'Product, UX, brand and graphic design.',
  'Customer Success': 'Customer success, support and account management.',
  Administration: 'Executive assistants, office management and administrative leadership.',
  'Executive Leadership': 'C-suite, general management and board-level roles.',
  Clinical: 'Clinical leadership and practice roles.',
  Investment: 'Investing, portfolio management and capital markets.',
  Security: 'Cybersecurity, information security and physical security.',
  Programs: 'Program and project management and nonprofit program delivery.',
  Strategy: 'Corporate strategy, corporate development and business planning.',
  'Fundraising & development': 'Fundraising, grants and development for nonprofits and institutions.',
  Research: 'Research scientists, analysts and research leadership.',
  Academic: 'Faculty and academic leadership.',
}

export const JOB_FUNCTIONS: JobFunction[] = Object.values(CRAWLER_FUNCTION_LABEL)
  .filter((v, i, a) => a.indexOf(v) === i)
  .map((name) => ({ name, slug: topicSlug(name), blurb: FUNCTION_BLURB[name] ?? '' }))
  .sort((a, b) => a.name.localeCompare(b.name))

const FUNCTION_BY_SLUG = new Map(JOB_FUNCTIONS.map((f) => [f.slug, f]))
const FUNCTION_BY_NAME = new Map(JOB_FUNCTIONS.map((f) => [f.name, f]))
export const functionBySlug = (slug: string) => FUNCTION_BY_SLUG.get(slug) ?? null
export const functionByName = (name: string | null | undefined) => (name ? FUNCTION_BY_NAME.get(name) ?? null : null)
export const functionPath = (name: string) => `/functions/${topicSlug(name)}`

/** An organizer gets its own page when it runs two or more published conferences; one-event organizers stay a name on the conference page. */
export const ASSOCIATION_MIN_CONFERENCES = 2

export const associationSlug = (organizer: string) => topicSlug(organizer.replace(/\s*\([^)]*\)\s*$/, '')).slice(0, 80)
export const associationPath = (organizer: string) => `/associations/${associationSlug(organizer)}`

/** Looks like a membership body rather than a commercial events company. Used for the wording only ("association" vs "organizer"). */
export const LOOKS_LIKE_ASSOCIATION = /association|society|institute|council|federation|league|chamber|alliance|guild|academy|foundation|union|coalition|consortium|\bcollege\b|\bAICPA\b|\bSIFMA\b/i

export const conferencePath = (id: string) => `/conferences/${id}`

/**
 * The Census occupation major group (SOC) closest to a job function, for the report's AI-exposure and employment-change
 * figures. A function is not an occupation group, so pages say "closest group" and only the confident pairs are listed.
 */
export const FUNCTION_SOC_GROUP: Record<string, string> = {
  Engineering: '17',
  'Data & Analytics': '15',
  Security: '15',
  Product: '11',
  Finance: '13',
  'Human Resources': '13',
  Marketing: '13',
  Strategy: '13',
  Investment: '13',
  Sales: '41',
  Legal: '23',
  Design: '27',
  Administration: '43',
  'Executive Leadership': '11',
  Operations: '11',
  Clinical: '29',
  Research: '19',
  Academic: '25',
  Programs: '21',
}
