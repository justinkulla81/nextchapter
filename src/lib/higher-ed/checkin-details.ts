// The check-in's second step, shared by the answer page (client) and the server: which details each answer asks for,
// and how far a job change goes. No server imports here.

// Type-only: answer keys from the check-in answers list.
type CollegeCheckInAnswer = 'good' | 'looking' | 'laid_off' | 'new_job' | 'new_manager' | 'back_to_school' | 'starting_company'

export type ChangeDistance = 'same' | 'adjacent' | 'new'
export const CHANGE_DISTANCES: { key: ChangeDistance; label: string }[] = [
  { key: 'same', label: 'Same kind of role, somewhere new' },
  { key: 'adjacent', label: 'A new field that builds on what I do' },
  { key: 'new', label: 'A whole new field' },
]
export const isChangeDistance = (x: unknown): x is ChangeDistance => CHANGE_DISTANCES.some((d) => d.key === x)

/** What the alum told the college after the answer. Every field is optional: they can skip. */
export type CheckInDetails = {
  employer?: string
  title?: string
  target?: string // the role or field they want next, or the subject they'd study
  distance?: ChangeDistance
  teamSize?: string
  company?: string // the company they are starting
}

/** Which fields each answer asks for (the form shows only these). */
export const DETAIL_FIELDS: Record<CollegeCheckInAnswer, (keyof CheckInDetails)[]> = {
  good: ['employer', 'title'],
  looking: ['employer', 'title', 'target', 'distance'],
  laid_off: ['employer', 'title', 'target'],
  new_job: ['employer', 'title'],
  new_manager: ['title', 'teamSize'],
  back_to_school: ['target'],
  starting_company: ['company'],
}

const clip = (s: unknown, n = 120) => (typeof s === 'string' ? s.trim().slice(0, n) : '') || undefined

export function cleanDetails(answer: CollegeCheckInAnswer, raw: Record<string, unknown>): CheckInDetails {
  const out: CheckInDetails = {}
  for (const f of DETAIL_FIELDS[answer]) {
    if (f === 'distance') {
      if (isChangeDistance(raw.distance)) out.distance = raw.distance
    } else {
      const v = clip(raw[f])
      if (v) out[f] = v
    }
  }
  return out
}

