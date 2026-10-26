// Rules for the public college pages (/higher-education/<state>/<college>). Pure, so they are unit-tested
// (src/test/college-pages.test.ts) and shared by the page, the sitemap and the llms.txt list: the bar lives here only.

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** What a page needs before it is offered to search engines. */
export const COLLEGE_MIN_MAJORS = 3

export interface CollegeBarInput {
  enrollment: number | null
  /** How many fields of study the Scorecard/IPEDS completions list names. */
  majors: number
  /** Count of the outcome figures we hold: completion rate, earnings at 6 and 10 years, net price, employed share. */
  outcomes: number
  countyFips: string | null
}

/**
 * A page renders for every college we hold, but is offered to search engines only when it has facts of its own:
 * enrollment, at least three fields of study with completions, one outcome figure (graduation, earnings or net price)
 * and a county, so the local job market section has something to say. The sitemap, the robots tag and the llms list
 * all call this one function.
 */
export function collegeIndexable(c: CollegeBarInput): boolean {
  return (c.enrollment ?? 0) > 0 && c.majors >= COLLEGE_MIN_MAJORS && c.outcomes >= 1 && !!c.countyFips
}

export interface SlugCollege { unitid: string; name: string; city: string | null }

/**
 * Page slugs for the colleges of one state. The name alone when it is unique in the state; with the city when two
 * share a name; with the IPEDS id when they still collide. Whatever the slug, one ending in `-<unitid>` resolves.
 */
export function collegeSlugs(colleges: SlugCollege[]): Map<string, string> {
  const count = (f: (c: SlugCollege) => string) => {
    const m = new Map<string, number>()
    for (const c of colleges) m.set(f(c), (m.get(f(c)) ?? 0) + 1)
    return m
  }
  const byName = (c: SlugCollege) => slugify(c.name) || 'college'
  const byCity = (c: SlugCollege) => (c.city ? `${byName(c)}-${slugify(c.city)}` : byName(c))
  const names = count(byName)
  const cities = count(byCity)
  const out = new Map<string, string>()
  for (const c of colleges) {
    if ((names.get(byName(c)) ?? 0) === 1) out.set(c.unitid, byName(c))
    else if ((cities.get(byCity(c)) ?? 0) === 1 && byCity(c) !== byName(c)) out.set(c.unitid, byCity(c))
    else out.set(c.unitid, `${byName(c)}-${c.unitid}`)
  }
  return out
}

/** The IPEDS id a slug ends in, or null. */
export function unitidFromSlug(slug: string): string | null {
  const m = /-(\d{5,7})$/.exec(slug)
  return m ? m[1] : null
}

export const COLLEGE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const collegePath = (stateSlugValue: string, slug: string) => `/higher-education/${stateSlugValue}/${slug}`

/** The college URLs a search engine should hear about: new ones, and ones whose facts changed since the last ping (url → lastmod ISO). */
export function planCollegePings(current: Record<string, string>, announced: Record<string, string>): string[] {
  return Object.keys(current).filter((u) => announced[u] !== current[u]).sort()
}

/** US territories with colleges in IPEDS. The site's state list stops at the 50 states and DC, so their college pages use this one. */
export const COLLEGE_TERRITORIES: Record<string, string> = {
  AS: 'American Samoa', FM: 'Federated States of Micronesia', GU: 'Guam', MH: 'Marshall Islands',
  MP: 'Northern Mariana Islands', PR: 'Puerto Rico', PW: 'Palau', VI: 'U.S. Virgin Islands',
}
export const isCollegeTerritory = (code: string) => code in COLLEGE_TERRITORIES

const TERRITORY_BY_SLUG = Object.fromEntries(Object.entries(COLLEGE_TERRITORIES).map(([c, n]) => [slugify(n), c]))
/** The territory a slug stands for ("puerto-rico" → "PR"), or null. */
export const territoryFromSlug = (slug: string): string | null => TERRITORY_BY_SLUG[slug] ?? null
export const territorySlug = (code: string): string => slugify(COLLEGE_TERRITORIES[code])

/**
 * Which job functions (the board's `targetFunction` values) hire for what graduates of an IPEDS field of study usually
 * do. Deliberately short and professional-only: fields with no clear white-collar path (trades, general studies,
 * theology) are left out rather than guessed.
 */
export const MAJOR_FUNCTIONS: Record<string, string[]> = {
  'Business & management': ['Finance', 'Sales', 'Operations', 'Marketing', 'Human Resources', 'Strategy'],
  'Computer & information sciences': ['Engineering', 'Data & Analytics', 'Security', 'Product'],
  Engineering: ['Engineering', 'Operations'],
  'Engineering technologies': ['Engineering', 'Operations'],
  'Health professions': ['Clinical'],
  Education: ['Academic', 'Programs'],
  Psychology: ['Human Resources', 'Research', 'Programs'],
  'Social sciences': ['Research', 'Programs', 'Human Resources'],
  'Biological sciences': ['Research'],
  'Physical sciences': ['Research'],
  'Mathematics & statistics': ['Data & Analytics', 'Finance', 'Research'],
  'Communication & journalism': ['Marketing', 'Design'],
  'Communications technology': ['Marketing', 'Design'],
  'Visual & performing arts': ['Design'],
  Architecture: ['Design'],
  'Legal studies': ['Legal'],
  'Public administration & social work': ['Programs', 'Administration'],
  'Security & protective services': ['Security'],
}

/** The functions to show for a college: those of its largest mapped fields, in order, no repeats, at most `max`. */
export function functionsForMajors(majors: { field: string; share: number }[], max = 6): { functions: string[]; fields: string[] } {
  const functions: string[] = []
  const fields: string[] = []
  for (const m of [...majors].sort((a, b) => b.share - a.share)) {
    const fns = MAJOR_FUNCTIONS[m.field]
    if (!fns) continue
    fields.push(m.field)
    for (const f of fns) if (!functions.includes(f)) functions.push(f)
    if (fields.length >= 3) break
  }
  return { functions: functions.slice(0, max), fields }
}

/** IPEDS program codes (CIP 2020) for the tracks shown as "AI and data programs". */
export const AI_TRACK_CIP: Record<string, string> = {
  '11.0102': 'ai',
  '30.7001': 'datasci', '30.7101': 'analytics', '30.7102': 'analytics', '30.7103': 'analytics', '30.7104': 'analytics',
  '14.4201': 'robotics', '15.0405': 'robotics', '15.0406': 'robotics',
}
export const AI_TRACK_LABEL: Record<string, string> = {
  ai: 'Artificial intelligence', datasci: 'Data science', analytics: 'Data analytics and business analytics', robotics: 'Robotics, mechatronics and automation',
}
export const AI_LEVELS = ['certificate', 'associate', 'bachelor', 'master', 'doctorate'] as const
export type AiLevel = (typeof AI_LEVELS)[number]

/** IPEDS award level code → the level shown. */
export function aiLevelOf(awlevel: string): AiLevel | null {
  if (['1', '2', '4', '6', '8', '20', '21'].includes(awlevel)) return 'certificate'
  if (awlevel === '3') return 'associate'
  if (awlevel === '5') return 'bachelor'
  if (awlevel === '7') return 'master'
  if (['17', '18', '19'].includes(awlevel)) return 'doctorate'
  return null
}

export interface AiProgramRow { track: string; level: AiLevel; awards: number }
export interface AiPrograms { year: number; programs: AiProgramRow[] }

/** Reads the stored JSON; anything malformed counts as "not loaded". */
export function parseAiPrograms(v: unknown): AiPrograms | null {
  if (!v || typeof v !== 'object') return null
  const o = v as { year?: unknown; programs?: unknown }
  if (typeof o.year !== 'number' || !Array.isArray(o.programs)) return null
  const programs = o.programs.filter((p): p is AiProgramRow =>
    !!p && typeof p.track === 'string' && p.track in AI_TRACK_LABEL && AI_LEVELS.includes(p.level) && typeof p.awards === 'number' && p.awards > 0)
  return { year: o.year, programs }
}

/** One sentence for the description and FAQ: which tracks, at which levels. Null when none. */
export function aiProgramSentence(a: AiPrograms | null): string | null {
  if (!a || a.programs.length === 0) return null
  const tracks = Object.keys(AI_TRACK_LABEL).filter((t) => a.programs.some((p) => p.track === t))
  const levels = AI_LEVELS.filter((l) => a.programs.some((p) => p.level === l))
  return `${tracks.map((t) => AI_TRACK_LABEL[t].toLowerCase()).join(', ')} (${levels.join(', ')})`
}
