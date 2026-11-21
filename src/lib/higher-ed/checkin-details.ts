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


// The member function (PRIMARY_FUNCTION_OPTIONS) a typed role or field names, or null when it names none (teaching and
// nursing are fields of their own, with no function in the skills market). First match wins. Exported for tests.
const FUNCTION_WORDS: [RegExp, string][] = [
  [/\b(data|analytics?|analyst|data scien\w*)\b/, 'Data & Analytics'],
  [/\bproduct\b/, 'Product'],
  [/\b(marketing|brand|growth|communications?)\b/, 'Marketing'],
  [/\b(finance|financial|accounting|accountant|fp&a|treasury|controller)\b/, 'Finance'],
  [/\b(sales|business development|account executive)\b/, 'Sales'],
  [/\b(engineer\w*|software|developer|devops)\b/, 'Engineering'],
  [/\b(design|designer|ux|ui)\b/, 'Design'],
  [/\b(hr|human resources|recruit\w*|talent|people operations)\b/, 'Human Resources'],
  [/\b(legal|law|lawyer|attorney|paralegal|compliance)\b/, 'Legal'],
  [/\b(customer success|account manage\w*|client services)\b/, 'Customer Success'],
  [/\b(operations|ops|supply chain|logistics|procurement)\b/, 'Operations'],
  [/\b(administrat\w*|executive assistant|office manager)\b/, 'Administration'],
]
export function functionFromText(text: string | undefined): string | null {
  const t = (text ?? '').toLowerCase()
  if (!t.trim()) return null
  return FUNCTION_WORDS.find(([re]) => re.test(t))?.[1] ?? null
}
