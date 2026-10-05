// Pre-scan (spec F4): sorts a parsed resume against the recruiter's OWN
// stated criteria and shows its reasons. Deterministic rules only — no model
// decides the tag — so every tag is explainable and overridable. It never
// scores, ranks or rejects a person; it picks which reply (if any) the
// recruiter is asked to approve. Pure.

import { levelRank } from './constants'

export type ParsedIntakeResume = {
  currentTitle: string | null
  currentEmployer: string | null
  level: string | null
  primaryFunction: string | null
  industry: string | null
  location: string | null
  keywords: string[]
}

export type PrescanSpecialty = { type: 'FUNCTION' | 'INDUSTRY' | 'LEVEL' | 'GEO' | 'TAG'; name: string; weight: 'PRIMARY' | 'SECONDARY' }

export type PrescanSearch = {
  id: string
  title: string
  functions: string[]
  levels: string[]
  mustHaves: string[]
  location: string | null
}

export type SearchMatch = {
  searchId: string
  title: string
  matched: string[]
  missed: string[]
  full: boolean
}

export type PrescanResult = {
  tag: 'FIT' | 'NICHE' | 'OUTSIDE'
  reasons: string[]
  searchId: string | null
  partialSearchMatch: boolean
}

const norm = (value: string) => value.trim().toLowerCase()

// Loose two-way containment: "Healthcare" matches "Healthcare services",
// "Boston" matches "Greater Boston, MA".
function looselyMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const x = norm(a)
  const y = norm(b)
  return x.length > 1 && y.length > 1 && (x.includes(y) || y.includes(x))
}

function resumeMentions(resume: ParsedIntakeResume, term: string): boolean {
  const t = norm(term)
  if (!t) return false
  const haystack = [resume.currentTitle, resume.currentEmployer, resume.industry, ...resume.keywords]
    .filter((v): v is string => !!v)
    .map(norm)
  return haystack.some((h) => h.includes(t) || (h.length > 2 && t.includes(h)))
}

function locationMatches(resumeLocation: string | null, wanted: string): boolean {
  if (/remote|anywhere/i.test(wanted)) return true
  return looselyMatches(resumeLocation, wanted)
}

// Each criterion the recruiter set on the search is one check. Criteria they
// left blank don't count either way. Unknown resume fields count as missed.
export function matchSearch(resume: ParsedIntakeResume, search: PrescanSearch): SearchMatch {
  const matched: string[] = []
  const missed: string[] = []

  if (search.functions.length > 0) {
    const hit = search.functions.find((f) => looselyMatches(f, resume.primaryFunction))
    if (hit) matched.push(`${hit} function`)
    else missed.push(`function (${search.functions.join(' or ')})`)
  }
  if (search.levels.length > 0) {
    if (resume.level && search.levels.includes(resume.level)) matched.push(`${resume.level} level`)
    else missed.push(`level (${search.levels.join(' or ')})`)
  }
  for (const mustHave of search.mustHaves) {
    if (resumeMentions(resume, mustHave)) matched.push(mustHave)
    else missed.push(mustHave)
  }
  if (search.location) {
    if (locationMatches(resume.location, search.location)) matched.push(search.location)
    else missed.push(`location (${search.location})`)
  }

  const criteria = matched.length + missed.length
  return { searchId: search.id, title: search.title, matched, missed, full: criteria > 0 && missed.length === 0 }
}

export function matchSpecialties(resume: ParsedIntakeResume, specialties: PrescanSpecialty[]) {
  const hits: { specialty: PrescanSpecialty; reason: string }[] = []
  for (const specialty of specialties) {
    const weight = specialty.weight === 'PRIMARY' ? 'primary' : 'secondary'
    if (specialty.type === 'FUNCTION' && looselyMatches(specialty.name, resume.primaryFunction)) {
      hits.push({ specialty, reason: `${specialty.name} (${weight} function)` })
    } else if (specialty.type === 'INDUSTRY' && looselyMatches(specialty.name, resume.industry)) {
      hits.push({ specialty, reason: `${specialty.name} (${weight} industry)` })
    } else if (specialty.type === 'LEVEL' && resume.level === specialty.name) {
      hits.push({ specialty, reason: `${specialty.name} (${weight} level)` })
    } else if (specialty.type === 'GEO' && locationMatches(resume.location, specialty.name)) {
      hits.push({ specialty, reason: `${specialty.name} (${weight} geography)` })
    } else if (specialty.type === 'TAG' && resumeMentions(resume, specialty.name)) {
      hits.push({ specialty, reason: `${specialty.name} (${weight} niche)` })
    }
  }
  return hits
}

export function describeResume(resume: ParsedIntakeResume): string {
  return [resume.currentTitle, resume.level, resume.primaryFunction, resume.industry, resume.location]
    .filter(Boolean)
    .join(' · ')
}

export function prescanResume({
  resume,
  specialties,
  searches,
  minLevel,
  notFitLink = false,
}: {
  resume: ParsedIntakeResume
  specialties: PrescanSpecialty[]
  searches: PrescanSearch[]
  minLevel: string | null
  notFitLink?: boolean
}): PrescanResult {
  const matches = searches.map((search) => matchSearch(resume, search))
  const full = matches.find((m) => m.full)
  const partial = matches
    .filter((m) => !m.full && m.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)[0]

  // The recruiter sent this person their "not a fit now" link: their own
  // call, so pre-scan doesn't second-guess it.
  if (notFitLink) {
    return {
      tag: 'OUTSIDE',
      reasons: ['Came through your "not a fit now" link'],
      searchId: null,
      partialSearchMatch: false,
    }
  }

  if (full) {
    return {
      tag: 'FIT',
      reasons: [`Matches every criterion on "${full.title}": ${full.matched.join(', ')}`],
      searchId: full.searchId,
      partialSearchMatch: false,
    }
  }

  const reasons: string[] = []
  if (partial) {
    reasons.push(`Partly matches "${partial.title}": has ${partial.matched.join(', ')}; missing ${partial.missed.join(', ')}`)
  }

  const resumeRank = levelRank(resume.level)
  const floorRank = levelRank(minLevel)
  const belowFloor = resumeRank !== null && floorRank !== null && resumeRank < floorRank

  const specialtyHits = matchSpecialties(resume, specialties)
  const coreHit = specialtyHits.some((h) => h.specialty.type !== 'LEVEL' && h.specialty.type !== 'GEO')

  if (!belowFloor && coreHit) {
    reasons.push(`In your specialties: ${specialtyHits.map((h) => h.reason).join(', ')}`)
    return { tag: 'NICHE', reasons, searchId: partial?.searchId ?? null, partialSearchMatch: !!partial }
  }

  // Anyone who partly matches an open search is held for the recruiter to
  // decide — never sent an Outside reply (2026-10-05 decision).
  if (partial) {
    if (belowFloor) reasons.push(`Below the firm's ${minLevel} floor (resume reads ${resume.level})`)
    return { tag: 'NICHE', reasons, searchId: partial.searchId, partialSearchMatch: true }
  }

  // Nothing to sort against yet: default to the gentler "keep you in mind"
  // reply rather than telling people they're outside a focus nobody set.
  if (!belowFloor && specialties.length === 0 && searches.length === 0) {
    return {
      tag: 'NICHE',
      reasons: ['No specialties or open searches set up yet, so pre-scan can’t sort this one'],
      searchId: null,
      partialSearchMatch: false,
    }
  }

  if (belowFloor) {
    reasons.push(`Below the firm's ${minLevel} floor (resume reads ${resume.level})`)
  } else {
    reasons.push('No match to your specialties or open searches')
  }
  return { tag: 'OUTSIDE', reasons, searchId: null, partialSearchMatch: false }
}
