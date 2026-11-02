import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { aiSkillLabelsForCourse } from '@/lib/learning/ai-course-tags'
import { assignSlugs, functionsForCourse, type PublicCourse } from '@/lib/learning/public-catalog-shared'

/**
 * Every active AI course, function course and certification as the public catalog shows it (/ai-courses). One small query
 * (the Course table is a few hundred rows), shared by every page in a request. Business-skills and speaking courses are
 * not AI courses and stay on the member Learning page.
 */
export const getPublicCatalog = cache(async (): Promise<PublicCourse[]> => {
  const rows = await prisma.course.findMany({
    where: { isActive: true, category: { in: ['AI_TRAINING', 'FUNCTION_TRAINING', 'CERTIFICATION'] } },
    select: { title: true, sponsor: true, description: true, url: true, provider: true, free: true, skillLevel: true, category: true, keywords: true, targetFunctions: true },
  })
  return assignSlugs(rows.map((r) => ({ ...r, sponsor: r.sponsor ?? r.provider }))).map((r) => ({
    slug: r.slug,
    title: r.title,
    sponsor: r.sponsor,
    description: r.description,
    url: r.url,
    provider: r.provider,
    free: r.free,
    level: r.skillLevel,
    category: r.category,
    functions: functionsForCourse(r),
    skills: aiSkillLabelsForCourse(r.url),
  }))
})
