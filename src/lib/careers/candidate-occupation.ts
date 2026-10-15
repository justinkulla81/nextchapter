import 'server-only'
import { prisma } from '@/lib/prisma'
import { lookupSocCode } from '@/lib/market/soc-codes'
import { getTaxonomy, getTitleIndex } from '@/lib/careers/taxonomy'
import { matchTitle, normalizeTitle, type TitleCandidate } from '@/lib/careers/title-match'

export type OccupationSource = 'TITLE_EXACT' | 'TITLE_FUZZY' | 'FUNCTION_PROXY' | 'CANDIDATE_CONFIRMED'

export type OccupationResolution =
  | { status: 'resolved'; socCode: string; title: string; source: OccupationSource; matchedFrom: string }
  | { status: 'needs_choice'; matchedFrom: string; candidates: TitleCandidate[] }
  | { status: 'no_title' }
  | { status: 'unavailable' }

/**
 * Which O*NET occupation the candidate's most recent job is.
 *
 * Order: a choice they confirmed (kept until their job title changes), then a
 * clear match of their latest resume job title, then the broad SOC proxy for
 * their stated function. A title that does not clearly match is never guessed
 * at: the Pivot Tool asks them to pick from a short list instead, which costs
 * nothing and beats a model's guess at the wrong "Manager".
 */
export async function resolveCandidateOccupation(candidateId: string): Promise<OccupationResolution> {
  const taxonomy = await getTaxonomy()
  if (!taxonomy) return { status: 'unavailable' }

  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { resumeLatestJobTitle: true, primaryFunction: true },
  })
  const title = profile?.resumeLatestJobTitle?.trim() || ''

  const saved = await prisma.candidateOccupation.findUnique({ where: { candidateId } })
  const savedUsable = saved && taxonomy.profiles.has(saved.socCode)
  if (savedUsable) {
    // Every saved match, including one the member confirmed, is tied to the resume job title it was made from. A new
    // resume with a different latest title means the match is re-made (the member is asked again if it is unclear).
    const stillCurrent = saved.matchedFrom === title || (!title && saved.source === 'FUNCTION_PROXY')
    if (stillCurrent) {
      return { status: 'resolved', socCode: saved.socCode, title: taxonomy.profiles.get(saved.socCode)!.title, source: saved.source as OccupationSource, matchedFrom: saved.matchedFrom }
    }
  }

  if (title) {
    const index = await getTitleIndex()
    if (!index) return { status: 'unavailable' }
    const match = matchTitle(index, title)
    if ((match.kind === 'EXACT' || match.kind === 'FUZZY') && taxonomy.profiles.has(match.socCode)) {
      const source: OccupationSource = match.kind === 'EXACT' ? 'TITLE_EXACT' : 'TITLE_FUZZY'
      await saveOccupation(candidateId, match.socCode, source, match.kind === 'EXACT' ? 1 : match.score, title)
      return { status: 'resolved', socCode: match.socCode, title: match.title, source, matchedFrom: title }
    }
    const candidates = match.candidates.filter((c) => taxonomy.profiles.has(c.socCode)).slice(0, 6)
    if (candidates.length > 0) return { status: 'needs_choice', matchedFrom: title, candidates }
  }

  const proxy = lookupSocCode(profile?.primaryFunction ?? null)
  if (proxy) {
    const prefix = `${proxy.code.slice(0, 2)}-${proxy.code.slice(2)}`
    const socCode = [...taxonomy.profiles.keys()].find((k) => k.startsWith(prefix))
    if (socCode) {
      await saveOccupation(candidateId, socCode, 'FUNCTION_PROXY', 0.4, '')
      return { status: 'resolved', socCode, title: taxonomy.profiles.get(socCode)!.title, source: 'FUNCTION_PROXY', matchedFrom: '' }
    }
  }

  return title ? { status: 'needs_choice', matchedFrom: title, candidates: [] } : { status: 'no_title' }
}

async function saveOccupation(candidateId: string, socCode: string, source: OccupationSource, confidence: number, matchedFrom: string) {
  await prisma.candidateOccupation.upsert({
    where: { candidateId },
    create: { candidateId, socCode, source, confidence, matchedFrom },
    update: { socCode, source, confidence, matchedFrom, matchedAt: new Date() },
  })
}

/** The candidate picked an occupation from the list; this holds until their latest resume job title changes. */
export async function confirmCandidateOccupation(candidateId: string, socCode: string): Promise<boolean> {
  const taxonomy = await getTaxonomy()
  if (!taxonomy?.profiles.has(socCode)) return false
  // Remember which resume title this choice was made against, so it lapses if that title changes.
  const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { resumeLatestJobTitle: true } })
  await saveOccupation(candidateId, socCode, 'CANDIDATE_CONFIRMED', 1, profile?.resumeLatestJobTitle?.trim() ?? '')
  return true
}

/** Deterministic occupation for a free-text target role (no persistence, no AI); null if not a clear match. */
export async function occupationForRoleText(text: string | null | undefined): Promise<string | null> {
  if (!text || !normalizeTitle(text)) return null
  const [taxonomy, index] = await Promise.all([getTaxonomy(), getTitleIndex()])
  if (!taxonomy || !index) return null
  const match = matchTitle(index, text)
  return (match.kind === 'EXACT' || match.kind === 'FUZZY') && taxonomy.profiles.has(match.socCode) ? match.socCode : null
}

/** Closest occupations to text the candidate typed, for the "change my occupation" search. */
export async function searchOccupationTitles(text: string): Promise<TitleCandidate[]> {
  const [taxonomy, index] = await Promise.all([getTaxonomy(), getTitleIndex()])
  if (!taxonomy || !index) return []
  return matchTitle(index, text, 10)
    .candidates.filter((c) => taxonomy.profiles.has(c.socCode))
    .slice(0, 8)
}
