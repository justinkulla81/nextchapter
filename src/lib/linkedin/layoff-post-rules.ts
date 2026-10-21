/**
 * Which layoffs get a suggested LinkedIn post, and what the post says. Pure,
 * so the gate and the wording are testable without a database.
 *
 * The posts are suggestions for a person to read, edit and post by hand. The
 * gate is deliberately stricter than the one that files a layoff in the
 * tracker: a wrong row in the tracker is dismissed, a wrong public post is
 * not taken back.
 */
import { isTrustedPublisher } from '@/lib/warn/news-trust'
import { publisherKey, sameEmployer } from '@/lib/warn/news-headline'

/** Smaller layoffs are not worth a public post (ten people is a team, not a story). */
export const MIN_EMPLOYEES = 50
/** A single layoff this large is a misread (a multi-year plan, or a total across companies), not a post. */
export const MAX_EMPLOYEES = 40_000
/** A company with a draft this recent is not drafted about again (a second story, a follow-up filing). */
export const RECENT_DRAFT_DAYS = 30
/** A layoff first filed longer ago than this is old news. */
export const MAX_AGE_DAYS = 10
/** At most this many new drafts in any rolling seven days, best first (two a day on five weekdays). */
export const WEEKLY_CAP = 10
/** Posts link here, tagged so sign-ups from LinkedIn are countable. */
export const POST_LINK = 'https://launchyournextchapter.com/layoffs?utm_source=linkedin&utm_medium=social&utm_campaign=layoff-post'

export type Credibility = 'warn-filing' | 'sec-filing' | 'two-publishers' | 'trusted-outlet' | 'unconfirmed'

export interface GateNotice {
  employer: string
  source: 'WARN_FILING' | 'MANUAL_ANNOUNCEMENT'
  sourceUrl: string | null
  layoffType: string | null
  employees: number | null
  fetchedAt: Date
  dismissedAt: Date | null
}

/**
 * Why a notice is credible enough to post about, or null when it is not.
 * Official records count on their own: a state WARN filing, or the company's
 * own SEC 8-K. A news-sourced layoff counts only with two different
 * publishers, or one outlet on the trusted list. Everything else waits; if a
 * second publisher reports it later, the next sweep finds it qualifying.
 */
export function credibilityOf(n: GateNotice, mentionPublishers: (string | null)[], now = new Date(), headlines: string[] = []): Credibility | null {
  if (n.dismissedAt) return null
  if (n.employees == null || n.employees < MIN_EMPLOYEES || n.employees > MAX_EMPLOYEES) return null
  if (!plausibleEmployer(n.employer)) return null
  if (now.getTime() - n.fetchedAt.getTime() > MAX_AGE_DAYS * 86_400_000) return null
  if (n.source === 'WARN_FILING') return 'warn-filing'
  if (/sec\.gov/i.test(n.sourceUrl ?? '') || /^SEC 8-K/i.test(n.layoffType ?? '')) return 'sec-filing'
  // News: anything reported as a layoff is eligible unless every headline is hedged.
  if (speculative(headlines)) return null
  const publishers = new Set(mentionPublishers.map(publisherKey).filter(Boolean))
  if (publishers.size >= 2) return 'two-publishers'
  if (mentionPublishers.some((p) => isTrustedPublisher(p))) return 'trusted-outlet'
  return 'unconfirmed'
}

const HEDGED = /\b(may|might|could|considering|weighs|weighing|mulls|mulling|rumou?rs?|rumou?red|speculat\w*|eyeing|exploring|in talks)\b/i

/** Every covering headline hedges ("could cut", "considering layoffs"): a rumour, not an announcement. */
export function speculative(headlines: string[]): boolean {
  return headlines.length > 0 && headlines.every((h) => HEDGED.test(h))
}

const FOREIGN = /\b(australia\w*|new zealand|u\.?k\.?|britain|british|england|scotland|ireland|irish|india\w*|canad\w*|china|chinese|japan\w*|korea\w*|singapore|german\w*|france|french|spain|spanish|italy|italian|sweden|swedish|norway|norwegian|denmark|danish|finland|finnish|switzerland|swiss|dutch|netherlands|europe\w*|brazil\w*|mexic\w*|south africa\w*|nigeria\w*|uae|dubai|israel\w*|philippin\w*|vietnam\w*|indonesia\w*|taiwan\w*|hong kong)\b/i
const US_UPPER = /\b(U\.S\.A?|USA|US)\b/ // case-sensitive: the word "us" is not the country
const US_MARK = /\b(american|america|united states|us-based)\b|\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i

/** The coverage is about somewhere outside the US and never mentions the US: not a post for our audience. */
export function looksNonUs(headlines: string[]): boolean {
  const text = headlines.join(' ')
  return FOREIGN.test(text) && !US_MARK.test(text) && !US_UPPER.test(text)
}

// Headline parsing sometimes takes the wrong words as the company ("AI blamed
// for", "Announcing") or a description of one ("Big four bank", "Australian
// bank"). A post with such a name is wrong in public, so they never qualify.
const GENERIC_WORDS = /\b(blamed|announc\w*|reportedly|says|plans?|cuts?|cutting|layoffs?|jobs?|workers?|employees|staff|council|government|ministry|department|big (three|four|five))\b/i
const DESCRIBED = /^(the )?[a-z]+ (bank|banks|company|firm|giant|retailer|carmaker|automaker|insurer|airline|maker|chain)$/i

export function plausibleEmployer(name: string): boolean {
  const n = name.trim()
  if (n.length < 2 || n.length > 40 || n.split(/\s+/).length > 5) return false
  if (!/^[A-Z0-9]/.test(n)) return false
  return !GENERIC_WORDS.test(n) && !DESCRIBED.test(n)
}

/** An employer name reduced for comparison: lowercase, possessives and punctuation gone ("Kroger’s" is "kroger"). */
export function employerKey(name: string): string {
  return name.toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export interface EventRef { employer: string; employees: number | null; date: Date | null }

/**
 * Whether two notices are the same layoff: the same company by name, or the
 * same headcount reported within three days under names that share a word or
 * are an acronym of one another ("NAB" and "National Australia Bank").
 */
export function sameEvent(a: EventRef, b: EventRef): boolean {
  const ka = employerKey(a.employer)
  const kb = employerKey(b.employer)
  if (!ka || !kb) return false
  if (ka === kb || sameEmployer(ka, kb)) return true
  if (a.employees == null || a.employees !== b.employees) return false
  if (a.date && b.date && Math.abs(a.date.getTime() - b.date.getTime()) > 3 * 86_400_000) return false
  const initials = (k: string) => k.split(' ').map((w) => w[0]).join('')
  const tokens = (k: string) => k.split(' ').filter((w) => w.length >= 4)
  return initials(ka) === kb || initials(kb) === ka || tokens(ka).some((t) => tokens(kb).includes(t))
}

const CREDIBILITY_WEIGHT: Record<Credibility, number> = { 'warn-filing': 4, 'sec-filing': 4, 'two-publishers': 2, 'trusted-outlet': 1, unconfirmed: 0 }

/**
 * Who a post is most likely to reach and help. The goal is sign-ups from
 * typical white-collar workers, not elite-tech engineers, so large national
 * employers in everyday sectors rank highest and elite tech ranks lower (still
 * postable, just not first). Explicit lists on purpose: an unlisted employer
 * with no industry on file is neutral, never silently promoted or demoted.
 */
export type AudienceFit = 'target' | 'neutral' | 'elite'

const TARGET_SECTOR = /retail|grocer|supermarket|health|hospital|pharma|medical|bank|financ|insur|logistic|transport|freight|airline|telecom|wireless|cable|manufactur|automotive|vehicle|food|beverage|restaurant|hospitality|hotel|consumer|packaged|energy|utilit|education|government|staffing|real estate|construction/i
const ELITE_SECTOR = /software|internet|semiconductor|artificial intelligence|cloud|saas|social media/i
const TARGET_BRANDS = [
  'kroger', 'walmart', 'target', 'costco', 'albertsons', 'safeway', 'home depot', 'lowe', 'best buy', 'macy', 'kohl', 'nordstrom', 'gap', 'dollar general',
  'cvs', 'walgreens', 'rite aid', 'unitedhealth', 'humana', 'cigna', 'elevance', 'anthem', 'kaiser', 'hca', 'pfizer', 'merck', 'johnson & johnson', 'abbvie',
  'wells fargo', 'bank of america', 'citi', 'citigroup', 'jpmorgan', 'chase', 'us bancorp', 'u.s. bank', 'pnc', 'truist', 'capital one', 'state farm', 'allstate', 'progressive', 'geico', 'aig', 'metlife', 'prudential',
  'ups', 'fedex', 'usps', 'delta', 'united airlines', 'american airlines', 'southwest', 'xpo', 'at&t', 'verizon', 't-mobile', 'comcast', 'charter', 'spectrum', 'dish',
  'ford', 'general motors', 'gm', 'stellantis', 'chrysler', 'boeing', 'lockheed', 'general electric', 'ge ', 'honeywell', '3m', 'caterpillar', 'deere', 'whirlpool',
  'procter & gamble', 'p&g', 'coca-cola', 'pepsico', 'kraft', 'kellogg', 'general mills', 'tyson', 'nestle', 'mcdonald', 'starbucks', 'disney', 'paramount', 'warner',
]
const ELITE_BRANDS = ['google', 'alphabet', 'meta', 'facebook', 'apple', 'microsoft', 'netflix', 'openai', 'anthropic', 'nvidia', 'stripe', 'airbnb', 'uber', 'lyft', 'salesforce', 'oracle', 'linkedin', 'snap', 'pinterest', 'x corp', 'twitter', 'atlassian', 'intel', 'amd', 'cisco', 'ibm', 'adobe']

export function audienceFit(employer: string, industry: string | null): AudienceFit {
  const k = ` ${employerKey(employer)} `
  if (ELITE_BRANDS.some((b) => k.includes(` ${b} `))) return 'elite'
  if (TARGET_BRANDS.some((b) => k.includes(` ${b.trim()} `) || k.includes(` ${b.trim()}s `))) return 'target'
  if (industry && ELITE_SECTOR.test(industry)) return 'elite'
  if (industry && TARGET_SECTOR.test(industry)) return 'target'
  return 'neutral'
}

const FIT_WEIGHT: Record<AudienceFit, number> = { target: 3, neutral: 0, elite: -2.5 }

/**
 * Which credible layoff to post about first: how sure we are (official records
 * first), how many people it touches, how widely it was covered (reach: a
 * story in dozens of outlets is one people have heard of), whether the
 * employer's workers are the people we help, and whether we know someone there.
 */
export function rankScore(why: Credibility, employees: number, o: { inCrm: boolean; publishers: number; fit: AudienceFit; usUnknown?: boolean }): number {
  return CREDIBILITY_WEIGHT[why] + Math.log10(Math.max(employees, 1)) + 1.5 * Math.log10(1 + o.publishers) + FIT_WEIGHT[o.fit] + (o.inCrm ? 1.5 : 0) - (o.usUnknown ? 2 : 0)
}

/**
 * A layoff announced to happen over years ("35,000 jobs by 2030") is real news
 * but not a "get help now" post: nobody is losing a job this month. Reads the
 * covering headlines (and a far-off effective date) and returns a short label
 * such as "runs to 2030", or null when the layoff looks near-term.
 */
export function farOffTimeline(headlines: string[], effectiveDate: Date | null, now = new Date()): string | null {
  const thisYear = now.getUTCFullYear()
  for (const h of headlines) {
    const year = h.match(/\b(?:by|through|until|before|to|in)\s+(?:the end of\s+|early\s+|late\s+|mid-?)?(20\d{2})\b/i)
    if (year && Number(year[1]) >= thisYear + 2) return `runs to ${year[1]}`
    const span = h.match(/\bover the next (two|three|four|five|six|seven|eight|nine|ten|\d+) years?\b/i)
    if (span) return `spread over the next ${span[1].toLowerCase()} years`
  }
  if (effectiveDate && effectiveDate.getTime() - now.getTime() > 180 * 86_400_000) return 'takes effect more than six months out'
  return null
}

/** How far to push a far-off layoff down the list. */
export const FAR_OFF_PENALTY = 3

export const ANGLES = ['offer-help', 'first-week', 'local-market', 'senior-demand', 'timeline'] as const
export type Angle = (typeof ANGLES)[number]

export interface DraftFacts {
  employer: string
  employees: number
  percent: number | null
  /** "Harris County, TX", or just "TX", or null. */
  place: string | null
  state: string | null
  noticeDate: string | null
  effectiveDate: string | null
  industry: string | null
  sourceUrl: string | null
  credibility: Credibility
  /** Open roles on our board in the layoff's state, and the manager-and-above share of them. Null when not known. */
  openRolesInState: number | null
  openSeniorRolesInState: number | null
  /** Remote roles open to anyone, anywhere. Older drafts lack it. */
  openRemoteRoles?: number | null
  /** People and groups worth @-mentioning when posting: tagging is typed by hand on LinkedIn, so these are prompts. */
  tagSuggestions: { name: string; note: string; linkedinUrl: string | null }[]
}

/** Angles the facts can support; the others would need a number or date we do not have. */
export function eligibleAngles(f: DraftFacts): Angle[] {
  return ANGLES.filter((a) => {
    if (a === 'local-market') return f.openRolesInState != null && f.openRolesInState >= 50 && !!f.state
    if (a === 'senior-demand') return f.openSeniorRolesInState != null && f.openSeniorRolesInState >= 25 && !!f.state
    if (a === 'timeline') return f.credibility === 'warn-filing' && !!f.effectiveDate
    return true
  })
}

/** Stable small number from a string, so the same notice always gets the same wording. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * The option used least recently, given the most recent picks newest first.
 * Never-used options win; among equals the seed decides, so two layoffs
 * filed the same day do not always get the same pick.
 */
export function leastRecent<T>(options: T[], recentNewestFirst: T[], seed: string): T {
  const age = (o: T) => { const i = recentNewestFirst.indexOf(o); return i === -1 ? Infinity : i }
  const oldest = Math.max(...options.map(age))
  const tied = options.filter((o) => age(o) === oldest)
  return tied[hash(seed) % tied.length]
}

const fmt = (n: number) => n.toLocaleString('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** What the post says first: the news itself, worded for how we know it. */
function lead(f: DraftFacts, v: number): string {
  const where = f.place ? ` in ${f.place}` : ''
  const size = f.percent ? `${fmt(f.employees)} jobs (${f.percent}% of staff)` : `${fmt(f.employees)} jobs`
  if (f.credibility === 'warn-filing') {
    return [
      `${f.employer} filed a WARN notice${f.place ? '' : f.state ? ` in ${f.state}` : ''}: ${size}${where}.`,
      `A WARN notice just landed for ${f.employer}${where}. It covers ${size}.`,
    ][v % 2]
  }
  if (f.credibility === 'sec-filing') {
    return [
      `${f.employer} disclosed a restructuring in an SEC filing that cuts ${size}.`,
      `${f.employer}'s latest SEC filing confirms job cuts: ${size}.`,
    ][v % 2]
  }
  if (f.credibility === 'unconfirmed') {
    return [
      `${f.employer} is reported to be cutting ${size}${where}.`,
      `News reports say ${f.employer} is laying off ${size}${where}.`,
    ][v % 2]
  }
  return [
    `${f.employer} is cutting ${size}${where}, according to news reports.`,
    `${f.employer} has announced layoffs affecting ${size}${where}.`,
  ][v % 2]
}

function body(angle: Angle, f: DraftFacts, v: number): string {
  switch (angle) {
    case 'first-week':
      return [
        `If you're one of them, the first week matters most:\n\n1. Read the severance and benefits terms before you sign anything.\n2. File for unemployment right away. Don't wait for severance to run out.\n3. Tell your network exactly what you're looking for, not just that you're looking.\n4. Update your résumé while the work is still fresh.`,
        `If this is your team, here is what to do first:\n\n1. Get the severance offer in writing and read it before signing.\n2. Check your state's unemployment rules the same week, not later.\n3. Ask a manager or two for a reference now, while they're reachable.\n4. Write down your biggest wins from the last two years before you lose access to the details.`,
      ][v % 2]
    case 'local-market':
      return [
        `The market for the people affected is real. ${fmt(f.openRolesInState ?? 0)} white-collar roles are open in ${f.state} on our job board today, at every level, and ${fmt(f.openSeniorRolesInState ?? 0)} of them are manager level or above.${f.openRemoteRoles && f.openRemoteRoles >= 50 ? ` Another ${fmt(f.openRemoteRoles)} remote roles are open to anyone, anywhere.` : ''}`,
        `Knowing where the openings are is the first step to a plan. Right now there are ${fmt(f.openRolesInState ?? 0)} open white-collar roles in ${f.state}, from entry level to executive.${f.openRemoteRoles && f.openRemoteRoles >= 50 ? ` ${fmt(f.openRemoteRoles)} more remote roles are open to anyone, anywhere.` : ''}`,
      ][v % 2]
    case 'senior-demand':
      return [
        `Experienced people are still being hired. ${fmt(f.openSeniorRolesInState ?? 0)} manager-and-above roles are open in ${f.state} on our board today. The work is finding the ones that fit, not wondering whether they exist.`,
        `A layoff is one company's plan, not a verdict on the people. ${fmt(f.openSeniorRolesInState ?? 0)} senior roles are open in ${f.state} right now across the employers we track.`,
      ][v % 2]
    case 'timeline':
      return `WARN notices generally give employees 60 days before a layoff takes effect. The date listed here is ${shortDate(f.effectiveDate ?? '')}. That window is the best time to start: quietly, with a plan, before the pressure of a last paycheck.`
    case 'offer-help':
    default:
      return [
        `If you or someone you know is affected, reach out. NextChapter helps people turn a layoff into a plan: where to look, who to talk to, and what to say.`,
        `If this touches you or someone you know, we can help you build a plan for the next 30 days and find roles that fit your experience.`,
      ][v % 2]
  }
}

/**
 * Closing asks, each written to earn a repost, a tag or a comment: people share
 * a layoff post when it lets them help someone, so every ask hands the reader a
 * specific thing to do. The link is not in the post (LinkedIn shows posts with
 * outbound links to fewer people); it goes in the first comment.
 */
const CLOSINGS = [
  (f: DraftFacts) => `Know someone at ${f.employer}? Send this to them directly. A warm intro this week beats ten cold applications.`,
  (f: DraftFacts) => `Hiring? If you have a role for someone coming out of ${f.employer}, say so in the comments so they can find you.`,
  (f: DraftFacts) => `Tag a recruiter or hiring manager who should see this. People from ${f.employer} will be looking.`,
  (f: DraftFacts) => `If you work at ${f.employer}, you don't have to say anything here. Send me a message and we'll start with what you need.`,
  () => `Repost this so it reaches the people it affects. Most of them won't see it otherwise.`,
  (f: DraftFacts) => `Been through a layoff yourself? Share the one thing that helped most in the comments. Someone from ${f.employer} will read it.`,
  (f: DraftFacts) => `What would you tell someone starting a job search after ${f.employer}? Add it below.`,
]
const TAGS = [['#Layoffs', '#CareerSupport'], ['#JobSearch', '#CareerTransition'], ['#Layoffs', '#JobSearch', '#WARN'], ['#CareerSupport', '#OpenToWork']]

export interface DraftText {
  body: string
  /** Posted as the first comment, where the link does not cost the post its reach. */
  firstComment: string
}

/**
 * The post text: a lead built from the facts, an angle-specific body, a
 * closing ask, and a few hashtags. Variants rotate on a hash of the seed, so
 * wording differs from post to post without any model call. A person (or the
 * morning rewrite) edits it before it goes anywhere.
 */
export function draftText(angle: Angle, f: DraftFacts, seed: string): DraftText {
  const v = hash(seed)
  const tags = TAGS[(v >>> 3) % TAGS.length].filter((t) => t !== '#WARN' || f.credibility === 'warn-filing')
  return {
    body: [lead(f, v >>> 1), body(angle, f, v >>> 2), CLOSINGS[(v >>> 5) % CLOSINGS.length](f), tags.join(' ')].join('\n\n'),
    firstComment: `If it helps, this is where to start: ${POST_LINK}`,
  }
}

// LinkedIn reach is best on weekday mornings, at lunch and early evening.
// Eastern-time slot starts, as [hour, minute].
const SLOTS_ET: [number, number][] = [[8, 15], [12, 10], [17, 20]]
/** Never more than this many drafts due on one calendar day. */
export const MAX_PER_DAY = 2
/** Posts at least this far apart, so a feed never sees two from us back to back. */
export const MIN_GAP_MS = 3 * 3_600_000

/** Offset of US Eastern time from UTC at an instant, in hours (4 in daylight time, 5 otherwise). */
function etOffsetHours(at: Date): number {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(at))
  return (at.getUTCHours() - h + 24) % 24
}

/** The ET calendar day (YYYY-MM-DD) and weekday (0 = Sunday) of an instant. */
function etDay(at: Date): { key: string; dow: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { key: `${get('year')}-${get('month')}-${get('day')}`, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')) }
}

/**
 * When each new draft should go out: the next free weekday slot at least an
 * hour from now, at most two a day, in different slots.
 * `taken` is when drafts already waiting are due. Returns one time per draft,
 * in order, so the biggest layoff (passed first) gets the earliest slot.
 */
export function assignSlots(count: number, taken: Date[], now = new Date()): Date[] {
  const scheduled = [...taken]
  const out: Date[] = []
  const earliest = now.getTime() + 3_600_000
  for (let dayOffset = 0; out.length < count && dayOffset < 21; dayOffset++) {
    const probe = new Date(now.getTime() + dayOffset * 86_400_000)
    const { key, dow } = etDay(probe)
    if (dow === 0 || dow === 6) continue
    const [y, m, d] = key.split('-').map(Number)
    for (const [hh, mm] of SLOTS_ET) {
      if (out.length >= count) break
      // Local noon-ish offset is stable within a day except across the DST switch; recompute at the slot.
      const guess = new Date(Date.UTC(y, m - 1, d, hh + 5, mm))
      const slot = new Date(Date.UTC(y, m - 1, d, hh + etOffsetHours(guess), mm))
      if (slot.getTime() < earliest) continue
      if (scheduled.some((t) => Math.abs(t.getTime() - slot.getTime()) < MIN_GAP_MS)) continue
      if (scheduled.filter((t) => etDay(t).key === key).length >= MAX_PER_DAY) continue
      out.push(slot)
      scheduled.push(slot)
    }
  }
  return out
}


// ---- The picture: a swipeable set of slides, not one card ----
//
// Carousels and multi-image posts get the most engagement on LinkedIn, and a
// post that teaches something across slides is worth saving and resharing. The
// slides are portrait (the most feed space), carry real numbers from the
// filing, and end on the ask. Employer names are set in type, never logos.

export type Slide =
  | { kind: 'cover'; label: string; big: string; name: string; sub: string; swipe: string }
  | { kind: 'facts'; title: string; rows: { k: string; v: string }[] }
  | { kind: 'step'; n: number; total: number; title: string; body: string }
  | { kind: 'market'; title: string; stats: { value: string; label: string }[] }
  | { kind: 'cta'; title: string; body: string; brand: string }

const SOURCE_NAME: Record<Credibility, string> = {
  'warn-filing': 'WARN notice filed', 'sec-filing': 'SEC filing', 'two-publishers': 'Reported by multiple outlets',
  'trusted-outlet': 'News report', unconfirmed: 'News report',
}

const STEP_SETS: { title: string; body: string }[][] = [
  [
    { title: 'Read before you sign', body: 'Get the severance offer in writing. Read the terms, and what you give up, before you sign anything.' },
    { title: 'File for unemployment this week', body: "Apply right away and check your state's rules on severance. Waiting can cost you benefits." },
    { title: 'Ask for references now', body: "Ask a manager or two while they're still easy to reach." },
    { title: 'Say exactly what you want', body: '"Open to operations roles at mid-size healthcare companies" gets replies. "Open to anything" does not.' },
  ],
  [
    { title: 'Write down your wins', body: 'List your biggest results from the last two years, with numbers, before you lose access to the details.' },
    { title: 'Find your benefits end date', body: 'Health coverage often ends on a set date. Know yours and plan around it.' },
    { title: 'Make a list of 20 companies', body: "Pick employers you'd actually want to work for, then find one person at each." },
    { title: 'Call former colleagues first', body: 'People who know your work answer fastest and refer most.' },
  ],
  [
    { title: 'Take a week to set up', body: 'Update your résumé, pick your target role, and choose five people to call. Then start applying.' },
    { title: 'Get your paperwork in order', body: 'Keep your separation letter, final pay details, and benefits information in one place.' },
    { title: 'Ask for a recommendation', body: 'A LinkedIn recommendation from a manager is worth more than a long list of skills.' },
    { title: 'Tell your story once, clearly', body: 'Practice one calm, honest sentence about why you left. You will say it often.' },
  ],
]

const longDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** The slides for a draft, as data; the renderer draws them. Deterministic for a seed except the days-remaining figure. */
export function slidesFor(f: DraftFacts, seed: string, now = new Date()): Slide[] {
  const v = hash(seed)
  const jobs = `${fmt(f.employees)} jobs`
  const out: Slide[] = [{
    kind: 'cover',
    label: [SOURCE_NAME[f.credibility], f.state].filter(Boolean).join(' · '),
    big: jobs,
    name: f.employer,
    sub: [f.percent ? `${f.percent}% of staff` : null, f.place].filter(Boolean).join(' · '),
    swipe: 'What to do in the first week',
  }]

  const rows: { k: string; v: string }[] = []
  rows.push({ k: 'Who', v: f.employer })
  rows.push({ k: 'How many', v: f.percent ? `${jobs}, ${f.percent}% of staff` : jobs })
  if (f.place) rows.push({ k: 'Where', v: f.place })
  if (f.noticeDate) rows.push({ k: 'Announced', v: longDate(f.noticeDate) })
  if (f.effectiveDate) {
    const days = Math.round((new Date(f.effectiveDate).getTime() - now.getTime()) / 86_400_000)
    rows.push({ k: 'Takes effect', v: days > 0 ? `${longDate(f.effectiveDate)} (${days} days)` : longDate(f.effectiveDate) })
  }
  rows.push({ k: 'Source', v: SOURCE_NAME[f.credibility] })
  if (rows.length >= 4) out.push({ kind: 'facts', title: 'What we know', rows })

  const steps = STEP_SETS[v % STEP_SETS.length].slice(0, 3)
  steps.forEach((st, i) => out.push({ kind: 'step', n: i + 1, total: steps.length, ...st }))

  if (f.openRolesInState != null && f.openRolesInState >= 50 && f.state) {
    const stats = [{ value: fmt(f.openRolesInState), label: `open white-collar roles in ${f.state}, every level` }]
    if (f.openSeniorRolesInState != null && f.openSeniorRolesInState >= 25) stats.push({ value: fmt(f.openSeniorRolesInState), label: 'at manager level or above' })
    if (f.openRemoteRoles != null && f.openRemoteRoles >= 50) stats.push({ value: fmt(f.openRemoteRoles), label: 'more are remote, open to anyone' })
    out.push({ kind: 'market', title: 'Who is hiring right now', stats })
  }

  out.push({
    kind: 'cta',
    title: `Know someone at ${f.employer}?`,
    body: 'Send this to them directly. A warm introduction this week beats ten cold applications.',
    brand: 'NextChapter · the leading job transition platform',
  })
  return out
}

/** Image layouts: [background, accent, text]. Rotated like angles so cards do not all look alike. */
export const LAYOUTS: { bg: string; accent: string; ink: string; align: 'left' | 'center' }[] = [
  { bg: '#14213D', accent: '#F4B860', ink: '#FFFFFF', align: 'left' },
  { bg: '#F6F8FB', accent: '#0B7A75', ink: '#14213D', align: 'left' },
  { bg: '#0B7A75', accent: '#FFFFFF', ink: '#FFFFFF', align: 'center' },
  { bg: '#FFFFFF', accent: '#C2410C', ink: '#14213D', align: 'center' },
]
