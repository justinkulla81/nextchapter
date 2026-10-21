// Reading industries: a member's free-text industry ("Venture capital / AI startups") into
// one or more industry buckets (industry-buckets.ts), and a job's crawler industry key
// ("financial_services") into the same buckets. Pure, unit-tested in
// src/test/industry-reading.test.ts. Deterministic: keyword allowlists, whole words only.
//
// A member's reading is "uncertain" when the text names several industries or none we
// know; Search Strategy then asks them to confirm with one click
// (CandidateProfile.industryBuckets), and the confirmed set is used from then on.

import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'

/** The crawler's industry keys (ncrawl taxonomy) → bucket. Keys not listed ('consumer') stay unmapped. */
export const JOB_INDUSTRY_KEY_BUCKET: Record<string, string> = {
  technology: 'Technology & Software',
  healthcare: 'Healthcare & Hospital Systems',
  industrial: 'Manufacturing & Industrial',
  financial_services: 'Financial Services & Banking',
  aerospace_defense: 'Aerospace & Defense',
  professional_services: 'Professional Services & Consulting',
  life_sciences: 'Pharmaceuticals & Biotech',
  education: 'Education & EdTech',
  government: 'Government & Public Sector',
  energy: 'Energy & Utilities',
  logistics: 'Transportation & Logistics',
  nonprofit: 'Nonprofit & Social Impact',
  real_estate: 'Construction & Real Estate',
  media: 'Media & Entertainment',
  agriculture: 'Agriculture & Food Production',
  telecom: 'Telecommunications',
}

/** A job's industry bucket: its crawler key when it is one, else the free-text reading. Null for 'Other' / unknown. */
export function jobIndustryBucket(industry: string | null | undefined): string | null {
  if (!industry) return null
  const key = industry.trim().toLowerCase()
  const b = JOB_INDUSTRY_KEY_BUCKET[key] ?? normalizeIndustryBucket(key.replace(/_/g, ' '))
  return b && b !== 'Other' ? b : null
}

// Member-side phrases, whole words, most specific first. Extends industry-buckets.ts with the
// words people use about themselves ("AI startups", "VC") that a substring match can't take
// safely ("ai" is inside "retail").
const MEMBER_PHRASES: [RegExp, string][] = [
  [/\b(venture capital|vc|private equity|pe firm|growth equity|venture firm|buyout)\b/, 'Venture Capital & Private Equity'],
  [/\b(ai|artificial intelligence|machine learning|startups?|saas|software|tech|technology|cloud|cybersecurity|developer tools)\b/, 'Technology & Software'],
  [/\b(fintech|bank|banking|financial services|wealth management|asset management|capital markets|hedge funds?)\b/, 'Financial Services & Banking'],
  [/\b(health ?care|hospitals?|health systems?|clinical|medical centers?)\b/, 'Healthcare & Hospital Systems'],
  [/\b(biotech|pharma|pharmaceuticals?|life sciences)\b/, 'Pharmaceuticals & Biotech'],
  [/\b(higher education|universit(y|ies)|colleges?|k-12|schools?|edtech|education)\b/, 'Education & EdTech'],
  [/\b(consulting|professional services|advisory)\b/, 'Professional Services & Consulting'],
  [/\b(manufacturing|industrial)\b/, 'Manufacturing & Industrial'],
  [/\b(retail|e-?commerce)\b/, 'Retail & E-commerce'],
  [/\b(nonprofits?|non-profits?|ngos?|philanthropy|social impact)\b/, 'Nonprofit & Social Impact'],
  [/\b(government|public sector|federal|municipal)\b/, 'Government & Public Sector'],
  [/\b(media|entertainment|publishing|gaming|streaming)\b/, 'Media & Entertainment'],
  [/\b(logistics|supply chain|transportation|freight)\b/, 'Transportation & Logistics'],
  [/\b(energy|utilities|oil and gas|renewables?)\b/, 'Energy & Utilities'],
  [/\b(real estate|construction|property management)\b/, 'Construction & Real Estate'],
  [/\b(insurance|insurtech)\b/, 'Insurance'],
  [/\b(staffing|recruiting firm|executive search)\b/, 'Staffing & Human Capital'],
]

export interface IndustryReading {
  /** Buckets read from the text, in the order they appear. */
  buckets: string[]
  /** Several industries, or none we know: ask the member to confirm. */
  uncertain: boolean
}

export function readMemberIndustries(...texts: (string | null | undefined)[]): IndustryReading {
  const buckets: string[] = []
  let unread = false
  let multi = false
  for (const text of texts) {
    if (!text?.trim()) continue
    for (const part of text.toLowerCase().split(/[/,;|+&]|\band\b/).map((p) => p.trim()).filter(Boolean)) {
      const hits = MEMBER_PHRASES.filter(([re]) => re.test(part)).map(([, b]) => b)
      if (hits.length === 0) {
        const fallback = normalizeIndustryBucket(part)
        if (fallback && fallback !== 'Other') hits.push(fallback)
        else unread = true
      }
      if (hits.length > 1) multi = true
      for (const h of hits) if (!buckets.includes(h)) buckets.push(h)
    }
  }
  return { buckets, uncertain: multi || buckets.length > 1 || (unread && buckets.length === 0) }
}

/** The member's industries: their confirmed choice, else the reading of their industry text. */
export function memberIndustryBuckets(m: {
  industryBuckets?: string[] | null
  industryContext?: string | null
  secondaryIndustryContext?: string | null
  targetIndustries?: string[] | null
}): string[] {
  if (m.industryBuckets && m.industryBuckets.length > 0) return m.industryBuckets
  return readMemberIndustries(m.industryContext, m.secondaryIndustryContext, ...(m.targetIndustries ?? [])).buckets
}
