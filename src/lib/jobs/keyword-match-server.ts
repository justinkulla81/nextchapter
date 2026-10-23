import 'server-only'
import { prisma } from '@/lib/prisma'
import { skillIdsFromKeywords } from '@/lib/careers/alias-server'
import { textSkillIds } from '@/lib/careers/text-skill-ids'
import { jobToolIds, keywordMatch, type KeywordMatch } from '@/lib/jobs/keyword-match'

export interface KeywordMatchJob {
  key: string
  jobText: string | null
  jobSkills?: string[]
  jobSkillIds?: string[]
}

/**
 * Resume keyword matches for a batch of jobs: one alias lookup for the member and one Skill-name
 * read for every tool id in play. No model call. A failed lookup returns no matches, never an error.
 */
export async function loadKeywordMatches(memberKeywords: string[], jobs: KeywordMatchJob[]): Promise<Map<string, KeywordMatch>> {
  const out = new Map<string, KeywordMatch>()
  if (jobs.length === 0) return out
  try {
    const memberSkillIds = await skillIdsFromKeywords(memberKeywords).catch(() => new Set<string>())
    for (const id of textSkillIds(memberKeywords.join(' , '))) memberSkillIds.add(id)
    const idsInPlay = new Set<string>()
    for (const j of jobs) for (const id of jobToolIds(j)) idsInPlay.add(id)
    const names = idsInPlay.size
      ? await prisma.skill.findMany({ where: { id: { in: [...idsInPlay] } }, select: { id: true, name: true } })
      : []
    const skillNames = new Map(names.map((n) => [n.id, n.name]))
    for (const j of jobs) out.set(j.key, keywordMatch({ ...j, memberKeywords, memberSkillIds, skillNames }))
  } catch (error) {
    console.error('Keyword match unavailable:', error)
  }
  return out
}
