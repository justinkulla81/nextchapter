// Form D (Regulation D private placement notice) reader and filter. Pure —
// tested with fixture XML. A Form D says a company sold securities privately;
// a big one at an operating company usually funds senior hires. Most Form D
// filers are not that: they are pooled funds, single-deal SPVs and real
// estate vehicles with no staff, so the filter below is mostly exclusions.

export const FORM_D_MIN_AMOUNT = 10_000_000

export interface FormDFiling {
  cik: string
  entityName: string
  entityType: string | null
  industryGroupType: string | null
  isPooledFund: boolean
  isAmendment: boolean
  totalOfferingAmount: number | null
  totalAmountSold: number | null
  city: string | null
  state: string | null
  federalExemptions: string[]
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? decodeXml(m[1].trim()) : null
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
}

function amount(s: string | null): number | null {
  if (!s) return null
  const n = Number(s.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null // "Indefinite" -> null
}

export function parseFormDXml(xml: string): FormDFiling | null {
  const issuer = xml.match(/<primaryIssuer>([\s\S]*?)<\/primaryIssuer>/i)?.[1]
  if (!issuer) return null
  const offering = xml.match(/<offeringData>([\s\S]*?)<\/offeringData>/i)?.[1] ?? ''
  const exemptionsBlock = offering.match(/<federalExemptionsExclusions>([\s\S]*?)<\/federalExemptionsExclusions>/i)?.[1] ?? ''
  return {
    cik: (tag(issuer, 'cik') ?? '').replace(/^0+/, ''),
    entityName: tag(issuer, 'entityName') ?? '',
    entityType: tag(issuer, 'entityType'),
    industryGroupType: tag(offering, 'industryGroupType'),
    isPooledFund: /<investmentFundInfo>/i.test(offering) || /pooled investment fund/i.test(tag(offering, 'industryGroupType') ?? ''),
    isAmendment: tag(offering, 'isAmendment') === 'true',
    totalOfferingAmount: amount(tag(offering, 'totalOfferingAmount')),
    totalAmountSold: amount(tag(offering, 'totalAmountSold')),
    city: tag(issuer, 'city'),
    state: tag(issuer, 'stateOrCountry'),
    federalExemptions: [...exemptionsBlock.matchAll(/<item>([^<]+)<\/item>/gi)].map((m) => m[1].trim()),
  }
}

// Industry groups that are money or property, not a company with a team.
const EXCLUDED_INDUSTRY_GROUPS = [
  'pooled investment fund',
  'investing',
  'reits and finance',
  'residential',
  'commercial',
  'construction',
  'other real estate',
  // Structured-note and deal issuers ("GS Finance Corp."), hotel owners.
  'investment banking',
  'lodging and conventions',
]

// Single-purpose vehicles: "XYZ Fund II, LP", "Acme I, a series of Capitalize
// Investments LLC", "123 Main St Investors LLC", "Foo Co-Invest", "DW
// Oklahoma 56 LP".
const VEHICLE_NAME_RE =
  /\b(fund|funds|feeder|master|co-?invest(?:ment|ors)?|investors?|a series of|series [a-z0-9]+|spv|vehicle|opportunit(?:y|ies) (?:i|ii|iii|iv|v)|partners (?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\b|holdings? (?:i|ii|iii|iv|v)|capital partners|ventures? (?:i|ii|iii|iv|v)\b|gp|l\.?p\.?|lp|apartments|properties|realty|real estate|reit|dst)\b/i
const ADDRESS_NAME_RE = /^\d{2,}\s/ // "1330 Conn Investors", "90 NE 39th St Restaurant"
// Single-deal vehicles that slip past the list above: "Colossal Bio
// Opportunities", "Definition II-A", "DMJC Colossal III", "Frontier Z 1",
// "Quantum SPVG1", "Wildlife Partners EBP #2026B", "Vision EB5 Glassboro",
// "Black Diamond Funding Ventures", "Peachtree Hotel Partners", "Secret
// Production Five".
const VEHICLE_NAME_EXTRA_RE =
  /\bopportunit(?:y|ies)\b|\b(?:[IVX]+|\d+)-[A-Z]\b|\b(?:ii|iii|iv|vi|vii|viii|ix)$|\s\d{1,2}$|\bspv\w*|#|\b(?:19|20)\d{2}-?[A-Z]\b|\beb-?5\b|\bfunding\b|\bacquisitions?\b|\b(?:hotel|inn|resort)s?\b|\bproductions? (?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i

export function looksLikeVehicleName(name: string): boolean {
  const bare = name.replace(/,?\s*(?:inc|llc|l\.l\.c|corp|corporation|co|ltd|lp|pbc)\.?$/i, '').trim()
  return VEHICLE_NAME_RE.test(name) || ADDRESS_NAME_RE.test(name) || VEHICLE_NAME_EXTRA_RE.test(bare)
}

export function isExcludedIndustry(industryGroupType: string | null | undefined): boolean {
  return EXCLUDED_INDUSTRY_GROUPS.includes((industryGroupType ?? '').toLowerCase())
}

export type FormDVerdict = { keep: true; amount: number; closed: boolean } | { keep: false; reason: string }

/**
 * Keep a Form D only when it is a new raise (not an amendment), at an
 * operating company (not a fund, SPV, LP or real estate vehicle), with at
 * least FORM_D_MIN_AMOUNT sold — or a round of at least that size that has
 * started selling.
 */
export function judgeFormD(f: FormDFiling, minAmount = FORM_D_MIN_AMOUNT): FormDVerdict {
  if (f.isAmendment) return { keep: false, reason: 'amendment' }
  if (f.isPooledFund) return { keep: false, reason: 'pooled fund' }
  // Section 3(c) exclusions are the Investment Company Act carve-outs funds use.
  if (f.federalExemptions.some((e) => /^3c/i.test(e))) return { keep: false, reason: 'investment company exemption' }
  if (isExcludedIndustry(f.industryGroupType)) return { keep: false, reason: `industry: ${f.industryGroupType}` }
  if (/limited partnership/i.test(f.entityType ?? '')) return { keep: false, reason: 'limited partnership' }
  if (looksLikeVehicleName(f.entityName)) return { keep: false, reason: 'investment vehicle name' }
  const sold = f.totalAmountSold ?? 0
  if (sold >= minAmount) return { keep: true, amount: sold, closed: true }
  // Money already coming in on a big round that is still open counts too.
  const offered = f.totalOfferingAmount ?? 0
  if (sold > 0 && offered >= minAmount) return { keep: true, amount: offered, closed: false }
  return { keep: false, reason: 'below threshold' }
}

export function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  return `$${(amount / 1_000_000).toFixed(amount >= 100_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
}

export function fundingSummary(companyName: string, f: FormDFiling, amount: number, closed: boolean): string {
  const sector = f.industryGroupType && !/^other/i.test(f.industryGroupType) ? ` (${f.industryGroupType.toLowerCase()})` : ''
  const verb = closed ? 'raised' : 'is raising'
  return `${companyName}${sector} ${verb} ${formatAmount(amount)} in a private round. Fresh funding usually means senior hires in the next few months.`
}
