import { normalizeOrgName } from '@/lib/text/org-name-match'

// Resolving the text on a resume ("MIT Sloan School of Management", "Mass. Inst. of
// Tech", "Univ of Michigan - Ann Arbor") to ONE canonical institution, so alumni can
// be grouped and counted. Pure — no database — so every rule is unit-tested
// (src/test/school-match.test.ts).
//
// Four outcomes, and only the first two ever link without a person:
//   exact     the name, or a listed alias of it, is a known institution
//   division  a known institution followed by a school/college/program within it
//             ("MIT Sloan School of Management" -> MIT)
//   close     overlaps a known institution but is not one: queued for review,
//             never auto-linked (a wrong merge puts two universities' alumni together)
//   none      unknown: becomes its own institution, flagged unverified

export interface SchoolRecord {
  id: string
  name: string
  canonicalKey: string
  aliases: string[]
}

export type SchoolMatch =
  | { kind: 'exact'; schoolId: string }
  | { kind: 'division'; schoolId: string; division: string }
  | { kind: 'close'; candidates: { id: string; name: string }[] }
  | { kind: 'none' }

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bunivs?\b/g, 'university'],
  [/\bu\.? of\b/g, 'university of'],
  [/\bcol\b/g, 'college'],
  [/\binst\b/g, 'institute'],
  [/\btech\b/g, 'technology'],
  [/\bmass\b/g, 'massachusetts'],
  [/\bsaint\b/g, 'st'],
]

/** Normalised form used as the key — also strips campus joiners ("at", "-", ",") so "Michigan-Ann Arbor" and "Michigan Ann Arbor" agree. */
export function schoolKey(raw: string): string {
  let k = normalizeOrgName(raw.replace(/&/g, ' and '))
  for (const [re, to] of ABBREVIATIONS) k = k.replace(re, to)
  return k
    .replace(/\band\b/g, ' ')
    .replace(/\bat\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Words that, after a known institution's name, mean "a school or program within it".
const DIVISION_WORDS = new Set([
  'school', 'college', 'faculty', 'business', 'law', 'graduate', 'medical', 'medicine', 'engineering',
  'management', 'extension', 'executive', 'education', 'institute', 'program', 'programs', 'department',
  'public', 'health', 'policy', 'government', 'arts', 'sciences', 'science', 'of', 'the', 'for', 'in',
  'sloan', 'kellogg', 'booth', 'wharton', 'haas', 'stern', 'tuck', 'ross', 'fuqua', 'darden', 'anderson',
  'marshall', 'kennedy', 'gsb', 'hbs', 'mba', 'online', 'global',
])

export interface SchoolIndex {
  byKey: Map<string, SchoolRecord>
  /** Longest-first, so "university of michigan" is tried before "michigan". */
  prefixes: { key: string; school: SchoolRecord }[]
  byToken: Map<string, SchoolRecord[]>
}

export function buildSchoolIndex(schools: SchoolRecord[]): SchoolIndex {
  const byKey = new Map<string, SchoolRecord>()
  const prefixes: { key: string; school: SchoolRecord }[] = []
  const byToken = new Map<string, SchoolRecord[]>()
  for (const s of schools) {
    for (const k of new Set([s.canonicalKey, schoolKey(s.name), ...s.aliases.map(schoolKey)].filter(Boolean))) {
      if (!byKey.has(k)) byKey.set(k, s)
      prefixes.push({ key: k, school: s })
    }
    for (const t of new Set(s.canonicalKey.split(' ').filter((w) => w.length >= 4))) {
      const list = byToken.get(t)
      if (list) list.push(s)
      else byToken.set(t, [s])
    }
  }
  prefixes.sort((a, b) => b.key.length - a.key.length)
  return { byKey, prefixes, byToken }
}

// Generic institution words: sharing one is not evidence of anything.
const GENERIC = new Set(['university', 'college', 'institute', 'school', 'state', 'community', 'technology', 'national', 'new', 'north', 'south', 'east', 'west', 'central'])

export function resolveSchool(raw: string, index: SchoolIndex): SchoolMatch {
  const key = schoolKey(raw)
  if (!key) return { kind: 'none' }

  const exact = index.byKey.get(key)
  if (exact) return { kind: 'exact', schoolId: exact.id }

  // A known institution as a whole-word prefix, followed only by division words.
  // Short aliases (MIT, BU) only count at the very start, never inside a longer name.
  for (const { key: prefix, school } of index.prefixes) {
    if (prefix.length < 2 || !key.startsWith(`${prefix} `)) continue
    const rest = key.slice(prefix.length + 1).split(' ').filter(Boolean)
    if (rest.length > 0 && rest.every((w) => DIVISION_WORDS.has(w)) && rest.some((w) => w !== 'of' && w !== 'the')) {
      return { kind: 'division', schoolId: school.id, division: rest.join(' ') }
    }
  }

  // Overlap with a known institution that is not that institution: review, never link.
  const mine = key.split(' ').filter((w) => w.length >= 4 && !GENERIC.has(w))
  if (mine.length > 0) {
    const rarest = [...mine].sort((a, b) => (index.byToken.get(a)?.length ?? 0) - (index.byToken.get(b)?.length ?? 0))[0]
    const pool = index.byToken.get(rarest) ?? []
    const close = pool.filter((s) => {
      const theirs = new Set(s.canonicalKey.split(' '))
      return mine.every((w) => theirs.has(w))
    })
    if (close.length > 0) return { kind: 'close', candidates: close.slice(0, 3).map((s) => ({ id: s.id, name: s.name })) }
  }
  return { kind: 'none' }
}

// ── degree level ──────────────────────────────────────────────────────────

export type DegreeLevel = 'ASSOCIATE' | 'BACHELORS' | 'MASTERS' | 'MBA' | 'DOCTORATE' | 'PROFESSIONAL' | 'OTHER'

/** Normalised level of a degree string ("B.S. Computer Science", "MBA", "Juris Doctor"), for grouping by degree. */
export function inferDegreeLevel(degree: string | null | undefined): DegreeLevel | null {
  if (!degree || !degree.trim()) return null
  const d = degree.toLowerCase()
  if (/\bmba\b|master of business administration|executive mba|\bemba\b/.test(d)) return 'MBA'
  if (/\bj\.?d\.?\b|juris doctor|\bm\.?d\.?\b|doctor of medicine|\bd\.?o\.?\b|osteopathic|\bd\.?d\.?s\b|\bd\.?m\.?d\b|\bd\.?v\.?m\b|pharm\.?d|\bllm\b|\bll\.m\b/.test(d)) return 'PROFESSIONAL'
  if (/\bph\.?d\b|doctorate|doctor of philosophy|\bd\.?phil\b|\bed\.?d\b|\bdba\b/.test(d)) return 'DOCTORATE'
  if (/\bm\.?s\.?c?\b|\bm\.?a\b|\bm\.?eng\b|\bm\.?p\.?[ha]\b|\bm\.?f\.?a\b|\bmpa\b|\bmph\b|master'?s?\b|\bm\.?ed\b/.test(d)) return 'MASTERS'
  if (/\bb\.?s\.?c?\b|\bb\.?a\b|\bb\.?e\b|\bb\.?eng\b|\bb\.?f\.?a\b|\bbba\b|bachelor'?s?\b|\bab\b/.test(d)) return 'BACHELORS'
  if (/\ba\.?a\.?s?\b|\ba\.?s\b|associate'?s?\b/.test(d)) return 'ASSOCIATE'
  return 'OTHER'
}
