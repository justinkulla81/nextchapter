// Curated (not exhaustive) map from a candidate's freeform `primaryFunction`
// to a representative 2018 SOC occupation code (dash removed, 6 digits) and
// a human-readable title used for the Adzuna "what" search query. Codes are
// representative proxies for a broad function, not seniority-specific —
// unmatched functions fall back to "unavailable" rather than guessing.
export const SOC_CODES: Record<string, { code: string; title: string }> = {
  'software engineering': { code: '151252', title: 'Software Developer' },
  engineering: { code: '172199', title: 'Engineer' },
  product: { code: '131082', title: 'Product Manager' },
  'product management': { code: '131082', title: 'Product Manager' },
  'project management': { code: '131082', title: 'Project Manager' },
  design: { code: '271024', title: 'Product Designer' },
  'ux design': { code: '271024', title: 'UX Designer' },
  data: { code: '152051', title: 'Data Scientist' },
  'data science': { code: '152051', title: 'Data Scientist' },
  analytics: { code: '152051', title: 'Data Analyst' },
  marketing: { code: '112021', title: 'Marketing Manager' },
  sales: { code: '112022', title: 'Sales Manager' },
  finance: { code: '132099', title: 'Financial Specialist' },
  accounting: { code: '132011', title: 'Accountant' },
  operations: { code: '111021', title: 'Operations Manager' },
  'customer success': { code: '434051', title: 'Customer Success Manager' },
  'customer support': { code: '434051', title: 'Customer Support Representative' },
  'human resources': { code: '131071', title: 'HR Specialist' },
  hr: { code: '131071', title: 'HR Specialist' },
  recruiting: { code: '131071', title: 'Recruiter' },
  legal: { code: '231011', title: 'Attorney' },
  'quality assurance': { code: '151253', title: 'QA Engineer' },
  qa: { code: '151253', title: 'QA Engineer' },
  strategy: { code: '131111', title: 'Strategy Consultant' },
  consulting: { code: '131111', title: 'Management Consultant' },
  executive: { code: '111011', title: 'Executive' },
  leadership: { code: '111011', title: 'Executive' },
  'content/communications': { code: '273031', title: 'Communications Specialist' },
  communications: { code: '273031', title: 'Communications Specialist' },
  content: { code: '273031', title: 'Content Strategist' },
  'supply chain': { code: '113071', title: 'Supply Chain Manager' },
  logistics: { code: '113071', title: 'Logistics Manager' },
  manufacturing: { code: '511011', title: 'Production Supervisor' },
  healthcare: { code: '119111', title: 'Healthcare Services Manager' },
  education: { code: '131151', title: 'Training and Development Specialist' },
  training: { code: '131151', title: 'Training and Development Specialist' },
}

export function lookupSocCode(primaryFunction: string | null): { code: string; title: string } | null {
  if (!primaryFunction) return null
  return SOC_CODES[primaryFunction.trim().toLowerCase()] ?? null
}
