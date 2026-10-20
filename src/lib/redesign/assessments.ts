// The redesigned "How I work" page: for each assessment, one plain reason to take it, one fact (the time
// it takes, or when it was done) and which one to suggest first. Pure, so it is tested without a database.

/** What taking each assessment gets the member, in plain words. */
export const ASSESSMENT_WHY: Record<string, string> = {
  'working-style': 'Shows employers how you work with other people, and sharpens the advice we write for you.',
  performance: 'Shows how you get things done and hold up under pressure, in your own words and your references’.',
  skills: 'Opens up more jobs and courses that fit what you can already do.',
  'track-record': 'Backs your résumé with the scope and ownership you have actually had.',
  'what-i-need': 'Keeps your search and your offers pointed at what you will not trade away.',
  'work-interests': 'Finds roles you would enjoy, not only roles you could do.',
  'reference-check': 'Lets people who worked with you confirm what you say about yourself, which is what hiring managers trust most.',
}

/** Sentence-case names for the redesign. */
export const ASSESSMENT_TITLE: Record<string, string> = {
  'working-style': 'How I work best',
  performance: 'How I perform',
  skills: 'Skills',
  'track-record': 'Track record',
  'what-i-need': 'What I need',
  'work-interests': 'Work interests',
  'reference-check': 'Reference check',
}

export interface AssessmentInput {
  key: string
  title: string
  completedAt: Date | null
  /** Points earned for finishing it. One point is one minute of real search work. */
  points: number
  href: string
  ctaLabel: string
  /** Replaces the date line, for example "2 / 3 references". */
  statusLabel?: string
}

export interface AssessmentRow {
  key: string
  title: string
  why: string
  fact: string
  done: boolean
  href: string
  ctaLabel: string
}

const dateFmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** One fact per row: how long it takes while it is open, or when it was finished. */
export function assessmentFact(a: Pick<AssessmentInput, 'completedAt' | 'points' | 'statusLabel'>): string {
  if (a.statusLabel && a.completedAt) return a.statusLabel
  if (a.completedAt) return `Done ${dateFmt(a.completedAt)}`
  const minutes = Math.max(1, Math.round(a.points))
  return `About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

export function shapeAssessments(inputs: AssessmentInput[]): AssessmentRow[] {
  return inputs.map((a) => ({
    key: a.key,
    title: ASSESSMENT_TITLE[a.key] ?? a.title,
    why: ASSESSMENT_WHY[a.key] ?? 'Makes your matches and your advice fit you better.',
    fact: assessmentFact(a),
    done: !!a.completedAt,
    href: a.href,
    ctaLabel: a.ctaLabel,
  }))
}

/** The one to suggest: the first not done, in the order given (the page puts the most useful first). */
export function nextAssessment(rows: AssessmentRow[]): AssessmentRow | null {
  return rows.find((r) => !r.done) ?? null
}
