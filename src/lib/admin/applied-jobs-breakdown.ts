// What kind of jobs visitors click "Apply" on: the buckets behind /support/admin/visitors/applied.
// Every count is applies (clicks), so a job applied to three times counts three times.

export interface AppliedJob {
  url: string
  title: string
  companyName: string
  clicks: number
  people: number
  lastAt: Date
  function: string | null
  level: string | null
  state: string | null
  industry: string | null
  salaryMin: number | null
  salaryMax: number | null
  yearsMin: number | null
  noExperience: boolean
  aiExposed: boolean | null
  aiMention: boolean | null
  aiExposureLevel: string | null
}

export interface Bucket {
  label: string
  applies: number
}

const LEVEL_LABELS: Record<string, string> = {
  ENTRY_IC: 'Entry level',
  EARLY_IC: 'Early career',
  MID_IC: 'Mid level',
  SENIOR_IC: 'Senior individual contributor',
  PRINCIPAL: 'Principal / staff',
  MANAGER: 'Manager',
  SR_MANAGER: 'Senior manager',
  DIRECTOR: 'Director',
  HEAD: 'Head of',
  VP: 'Vice president',
  EVP_SVP: 'SVP / EVP',
  C_SUITE: 'C-suite',
  CHIEF_OF_STAFF: 'Chief of staff',
  PARTNER: 'Partner',
  BOARD: 'Board',
  SCHOOL_LEADER: 'School leader',
  OTHER: 'Other',
}

const NOT_SET = 'Not classified'

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function levelLabel(level: string | null): string {
  return level ? (LEVEL_LABELS[level] ?? titleCase(level.toLowerCase())) : NOT_SET
}

export function payBand(min: number | null, max: number | null): string {
  const mid = min != null && max != null ? (min + max) / 2 : (max ?? min)
  if (mid == null || mid <= 0) return 'Pay not posted'
  if (mid < 50_000) return 'Under $50k'
  if (mid < 75_000) return '$50k–$75k'
  if (mid < 100_000) return '$75k–$100k'
  if (mid < 150_000) return '$100k–$150k'
  return '$150k and up'
}

export function experienceBucket(job: Pick<AppliedJob, 'noExperience' | 'yearsMin'>): string {
  if (job.noExperience) return 'No experience needed'
  const years = job.yearsMin
  if (years == null) return 'Years not stated'
  if (years <= 2) return 'Up to 2 years'
  if (years <= 5) return '3–5 years'
  if (years <= 9) return '6–9 years'
  return '10 or more years'
}

export function aiMentionBucket(job: Pick<AppliedJob, 'aiMention'>): string {
  return job.aiMention ? 'Posting names AI skills or tools' : 'No AI in the posting'
}

export function aiExposureBucket(job: Pick<AppliedJob, 'aiExposureLevel'>): string {
  const level = job.aiExposureLevel
  if (!level) return 'Not rated'
  return `${titleCase(level)} exposure to AI`
}

export function tally(jobs: AppliedJob[], pick: (job: AppliedJob) => string | null, order?: string[]): Bucket[] {
  const counts = new Map<string, number>()
  for (const job of jobs) {
    const label = pick(job) ?? NOT_SET
    counts.set(label, (counts.get(label) ?? 0) + job.clicks)
  }
  const buckets = Array.from(counts, ([label, applies]) => ({ label, applies }))
  if (order) {
    const rank = (label: string) => {
      const i = order.indexOf(label)
      return i === -1 ? order.length : i
    }
    return buckets.sort((a, b) => rank(a.label) - rank(b.label) || b.applies - a.applies)
  }
  return buckets.sort((a, b) => b.applies - a.applies || a.label.localeCompare(b.label))
}

export const PAY_ORDER = ['Under $50k', '$50k–$75k', '$75k–$100k', '$100k–$150k', '$150k and up', 'Pay not posted']
export const EXPERIENCE_ORDER = ['No experience needed', 'Up to 2 years', '3–5 years', '6–9 years', '10 or more years', 'Years not stated']
export const AI_EXPOSURE_ORDER = ['High exposure to AI', 'Medium exposure to AI', 'Low exposure to AI', 'Not rated']

export function industryLabel(industry: string | null): string | null {
  return industry ? titleCase(industry) : null
}

/** The middle of the posted pay ranges, ignoring jobs with no pay posted. */
export function medianPay(jobs: AppliedJob[]): number | null {
  const mids: number[] = []
  for (const job of jobs) {
    const mid = job.salaryMin != null && job.salaryMax != null ? (job.salaryMin + job.salaryMax) / 2 : (job.salaryMax ?? job.salaryMin)
    if (mid != null && mid > 0) for (let i = 0; i < job.clicks; i++) mids.push(mid)
  }
  if (mids.length === 0) return null
  mids.sort((a, b) => a - b)
  const half = Math.floor(mids.length / 2)
  return mids.length % 2 ? mids[half] : (mids[half - 1] + mids[half]) / 2
}
