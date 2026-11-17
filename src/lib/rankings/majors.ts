// Majors: degrees awarded by college major (federal IPEDS Completions, built by scripts/rankings/build_major_supply.py),
// the supply side of the degree lists and the major pages. Pure: no database.
//
// A major is a CIP 4-digit series ("11.07 Computer Science"). Degrees count first majors at bachelor's level and above, so a
// double major is one degree. Each major is matched to the degree field (degrees-specs.ts fieldOf) its graduates usually
// enter, so a field's graduates and its open jobs are counted over the same grouping. Majors such as English, history or the
// arts lead into many kinds of work and belong to no one field.

import data from '@/lib/rankings/data/major-supply.json'

export interface Major {
  /** CIP 4-digit series, e.g. "11.07". */
  cip: string
  title: string
  /** CIP 2-digit family, e.g. "11". */
  fam: string
  /** Degree field its graduates usually enter, or null when they spread across many kinds of work. */
  field: string | null
  bach: number
  master: number
  doctoral: number
  assoc: number
  /** Bachelor's and above, the latest year. */
  total: number
  /** Bachelor's and above, the base year (three years earlier). */
  total0: number
  /** Colleges awarding at least one degree at bachelor's level and above in it. */
  schools: number
  /** Colleges awarding the most of its degrees: IPEDS UNITID, name, state, degrees. */
  top: { unitid: string; name: string; state: string; n: number }[]
}

interface Raw { t: string; fam: string; fld: string | null; b: number; m: number; d: number; a: number; b0: number; all0: number; s: number; top: [string, string, string, number][] }

export const MAJOR_SOURCE = data.source
export const MAJOR_YEAR = data.year
export const MAJOR_BASE_YEAR = data.baseYear
export const MAJOR_FAMILIES = data.families as Record<string, string>

export const MAJORS: Major[] = Object.entries(data.majors as unknown as Record<string, Raw>).map(([cip, r]) => ({
  cip, title: r.t, fam: r.fam, field: r.fld, bach: r.b, master: r.m, doctoral: r.d, assoc: r.a,
  total: r.b + r.m + r.d, total0: r.all0, schools: r.s,
  top: r.top.map(([unitid, name, state, n]) => ({ unitid, name, state, n })),
}))

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** URL slug for a major: its title, unique across majors (the CIP code is added only when two titles collide). */
export const majorSlug = (m: Pick<Major, 'title' | 'cip'>) => SLUGS.get(m.cip) ?? slugify(m.title)
const SLUGS = (() => {
  const count = new Map<string, number>()
  for (const m of MAJORS) count.set(slugify(m.title), (count.get(slugify(m.title)) ?? 0) + 1)
  return new Map(MAJORS.map((m) => [m.cip, (count.get(slugify(m.title)) ?? 0) > 1 ? `${slugify(m.title)}-${m.cip.replace('.', '-')}` : slugify(m.title)]))
})()

const BY_SLUG = new Map(MAJORS.map((m) => [majorSlug(m), m]))
export const majorBySlug = (slug: string) => BY_SLUG.get(slug) ?? null

export const MAJORS_PATH = '/higher-education/majors'
export const majorPath = (m: Pick<Major, 'title' | 'cip'>) => `${MAJORS_PATH}/${majorSlug(m)}`
/** The majors page's row for a degree field, and its section for a program family. */
export const fieldAnchor = (field: string) => `field-${slugify(field)}`
export const fieldMajorsPath = (field: string) => `${MAJORS_PATH}#${fieldAnchor(field)}`
export const familyAnchor = (fam: string) => `fam-${fam}`

// The short family names the college pages show ("What students study", scripts/geo/build_colleges.py CIP2), to link them here.
const COLLEGE_FAMILY: Record<string, string> = {'Agriculture':'01','Natural resources':'03','Architecture':'04','Area/ethnic studies':'05','Communication & journalism':'09','Communications technology':'10','Computer & information sciences':'11','Personal & culinary services':'12','Education':'13','Engineering':'14','Engineering technologies':'15','Foreign languages':'16','Family & consumer sciences':'19','Legal studies':'22','English':'23','Liberal arts & general studies':'24','Library science':'25','Biological sciences':'26','Mathematics & statistics':'27','Military technologies':'29','Interdisciplinary studies':'30','Parks, recreation & fitness':'31','Philosophy & religion':'38','Theology':'39','Physical sciences':'40','Science technologies':'41','Psychology':'42','Security & protective services':'43','Public administration & social work':'44','Social sciences':'45','Construction trades':'46','Mechanic & repair trades':'47','Precision production':'48','Transportation':'49','Visual & performing arts':'50','Health professions':'51','Business & management':'52','History':'54','Residency programs':'60'}
const FAMILIES_WITH_MAJORS = new Set(MAJORS.map((m) => m.fam))
/** The majors page section for a college page's field-of-study name, or null when no major in it awards four-year degrees. */
export function collegeFamilyPath(name: string): string | null {
  const fam = COLLEGE_FAMILY[name]
  return fam && FAMILIES_WITH_MAJORS.has(fam) ? `${MAJORS_PATH}#${familyAnchor(fam)}` : null
}

/** Three-year change in degrees awarded at bachelor's level and above, or null when the base is too small to read. */
export const majorChange = (m: Major, minBase = 500): number | null => (m.total0 >= minBase ? ((m.total - m.total0) / m.total0) * 100 : null)

/** Degrees awarded a year at bachelor's level and above, by degree field. */
export function fieldSupply(): Map<string, { total: number; total0: number; majors: number }> {
  const out = new Map<string, { total: number; total0: number; majors: number }>()
  for (const m of MAJORS) {
    if (!m.field) continue
    const x = out.get(m.field) ?? { total: 0, total0: 0, majors: 0 }
    x.total += m.total
    x.total0 += m.total0
    x.majors += 1
    out.set(m.field, x)
  }
  return out
}

/** Majors in a degree field, most degrees first. */
export const majorsOfField = (field: string | null) => MAJORS.filter((m) => m.field === field).sort((a, b) => b.total - a.total)
