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
