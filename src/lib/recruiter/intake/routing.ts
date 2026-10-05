// Routing (spec F3a): matches a resume that came in through the FIRM page or
// firm address to the recruiter whose specialties and open searches fit it,
// with visible reasons. Pure.

import { matchSearch, matchSpecialties, type ParsedIntakeResume, type PrescanSearch, type PrescanSpecialty } from './prescan'

export type RoutingCandidateRecruiter = {
  id: string
  name: string
  specialties: PrescanSpecialty[]
  searches: PrescanSearch[]
  lastIntakeAssignedAt: Date | null
}

export type RecruiterScore = { recruiterId: string; name: string; score: number; reasons: string[] }

const SPECIALTY_POINTS: Record<PrescanSpecialty['type'], { PRIMARY: number; SECONDARY: number }> = {
  FUNCTION: { PRIMARY: 3, SECONDARY: 2 },
  INDUSTRY: { PRIMARY: 3, SECONDARY: 2 },
  TAG: { PRIMARY: 2, SECONDARY: 1 },
  LEVEL: { PRIMARY: 1, SECONDARY: 1 },
  GEO: { PRIMARY: 1, SECONDARY: 1 },
}

export function scoreRecruiter(resume: ParsedIntakeResume, recruiter: RoutingCandidateRecruiter): RecruiterScore {
  let score = 0
  const reasons: string[] = []

  for (const search of recruiter.searches) {
    const match = matchSearch(resume, search)
    if (match.full) {
      score += 6
      reasons.push(`fits open search "${search.title}"`)
    } else if (match.matched.length > 0) {
      score += 2
      reasons.push(`partly fits "${search.title}"`)
    }
  }
  for (const hit of matchSpecialties(resume, recruiter.specialties)) {
    score += SPECIALTY_POINTS[hit.specialty.type][hit.specialty.weight]
    reasons.push(hit.reason)
  }
  return { recruiterId: recruiter.id, name: recruiter.name, score, reasons }
}

// Never-assigned recruiters go first, then the least recently assigned.
function byLeastRecentlyAssigned(a: RoutingCandidateRecruiter, b: RoutingCandidateRecruiter) {
  const at = a.lastIntakeAssignedAt?.getTime() ?? 0
  const bt = b.lastIntakeAssignedAt?.getTime() ?? 0
  return at - bt || a.id.localeCompare(b.id)
}

export type RoutingSuggestion = {
  recruiterId: string
  name: string
  reasons: string[]
  // Short line shown to coordinators, e.g.
  // "CFO · Finance · Healthcare → Jane: Finance (primary function), …"
  summary: string
} | null

export function suggestRecruiter({
  resume,
  recruiters,
  mode,
  resumeLine,
}: {
  resume: ParsedIntakeResume
  recruiters: RoutingCandidateRecruiter[]
  mode: 'AUTO' | 'SUGGEST' | 'ROUND_ROBIN'
  resumeLine: string
}): RoutingSuggestion {
  const scored = recruiters
    .map((recruiter) => ({ recruiter, result: scoreRecruiter(resume, recruiter) }))
    .filter(({ result }) => result.score > 0)
  if (scored.length === 0) return null

  let pick: (typeof scored)[number]
  if (mode === 'ROUND_ROBIN') {
    pick = [...scored].sort((a, b) => byLeastRecentlyAssigned(a.recruiter, b.recruiter))[0]
  } else {
    const top = Math.max(...scored.map(({ result }) => result.score))
    pick = scored
      .filter(({ result }) => result.score === top)
      .sort((a, b) => byLeastRecentlyAssigned(a.recruiter, b.recruiter))[0]
  }

  const firstName = pick.recruiter.name.split(' ')[0]
  return {
    recruiterId: pick.recruiter.id,
    name: pick.recruiter.name,
    reasons: pick.result.reasons,
    summary: `${resumeLine || 'Resume'} → ${firstName}: ${pick.result.reasons.join(', ')}`,
  }
}
