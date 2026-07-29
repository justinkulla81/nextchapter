// Normalized industry buckets — CandidateProfile.industryContext is free
// text (resume-derived), which fragments badly if grouped naively ("Fintech"
// vs "Financial Technology" vs "Financial Services" would each form their
// own tiny Community group). This maps free text into a fixed set of ~27
// buckets via keyword match, most-specific-first so e.g. "fintech" resolves
// to Financial Services rather than Technology.
//
// normalizeIndustryBucket() returns null on no match — it never forces
// "Other," so a candidate whose industry text doesn't cleanly map just
// doesn't get an industry group, rather than being lumped into a meaningless
// catch-all bucket.

const INDUSTRY_BUCKETS: { bucket: string; keywords: string[] }[] = [
  { bucket: 'Financial Services & Banking', keywords: ['fintech', 'financial services', 'banking', 'bank', 'wealth management', 'asset management', 'capital markets', 'private equity', 'venture capital', 'hedge fund'] },
  { bucket: 'Insurance', keywords: ['insurance', 'insurtech', 'reinsurance', 'actuarial'] },
  { bucket: 'Accounting & Audit', keywords: ['accounting', 'audit', 'tax advisory', 'cpa firm'] },
  { bucket: 'Legal Services', keywords: ['legal services', 'law firm', 'legal', 'litigation'] },
  { bucket: 'Professional Services & Consulting', keywords: ['consulting', 'professional services', 'management consulting', 'advisory services'] },
  { bucket: 'Technology & Software', keywords: ['software', 'saas', 'technology', 'tech company', 'it services', 'cloud computing', 'cybersecurity'] },
  { bucket: 'Telecommunications', keywords: ['telecom', 'telecommunications', 'wireless', 'broadband'] },
  { bucket: 'Healthcare & Hospital Systems', keywords: ['healthcare', 'hospital', 'health system', 'clinical', 'health care', 'medical center'] },
  { bucket: 'Pharmaceuticals & Biotech', keywords: ['pharmaceutical', 'biotech', 'life sciences', 'drug development', 'clinical research'] },
  { bucket: 'Medical Devices', keywords: ['medical device', 'medtech', 'diagnostics equipment'] },
  { bucket: 'Retail & E-commerce', keywords: ['retail', 'e-commerce', 'ecommerce', 'online retail', 'consumer retail'] },
  { bucket: 'Consumer Packaged Goods', keywords: ['consumer packaged goods', 'cpg', 'fmcg', 'consumer goods'] },
  { bucket: 'Hospitality, Travel & Food Service', keywords: ['hospitality', 'travel', 'hotel', 'restaurant', 'food service', 'airline', 'tourism'] },
  { bucket: 'Agriculture & Food Production', keywords: ['agriculture', 'agtech', 'farming', 'food production', 'food manufacturing'] },
  { bucket: 'Manufacturing & Industrial', keywords: ['manufacturing', 'industrial', 'factory', 'production facility'] },
  { bucket: 'Automotive & Mobility', keywords: ['automotive', 'mobility', 'ev', 'electric vehicle', 'auto industry'] },
  { bucket: 'Aerospace & Defense', keywords: ['aerospace', 'defense', 'defence', 'aviation manufacturing'] },
  { bucket: 'Energy & Utilities', keywords: ['energy', 'utilities', 'oil and gas', 'renewable energy', 'power generation', 'utility'] },
  { bucket: 'Construction & Real Estate', keywords: ['construction', 'real estate', 'property management', 'commercial real estate', 'homebuilding'] },
  { bucket: 'Transportation & Logistics', keywords: ['transportation', 'logistics', 'supply chain', 'freight', 'shipping', 'trucking'] },
  { bucket: 'Media & Entertainment', keywords: ['media', 'entertainment', 'streaming', 'film', 'gaming', 'publishing'] },
  { bucket: 'Advertising, Marketing & PR', keywords: ['advertising', 'marketing agency', 'public relations', 'pr agency', 'ad agency'] },
  { bucket: 'Education & EdTech', keywords: ['education', 'edtech', 'higher education', 'university', 'k-12', 'school district'] },
  { bucket: 'Government & Public Sector', keywords: ['government', 'public sector', 'federal agency', 'municipal', 'state agency'] },
  { bucket: 'Nonprofit & Social Impact', keywords: ['nonprofit', 'non-profit', 'ngo', 'social impact', 'philanthropy'] },
  { bucket: 'Staffing & Human Capital', keywords: ['staffing', 'human capital', 'recruiting firm', 'talent agency'] },
  { bucket: 'Other', keywords: ['other industry', 'various industries'] },
]

export function normalizeIndustryBucket(freeText: string | null): string | null {
  if (!freeText) return null
  const normalized = freeText.toLowerCase()
  const match = INDUSTRY_BUCKETS.find((b) => b.keywords.some((k) => normalized.includes(k)))
  return match?.bucket ?? null
}

export const INDUSTRY_BUCKET_NAMES = INDUSTRY_BUCKETS.map((b) => b.bucket)
