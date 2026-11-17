import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import type { Person } from './skills-intel'

const WEEK = 7 * 86_400_000

/**
 * The people in an organization's group, as the coarse fields skills intelligence needs. One bounded read (at most 3,000 members,
 * a narrow row each, about 2 MB), shared for 30 minutes per organization. Résumé keywords are read only to be counted against a skills
 * vocabulary; nothing here carries a name or an email.
 */
export const loadSupply = memoTtl(
  30 * 60_000,
  (institutionId: string) => institutionId,
  async (institutionId: string): Promise<Person[]> => {
    const now = Date.now()
    const rows = await prisma.institutionMember.findMany({
      where: { institutionId, candidateId: { not: null } },
      take: 3000,
      select: {
        candidate: { select: { primaryFunction: true, industryBucket: true, highestLevelReached: true, yearsExperience: true, journey: true, journeyStage: true, journeyChangedAt: true, resumeKeywords: true } },
        consents: { where: { scope: 'SHARE_DOSSIER_WITH_EMPLOYERS' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } },
      },
    })
    return rows.flatMap((r) => {
      const c = r.candidate
      if (!c) return []
      const out = c.journey === 'LAID_OFF' && c.journeyStage !== 'LANDED' && c.journeyChangedAt ? Math.floor((now - c.journeyChangedAt.getTime()) / WEEK) : null
      return [{ function: c.primaryFunction, industry: c.industryBucket, level: c.highestLevelReached, years: c.yearsExperience, weeksOut: out, keywords: c.resumeKeywords, dossier: r.consents[0]?.granted === true }]
    })
  },
)
