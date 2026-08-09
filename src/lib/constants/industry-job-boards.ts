export interface JobBoardRecommendation {
  name: string
  url: string
}

// General-purpose boards shown to every candidate, regardless of industry.
export const GENERAL_JOB_BOARDS: JobBoardRecommendation[] = [
  { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs' },
  { name: 'Indeed', url: 'https://www.indeed.com' },
  { name: 'TheLadders', url: 'https://www.theladders.com' },
]

// Voluntary, opt-in browsing categories — never shown, hidden, or matched
// based on a candidate's own EEOC self-ID answers (CandidateProfile's
// eeocGenderIdentity/eeocRaceEthnicity exist solely for aggregate
// bias-detection reporting — see src/lib/admin/bias-detection.ts — and are
// never used to change what any individual candidate sees). Every
// candidate can open either list; nothing here is auto-personalized.
export const WOMEN_FOCUSED_JOB_BOARDS: JobBoardRecommendation[] = [
  { name: 'Fairygodboss', url: 'https://fairygodboss.com' },
  { name: 'PowerToFly', url: 'https://powertofly.com' },
  { name: 'Elpha', url: 'https://elpha.com' },
]

export const DIVERSITY_FOCUSED_JOB_BOARDS: JobBoardRecommendation[] = [
  { name: 'Jopwell', url: 'https://www.jopwell.com' },
  { name: 'DiversityJobs.com', url: 'https://www.diversityjobs.com' },
  { name: 'Prospanica', url: 'https://www.prospanica.org' },
]

// Keyed by loose keyword match against a candidate's target industries —
// only includes boards well-known enough to be confident they're real and
// still operating. Deliberately a small starting set, not exhaustive —
// expand as more industries come up.
const INDUSTRY_JOB_BOARDS_BY_KEYWORD: { keywords: string[]; boards: JobBoardRecommendation[] }[] = [
  {
    keywords: ['non-profit', 'nonprofit', 'ngo', 'social impact', 'philanthropy'],
    boards: [
      { name: 'Idealist.org', url: 'https://www.idealist.org' },
      { name: 'On Purpose Careers', url: 'https://www.onpurposecareers.org' },
    ],
  },
  {
    keywords: ['government', 'public sector', 'federal', 'municipal'],
    boards: [{ name: 'USAJOBS', url: 'https://www.usajobs.gov' }],
  },
  {
    keywords: ['education', 'higher ed', 'university', 'academic', 'academia'],
    boards: [{ name: 'HigherEdJobs', url: 'https://www.higheredjobs.com' }],
  },
  {
    keywords: ['tech', 'technology', 'software', 'engineering', 'startup', 'saas'],
    boards: [
      { name: 'Dice', url: 'https://www.dice.com' },
      { name: 'Wellfound', url: 'https://wellfound.com' },
    ],
  },
  {
    keywords: ['healthcare', 'health care', 'hospital', 'medical', 'clinical'],
    boards: [{ name: 'Health eCareers', url: 'https://www.healthecareers.com' }],
  },
]

export function getIndustryJobBoards(targetIndustries: string[]): JobBoardRecommendation[] {
  if (targetIndustries.length === 0) return []
  const normalized = targetIndustries.map((i) => i.toLowerCase())
  const matched: JobBoardRecommendation[] = []
  const seen = new Set<string>()

  for (const group of INDUSTRY_JOB_BOARDS_BY_KEYWORD) {
    const hits = group.keywords.some((keyword) => normalized.some((industry) => industry.includes(keyword)))
    if (!hits) continue
    for (const board of group.boards) {
      if (seen.has(board.name)) continue
      seen.add(board.name)
      matched.push(board)
    }
  }

  return matched
}
