// What a layoff story asks and how the answers are checked and counted. Pure, so the rules are tested. The structured answers are
// closed lists (counted); the story is plain text a person reads before it is shown.

export interface Option { key: string; label: string }

export const FUNCTIONS: Option[] = [
  { key: 'engineering', label: 'Engineering' }, { key: 'product', label: 'Product' }, { key: 'design', label: 'Design' },
  { key: 'sales', label: 'Sales' }, { key: 'marketing', label: 'Marketing' }, { key: 'customer_success', label: 'Customer success' },
  { key: 'operations', label: 'Operations' }, { key: 'finance', label: 'Finance' }, { key: 'people', label: 'People and HR' },
  { key: 'legal', label: 'Legal' }, { key: 'data', label: 'Data' }, { key: 'it', label: 'IT' }, { key: 'other', label: 'Other' },
]
export const LEVELS: Option[] = [
  { key: 'ic', label: 'Individual contributor' }, { key: 'manager', label: 'Manager' }, { key: 'director', label: 'Director' }, { key: 'vp_plus', label: 'VP or above' },
]
export const TENURES: Option[] = [
  { key: 'lt1', label: 'Under 1 year' }, { key: '1to3', label: '1 to 3 years' }, { key: '3to7', label: '3 to 7 years' }, { key: '7plus', label: '7 years or more' },
]
export const FOUND_OUT: Option[] = [
  { key: 'meeting', label: 'A live meeting' }, { key: 'email', label: 'An email' }, { key: 'chat', label: 'A chat message' },
  { key: 'access', label: 'My access was cut off' }, { key: 'other', label: 'Another way' },
]
export const NOTICE_GIVEN: Option[] = [
  { key: 'none', label: 'None' }, { key: 'lt60', label: 'Under 60 days' }, { key: '60plus', label: '60 days or more' }, { key: 'in_lieu', label: 'Paid instead of notice' },
]
export const WARN_NOTICE: Option[] = [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }, { key: 'unsure', label: 'Not sure' }]
export const SEVERANCE: Option[] = [
  { key: 'none', label: 'None' }, { key: 'lt4', label: 'Under 4 weeks' }, { key: '4to8', label: '4 to 8 weeks' }, { key: '9to16', label: '9 to 16 weeks' }, { key: '17plus', label: '17 weeks or more' },
]
export const SIGNED_RELEASE: Option[] = [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }, { key: 'unsure', label: 'Not sure' }]
export const WHERE_NOW: Option[] = [
  { key: 'searching', label: 'Still searching' }, { key: 'new_job', label: 'Started a new job' }, { key: 'freelance', label: 'Freelancing or consulting' }, { key: 'stepped_away', label: 'Stepped away from work' },
]
export const HELP: Option[] = [
  { key: 'leads', label: 'Job leads' }, { key: 'severance_review', label: 'A second look at my severance' }, { key: 'benefits', label: 'Help with benefits' },
  { key: 'coach', label: 'A coach' }, { key: 'peers', label: 'People in the same spot' },
]
export const VISIBILITIES = ['PRIVATE', 'ANONYMOUS', 'NAMED'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const STORY_MAX = 2000
export const STORY_MIN = 40
/** A question's numbers are shown on a company page only once this many confirmed people answered it. */
export const MIN_ANSWERS_TO_SHOW = 5
export const MAX_STORIES_PER_IP_PER_HOUR = 5
export const MAX_STORIES_PER_EMAIL_PER_DAY = 3

const keys = (o: Option[]) => new Set(o.map((x) => x.key))
export const labelOf = (o: Option[], key: string) => o.find((x) => x.key === key)?.label ?? key

export interface StoryInput {
  companySlug: string
  companyName: string
  toldMonth: string
  fn: string
  title: string
  level: string
  tenure: string
  foundOut: string
  noticeGiven: string
  warnNotice: string
  severance: string
  signedRelease: string
  whereNow: string
  helpWanted: string[]
  body: string
  visibility: string
  name: string
  email: string
}
export type StoryCheck = { ok: true; value: StoryInput } | { ok: false; error: string }

const URL_LIKE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|us|gov|edu)\b)/i
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE_LIKE = /(\+?\d[\d\s().-]{8,}\d)/
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const optional = (o: Option[], v: string) => (v === '' || keys(o).has(v) ? v : null)

/** YYYY-MM within the last five years and not in the future. */
export function validMonth(m: string, now: Date = new Date()): boolean {
  const x = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(m)
  if (!x) return false
  const idx = Number(x[1]) * 12 + Number(x[2]) - 1
  const cur = now.getUTCFullYear() * 12 + now.getUTCMonth()
  return idx <= cur && idx >= cur - 60
}

export function checkStoryText(raw: string): { ok: true; text: string } | { ok: false; message: string } {
  const text = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (text === '') return { ok: true, text: '' }
  if (text.length < STORY_MIN) return { ok: false, message: `Write at least ${STORY_MIN} characters, or leave the story blank.` }
  if (text.length > STORY_MAX) return { ok: false, message: `Keep the story to ${STORY_MAX} characters or fewer. It is ${text.length}.` }
  if (/[<>]/.test(text)) return { ok: false, message: 'Use plain text only, without angle brackets.' }
  if (EMAIL_LIKE.test(text)) return { ok: false, message: 'Leave out email addresses, yours and anyone else’s.' }
  if (URL_LIKE.test(text)) return { ok: false, message: 'Leave out links and web addresses.' }
  if (PHONE_LIKE.test(text)) return { ok: false, message: 'Leave out phone numbers.' }
  return { ok: true, text }
}

/** Checks the whole form. `publishOpen` is false while public stories are off: only PRIVATE is accepted then. */
export function checkStory(raw: Record<string, unknown>, publishOpen: boolean, now: Date = new Date()): StoryCheck {
  const companyName = clean(raw.companyName, 120)
  if (companyName.length < 2) return { ok: false, error: 'Choose your company, or type its name.' }
  const toldMonth = String(raw.toldMonth ?? '')
  if (!validMonth(toldMonth, now)) return { ok: false, error: 'Choose the month you were told, within the last five years.' }
  const fn = String(raw.fn ?? '')
  if (!keys(FUNCTIONS).has(fn)) return { ok: false, error: 'Choose your function.' }
  const title = clean(raw.title, 120)
  if (title.length < 2) return { ok: false, error: 'Enter your job title.' }
  const level = String(raw.level ?? '')
  if (!keys(LEVELS).has(level)) return { ok: false, error: 'Choose your level.' }

  const tenure = optional(TENURES, String(raw.tenure ?? ''))
  const foundOut = optional(FOUND_OUT, String(raw.foundOut ?? ''))
  const noticeGiven = optional(NOTICE_GIVEN, String(raw.noticeGiven ?? ''))
  const warnNotice = optional(WARN_NOTICE, String(raw.warnNotice ?? ''))
  const severance = optional(SEVERANCE, String(raw.severance ?? ''))
  const signedRelease = optional(SIGNED_RELEASE, String(raw.signedRelease ?? ''))
  const whereNow = optional(WHERE_NOW, String(raw.whereNow ?? ''))
  if ([tenure, foundOut, noticeGiven, warnNotice, severance, signedRelease, whereNow].some((v) => v === null)) return { ok: false, error: 'One of the answers was not one of the choices. Pick again.' }

  const rawHelp = Array.isArray(raw.helpWanted) ? raw.helpWanted.map(String) : []
  const helpWanted = [...new Set(rawHelp.filter((h) => keys(HELP).has(h)))]

  const text = checkStoryText(String(raw.body ?? ''))
  if (!text.ok) return { ok: false, error: text.message }

  let visibility = String(raw.visibility ?? 'PRIVATE')
  if (!(VISIBILITIES as readonly string[]).includes(visibility)) visibility = 'PRIVATE'
  if (visibility !== 'PRIVATE' && !publishOpen) return { ok: false, error: 'Public stories are not open yet. Choose to keep it private.' }
  if (visibility !== 'PRIVATE' && text.text === '') return { ok: false, error: 'Write your story to publish it, or keep it private.' }

  const email = clean(raw.email, 200).toLowerCase()
  if (email !== '' && !EMAIL_SHAPE.test(email)) return { ok: false, error: 'That email address does not look right. Check it, or leave it blank.' }
  if (visibility !== 'PRIVATE' && email === '') return { ok: false, error: 'Add your email so we can confirm it is you. It is never shown.' }
  const name = clean(raw.name, 120)
  if (visibility === 'NAMED' && name.split(' ').length < 2) return { ok: false, error: 'Enter your first and last name to publish with your name.' }

  return {
    ok: true,
    value: {
      companySlug: clean(raw.companySlug, 200), companyName, toldMonth, fn, title, level,
      tenure: tenure ?? '', foundOut: foundOut ?? '', noticeGiven: noticeGiven ?? '', warnNotice: warnNotice ?? '', severance: severance ?? '', signedRelease: signedRelease ?? '', whereNow: whereNow ?? '',
      helpWanted, body: text.text, visibility, name, email,
    },
  }
}

export type StoryStatus = 'UNVERIFIED' | 'PENDING_EMAIL' | 'COUNTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
/** Statuses whose answers are counted in a company's numbers: the email is confirmed and the person has not withdrawn. */
export const COUNTED_STATUSES: StoryStatus[] = ['COUNTED', 'PENDING_REVIEW', 'APPROVED']

export interface CountRow { fn: string; foundOut: string; noticeGiven: string; severance: string; whereNow: string }
export interface QuestionCounts { answered: number; counts: { key: string; label: string; n: number }[] }
export interface StoryNumbers { total: number; questions: Partial<Record<'fn' | 'foundOut' | 'noticeGiven' | 'severance' | 'whereNow', QuestionCounts>> }

const QUESTIONS: { field: keyof CountRow; options: Option[] }[] = [
  { field: 'fn', options: FUNCTIONS }, { field: 'foundOut', options: FOUND_OUT }, { field: 'noticeGiven', options: NOTICE_GIVEN },
  { field: 'severance', options: SEVERANCE }, { field: 'whereNow', options: WHERE_NOW },
]

/** Counts per answer, for the confirmed rows. A question appears only when MIN_ANSWERS_TO_SHOW people answered it; below that it is left out, never shown as zero. */
export function storyNumbers(rows: CountRow[], min: number = MIN_ANSWERS_TO_SHOW): StoryNumbers {
  const out: StoryNumbers = { total: rows.length, questions: {} }
  for (const q of QUESTIONS) {
    const answered = rows.filter((r) => r[q.field] !== '')
    if (answered.length < min) continue
    const counts = q.options.map((o) => ({ key: o.key, label: o.label, n: answered.filter((r) => r[q.field] === o.key).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n)
    out.questions[q.field as keyof StoryNumbers['questions']] = { answered: answered.length, counts }
  }
  return out
}
