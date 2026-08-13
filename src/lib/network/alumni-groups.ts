import 'server-only'
import { prisma } from '@/lib/prisma'
import type { AlumniNetworkGroup } from '@prisma/client'

// Bidirectional substring match — a keyword like "google" matches company
// text "Alphabet Inc (Google)", and a longer keyword like "harvard kennedy
// school of government" still matches shorter candidate text "Harvard
// Kennedy School" (schoolNameNormalized is already trimmed to the parent
// institution, so this direction matters more for schools than employers).
function matchesKeyword(candidateText: string, keyword: string): boolean {
  const a = candidateText.toLowerCase()
  const b = keyword.toLowerCase()
  return a.includes(b) || b.includes(a)
}

// Matches the candidate's real work history and education against the
// admin-curated AlumniNetworkGroup catalog. Returns at most one group per
// name (a candidate with two roles at the same employer shouldn't see
// Xoogler twice), sorted by sortOrder then name. No candidateId path is not
// supported — unlike CuratedVideo/Course, there's no meaningful "show
// everything" admin view for this since matching IS the entire feature.
export async function getMatchedAlumniGroups(candidateId: string): Promise<AlumniNetworkGroup[]> {
  const [workHistory, education, groups] = await Promise.all([
    prisma.workHistoryEntry.findMany({ where: { candidateId }, select: { companyName: true } }),
    prisma.educationEntry.findMany({ where: { candidateId }, select: { schoolNameNormalized: true } }),
    prisma.alumniNetworkGroup.findMany({ where: { isActive: true } }),
  ])

  const companyNames = workHistory.map((w) => w.companyName).filter(Boolean)
  const schoolNames = education.map((e) => e.schoolNameNormalized).filter(Boolean)

  const matched = groups.filter((group) => {
    const candidateTexts = group.matchType === 'EMPLOYER' ? companyNames : schoolNames
    return group.keywords.some((keyword) => candidateTexts.some((text) => matchesKeyword(text, keyword)))
  })

  const seen = new Set<string>()
  const deduped = matched.filter((g) => (seen.has(g.name) ? false : (seen.add(g.name), true)))

  return deduped.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name))
}
