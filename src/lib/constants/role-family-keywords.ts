// Finer-grained than CANONICAL_FUNCTION_KEYWORDS (match-by-function.ts) —
// those 13 buckets are broad enough that "Corporate Development VP" and
// "Investment Partner" both just read as "Finance," which loses the actual
// signal a real recruiter would use to connect them (both M&A-adjacent).
// Title text alone misses this pairing too — the two titles share no
// substring or word. This is the "at least a couple similar skills to
// match roles, besides just title" signal: a title matches a family when it
// contains ANY of that family's keywords, and two titles are related when
// they land in the same family via any keyword, not necessarily the same one.
//
// Deliberately scoped to the executive/professional roles this platform
// actually serves, not an exhaustive title taxonomy — extend with new
// families/keywords as real mismatches turn up, following this file's
// existing pattern rather than growing titleSimilarityBonus's own logic.
export const ROLE_FAMILY_KEYWORDS: { family: string; keywords: string[] }[] = [
  {
    family: 'Mergers & Acquisitions / Corporate Development / Investment',
    // Deliberately no bare 'acquisition' — real bug, not hypothetical: it
    // matched "Talent Acquisition," "Data Acquisition," and "Customer
    // Acquisition" (recruiting/engineering/growth roles, nothing to do with
    // buying companies) as M&A-family titles. 'merger'/'m&a' already cover
    // the genuine case ("Mergers & Acquisitions" contains 'merger').
    keywords: [
      'm&a',
      'merger',
      'corporate development',
      'corp dev',
      'investment banking',
      'investment partner',
      'private equity',
      'venture capital',
      'deal team',
      'transaction advisory',
    ],
  },
  {
    family: 'Corporate Strategy',
    keywords: ['corporate strategy', 'business strategy', 'chief strategy', 'strategy & operations', 'strategic planning'],
  },
  {
    family: 'FP&A / Accounting / Controller',
    keywords: ['fp&a', 'financial planning', 'controller', 'accounting', 'treasury', 'audit'],
  },
  {
    family: 'Product Management',
    keywords: ['product manager', 'product management', 'product lead', 'head of product', 'chief product'],
  },
  {
    family: 'Product Marketing / Go-to-Market',
    keywords: ['product marketing', 'go-to-market', 'gtm strategy'],
  },
  {
    family: 'Growth / Demand Generation',
    keywords: ['growth marketing', 'demand generation', 'performance marketing', 'growth lead'],
  },
  {
    family: 'Brand / Communications',
    keywords: ['brand marketing', 'communications', 'public relations', 'pr manager'],
  },
  {
    family: 'Sales / Business Development',
    keywords: ['account executive', 'business development', 'sales director', 'revenue leader', 'enterprise sales'],
  },
  {
    family: 'Customer Success / Account Management',
    keywords: ['customer success', 'account management', 'client success', 'implementation manager'],
  },
  {
    family: 'Supply Chain / Operations',
    keywords: ['supply chain', 'logistics', 'procurement', 'operations manager'],
  },
  {
    family: 'Human Resources / Talent',
    keywords: ['human resources', 'talent acquisition', 'people operations', 'recruiting leader'],
  },
  {
    family: 'Legal / Compliance',
    keywords: ['general counsel', 'compliance officer', 'regulatory affairs', 'legal counsel'],
  },
  {
    family: 'Software Engineering',
    keywords: ['software engineer', 'backend engineer', 'frontend engineer', 'full stack engineer'],
  },
  {
    family: 'Data Science / Analytics',
    keywords: ['data scientist', 'data analyst', 'business intelligence', 'machine learning'],
  },
  {
    family: 'Design / UX',
    keywords: ['ux designer', 'product design', 'creative director', 'user experience'],
  },
  {
    family: 'Consulting / Advisory',
    keywords: ['management consultant', 'strategy consultant', 'advisory services'],
  },
  {
    family: 'Real Estate',
    keywords: ['real estate', 'property management', 'asset management', 'leasing director'],
  },
  {
    family: 'Executive / General Management',
    keywords: ['chief executive', 'general manager', 'managing director', 'president'],
  },
]

// Two titles are related when any keyword from the SAME family appears in
// each — the keywords don't need to match each other, e.g. "corporate
// development" in one title and "investment partner" in the other both sit
// in the M&A family. Weaker than a literal substring/word match (see
// titleSimilarityBonus in job-fit-bucket.ts), so callers should treat this
// as a smaller bonus, not a replacement for title-text comparison.
export function titlesShareRoleFamily(titleA: string, titleB: string): boolean {
  const a = titleA.toLowerCase()
  const b = titleB.toLowerCase()
  return ROLE_FAMILY_KEYWORDS.some(
    (group) => group.keywords.some((k) => a.includes(k)) && group.keywords.some((k) => b.includes(k))
  )
}
