import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { aggregateSkillGaps, jobSkillGap, type AggregatedSkillGap, type JobSkillGap } from '@/lib/jobs/job-skill-gap'

export function memberSkillKeywords(profile: { resumeKeywords: string[]; confirmedSkillsHave: string[] }): string[] {
  return [...new Set([...profile.resumeKeywords, ...profile.confirmedSkillsHave].map((k) => k.trim()).filter(Boolean))]
}

const BEST_FIT_JOBS = 60

/**
 * The member's skills gap across their best-fit open jobs: which skills those jobs ask
 * for that the member doesn't show. Null if it can't be computed — a report must never
 * fail because this did.
 */
export async function loadMemberSkillGap(candidateId: string): Promise<AggregatedSkillGap | null> {
  try {
    const [profile, unlock] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      isDossierUnlocked(candidateId),
    ])
    const { open } = await loadBoardShortlist({ candidate: profile, isCandidatePlus: unlock.unlocked, size: BEST_FIT_JOBS })
    // Strong and good fits only: a gap against jobs the member would never be shortlisted for
    // is noise, not a skill to build.
    const fits = open.filter((p) => FIT_BUCKET_SORT_RANK[computeBoardListingFitBucket(profile, p)] <= 1)
    if (fits.length === 0) return null

    const keywords = memberSkillKeywords(profile)
    const gaps: { companyKey: string; gap: JobSkillGap }[] = fits.map((p) => {
      const key = normalizeOrgName(p.companyName)
      return {
        companyKey: key || p.id,
        gap: jobSkillGap({
          title: p.title,
          description: p.description,
          skills: p.skills,
          memberKeywords: keywords,
        }),
      }
    })
    return aggregateSkillGaps(gaps)
  } catch (error) {
    console.error('Could not compute skills gap for candidate', candidateId, error)
    return null
  }
}
