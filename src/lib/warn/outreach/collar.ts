/**
 * Whether a layoff cut white-collar jobs, for the layoff outreach (owner, 2026-11-18). The emails offer the people leaving a page of
 * professional roles; a workforce board told that about a warehouse or a food-service contract reads it as automated and off target.
 * Pure, so the rule is tested on its own.
 *
 * Only 'blue' stops an email. Most notices carry no collar tag and no sector, so 'unknown' is the common answer and still gets one.
 *
 * In order:
 *   1. the notice's own collar tag (set by the news check from the headline);
 *   2. words in the employer or division name that name a site, not an office ("distribution", "plant", "casino");
 *   3. a company on file in a knowledge industry (software, biotech, finance) is white, whatever sector its filing names;
 *   4. the NAICS sector a state filing publishes: the knowledge sectors (51, 52, 54, 55) and layoffs.fyi's "tech:" tags are white;
 *      the sectors the white-collar layoff count already leaves out (src/lib/rankings/metro-scan.ts), plus arts and recreation, are blue;
 *   5. for a state filing only, the company's industry bucket. A filing names one site, so a manufacturer's filing is mostly a plant;
 *      a news announcement from the same company is usually a corporate cut, so the bucket alone never stops one.
 */
import { KNOWLEDGE_SECTORS, naicsSector } from '@/lib/workforce/sector'

export type LayoffCollar = 'white' | 'blue' | 'unknown'

export interface CollarInput {
  employer: string
  division?: string | null
  /** WarnNotice.workCollar: 'white', 'blue' or null. */
  workCollar?: string | null
  /** WarnNotice.industry as the source published it ("31-33 Manufacturing", "45 (NAICS 453998)", "tech: Retail"). */
  industry?: string | null
  /** WARN_FILING or MANUAL_ANNOUNCEMENT. */
  source?: string | null
  /** The matched Company's industry bucket ("Manufacturing & Industrial"). */
  companyIndustry?: string | null
}

/** Site words that mean frontline work wherever they appear. */
const SITE_WORDS = /\b(?:plants?|mills?|warehouses?|distribution|fulfillment|dairy|bakery|casinos?|tree service|trucking|delivery|routes|lumber|foundry|restaurants?|grill|home ?care|home health|care home)\b/i
/** Words that mean frontline work in a state filing's employer name, but can name a corporate office in the news ("Whole Foods cuts 1,000 corporate jobs"). */
const FILING_SITE_WORDS = /\b(?:logistics|foods?|cabinets?|packaging|manufacturing|markets?|inn|hotel|resort)\b/i

const BLUE_SECTORS = new Set(['11', '21', '22', '23', '31', '32', '33', '42', '44', '45', '48', '49', '71', '72'])
const KNOWLEDGE_BUCKETS = new Set([
  'Technology & Software',
  'Pharmaceuticals & Biotech',
  'Financial Services & Banking',
  'Insurance',
  'Professional Services & Consulting',
  'Telecommunications',
  'Media & Entertainment',
])
const BLUE_BUCKETS = new Set([
  'Manufacturing & Industrial',
  'Hospitality, Travel & Food Service',
  'Agriculture & Food Production',
  'Transportation & Logistics',
  'Retail & E-commerce',
])

export function layoffCollar(n: CollarInput): LayoffCollar {
  if (n.workCollar === 'white' || n.workCollar === 'blue') return n.workCollar
  const filing = n.source !== 'MANUAL_ANNOUNCEMENT'
  const name = `${n.employer} ${n.division ?? ''}`
  if (SITE_WORDS.test(name)) return 'blue'
  if (filing && FILING_SITE_WORDS.test(name)) return 'blue'
  if (n.industry && /^\s*tech:/i.test(n.industry)) return 'white'
  // A chip maker or a drug maker files under manufacturing (31-33), and its filings are mostly engineers and scientists.
  if (n.companyIndustry && KNOWLEDGE_BUCKETS.has(n.companyIndustry)) return 'white'
  const sector = naicsSector(n.industry)
  if (sector && KNOWLEDGE_SECTORS.has(sector)) return 'white'
  if (sector && BLUE_SECTORS.has(sector)) return 'blue'
  if (filing && n.companyIndustry && BLUE_BUCKETS.has(n.companyIndustry)) return 'blue'
  return 'unknown'
}
