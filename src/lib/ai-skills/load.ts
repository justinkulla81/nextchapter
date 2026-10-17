import 'server-only'
import type { Course } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getActiveCourses } from '@/lib/learning/courses'
import { buildSkillMatrix } from '@/lib/profile/skill-matrix'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { readPostingAi, type AiLevel } from '@/lib/ai-skills/taxonomy'
import { personAiLevels } from '@/lib/ai-skills/person'
import { aggregateAiGap, type AiGap } from '@/lib/ai-skills/gap'
import { courseAi, coursesFor } from '@/lib/ai-skills/courses'

const BEST_FIT_JOBS = 60

export type AiSkillGapData = {
  gap: AiGap
  // Courses that would move the person on each gap skill (covered skills have none).
  courses: Record<string, Course[]>
  levels: Record<string, AiLevel>
}

/**
 * The person's AI skills gap across their best-fit open jobs, with catalog courses for each gap.
 * No model calls: postings are read with the fixed AI vocabulary. Null if it can't be computed —
 * the Learning page must never fail because this did.
 */
export async function loadAiSkillGap(candidateId: string): Promise<AiSkillGapData | null> {
  try {
    const [profile, unlock, badges, tools, catalog] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      isDossierUnlocked(candidateId),
      prisma.learningBadge.findMany({ where: { candidateId }, select: { badgeType: true, title: true, description: true } }),
      prisma.candidateAiToolFamiliarity.findMany({ where: { candidateId }, select: { toolName: true } }),
      getActiveCourses(),
    ])
    const { open } = await loadBoardShortlist({ candidate: profile, isCandidatePlus: unlock.unlocked, size: BEST_FIT_JOBS, includeMidLevel: true, includeEarlyCareer: true })
    // Strong and good fits only: AI asks on jobs the person would never be shortlisted for are noise.
    const fits = open.filter((p) => FIT_BUCKET_SORT_RANK[computeBoardListingFitBucket(profile, p)] <= 1)
    if (fits.length === 0) return null

    const titleToCourse = new Map(catalog.map((c) => [c.title, c]))
    const completedCourses = badges
      .filter((b) => b.badgeType === 'course_completed')
      .flatMap((b) => {
        const c = titleToCourse.get(b.title)
        const ai = c ? courseAi(c) : null
        return ai ? [ai] : []
      })
    const { levels } = personAiLevels({
      matrix: buildSkillMatrix(profile),
      completedCourses,
      aiProjects: badges.filter((b) => b.badgeType === 'ai_project').map((b) => ({ title: b.title, description: b.description })),
      familiarTools: tools.map((t) => t.toolName),
    })
    const gap = aggregateAiGap(fits.map((p) => readPostingAi(p.title, p.description, (p.skills ?? []).join(' , '))), levels)

    const courses: Record<string, Course[]> = {}
    for (const row of gap.rows) {
      if (row.status === 'covered') continue
      const picks = coursesFor(row.key, row.requiredLevel, row.haveLevel, catalog)
      if (picks.length > 0) courses[row.key] = picks
    }
    return { gap, courses, levels }
  } catch (error) {
    console.error('Could not compute AI skills gap for candidate', candidateId, error)
    return null
  }
}
