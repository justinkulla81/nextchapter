import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { aiSkillLabelsForCourse } from '@/lib/learning/ai-course-tags'
import { looksAiRelated } from '@/lib/learning/course-scan/classify'
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
  // The member Learning page keeps function courses and certifications that are not about AI (a contract law course, a CPA
  // prep). The public catalog is AI courses: those must be tagged to an AI skill or say AI in their own words.
  const aiOnly = rows.filter((r) => r.category === 'AI_TRAINING' || aiSkillLabelsForCourse(r.url).length > 0 || looksAiRelated(`${r.title} ${r.description}`))
  return assignSlugs(aiOnly.map((r) => ({ ...r, sponsor: r.sponsor ?? r.provider }))).map((r) => ({
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
