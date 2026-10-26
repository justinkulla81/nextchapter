// Decides what kind of event a title/description is, which part of the product it feeds, and how professional it looks.
// Pure keyword rules, no model calls: the crawler runs this on thousands of rows.

export type LocalEventKind = 'JOB_FAIR' | 'HIRING_EVENT' | 'CAREER_WORKSHOP' | 'NETWORKING' | 'RAPID_RESPONSE' | 'STARTUP_WORKSHOP' | 'SMALL_BUSINESS_COUNSELING' | 'PITCH' | 'FUNDING' | 'BUSINESS_NETWORKING' | 'OTHER'
export type LocalEventTrack = 'JOBS' | 'ENTREPRENEUR'

export const ENTREPRENEUR_KINDS: LocalEventKind[] = ['STARTUP_WORKSHOP', 'SMALL_BUSINESS_COUNSELING', 'PITCH', 'FUNDING', 'BUSINESS_NETWORKING']

const RULES: [LocalEventKind, RegExp][] = [
  ['RAPID_RESPONSE', /rapid response|laid.?off|layoff|dislocated worker|transition(?:ing)? workers?/i],
  ['PITCH', /pitch (?:night|competition|day|contest)|demo day|shark tank|startup showcase/i],
  ['FUNDING', /funding|capital|grant|loan|sba |investor|angel|financing/i],
  ['SMALL_BUSINESS_COUNSELING', /small business|sbdc|score |mentor(?:ing)? (?:session|hours)|business counsel|business plan|one-on-one|office hours/i],
  ['STARTUP_WORKSHOP', /start(?:ing)? (?:a|your) (?:own )?(?:business|company)|startup|entrepreneur|founder|launch(?:ing)? your|business owner|franchis/i],
  ['JOB_FAIR', /job fair|career fair|hiring fair|recruitment fair|employment expo|career expo|job expo|hiring expo/i],
  ['HIRING_EVENT', /hiring event|hiring day|open house|recruiting event|meet (?:the )?employers?|employer (?:panel|showcase)|on-?the-?spot interview|interview day/i],
  ['CAREER_WORKSHOP', /resume|r[eé]sum[eé]|linkedin|interview(?:ing)? (?:skills|prep|workshop)|career (?:workshop|coach|transition|change|exploration)|job search|networking for job|salary negotiation/i],
  ['BUSINESS_NETWORKING', /business (?:after hours|mixer|networking)|chamber (?:mixer|luncheon|breakfast)|ribbon cutting|business card exchange|networking (?:breakfast|lunch|luncheon|mixer)|after hours/i],
  ['NETWORKING', /networking|meetup|professional(?:s)? (?:night|social)|young professionals/i],
]

export function classifyKind(text: string): LocalEventKind {
  for (const [k, re] of RULES) if (re.test(text)) return k
  return 'OTHER'
}

export const trackOf = (k: LocalEventKind): LocalEventTrack => (ENTREPRENEUR_KINDS.includes(k) ? 'ENTREPRENEUR' : 'JOBS')

const PRO_UP = /professional|manager|director|executive|engineer|analyst|finance|accounting|marketing|technology|tech |software|healthcare (?:professional|administration)|nurse|attorney|legal|consult|senior|mid-?career|career (?:change|transition)|white.?collar|business|corporate|leadership|salaried|college graduate|degree|startup|founder|entrepreneur|linkedin|resume|r[eé]sum[eé]/i
const PRO_DOWN = /warehouse|forklift|production line|assembly|cdl|driver|housekeep|dishwash|cashier|fast.?food|retail associate|seasonal|restaurant|janitor|general labor|hourly|entry.?level (?:production|manufacturing)|food service|bagger|stocker|teen|youth summer|ged class|high school/i
const NOT_JOBS_OR_BUSINESS = /bingo|yoga|concert|festival|parade|fundraiser gala|golf|5k|farmers market|storytime|kids|preschool|vendor market|craft fair|trivia|holiday|santa|egg hunt|blood drive/i

/** 0-100: how professional / white-collar it looks. Below 35 the event is not published. */
export function proScore(text: string, kind: LocalEventKind): number {
  let s = 50
  if (PRO_UP.test(text)) s += 20
  if (PRO_DOWN.test(text)) s -= 30
  if (NOT_JOBS_OR_BUSINESS.test(text)) s -= 40
  if (kind === 'OTHER') s -= 25
  if (ENTREPRENEUR_KINDS.includes(kind)) s += 10
  if (kind === 'CAREER_WORKSHOP' || kind === 'RAPID_RESPONSE') s += 10
  return Math.max(0, Math.min(100, s))
}

export const PUBLISH_MIN_SCORE = 35

const NOISE = /^(?:office |center |centre )?closed\b|closed (?:in observance|for|on)|holiday|observance|office hours? (?:at|in)|^openmeansjobs at\b|^ohiomeansjobs at\b|at the library\b|mobile job center|^cancel+ed|postponed|board meeting|committee meeting|commission meeting|public hearing/i

/** Closures, drop-in office schedules and governance meetings: on a calendar but not an event a member would attend. */
export const isNoise = (title: string): boolean => NOISE.test(title.trim())
