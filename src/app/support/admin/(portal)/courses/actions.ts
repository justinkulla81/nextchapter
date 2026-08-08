'use server'

import { revalidatePath } from 'next/cache'
import type { CourseCategory, CourseSkillLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

const SKILL_LEVELS: CourseSkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
const CATEGORIES: CourseCategory[] = ['AI_TRAINING', 'BUSINESS_SKILLS', 'CERTIFICATION', 'FUNCTION_TRAINING', 'SPEAKING']

function parseCommon(formData: FormData) {
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() ?? ''
  const url = (formData.get('url') as string | null)?.trim() ?? ''
  const logoUrl = (formData.get('logoUrl') as string | null)?.trim() || null
  const sponsor = (formData.get('sponsor') as string | null)?.trim() || null
  const provider = (formData.get('provider') as string | null)?.trim() || 'coursera'
  const skillLevelRaw = (formData.get('skillLevel') as string | null) ?? ''
  const categoryRaw = (formData.get('category') as string | null) ?? ''
  const free = formData.get('free') === 'on'
  const isActive = formData.get('isActive') === 'on'
  const requiresManagementSignal = formData.get('requiresManagementSignal') === 'on'
  const excludeIfHasMBA = formData.get('excludeIfHasMBA') === 'on'
  const sortOrderRaw = (formData.get('sortOrder') as string | null)?.trim()
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : null
  const targetFunctions = formData.getAll('targetFunctions').map((v) => String(v)).filter(Boolean)
  const keywordsRaw = (formData.get('keywords') as string | null) ?? ''
  const keywords = keywordsRaw
    .split('\n')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)

  if (!title) return { error: 'Title is required.' as const }
  if (!description) return { error: 'Description is required.' as const }
  if (!url) return { error: 'Link is required.' as const }
  if (!SKILL_LEVELS.includes(skillLevelRaw as CourseSkillLevel)) return { error: 'Choose a skill level.' as const }
  if (!CATEGORIES.includes(categoryRaw as CourseCategory)) return { error: 'Choose a category.' as const }
  if (categoryRaw === 'CERTIFICATION' && targetFunctions.length === 0) {
    return { error: 'Certifications need at least one target function.' as const }
  }
  if (categoryRaw === 'FUNCTION_TRAINING' && keywords.length === 0) {
    return { error: 'Function training needs at least one keyword.' as const }
  }

  return {
    data: {
      title,
      description,
      url,
      logoUrl,
      sponsor,
      provider,
      skillLevel: skillLevelRaw as CourseSkillLevel,
      category: categoryRaw as CourseCategory,
      free,
      isActive,
      requiresManagementSignal,
      excludeIfHasMBA,
      targetFunctions,
      keywords,
      sortOrder,
    },
  }
}

export async function createCourse(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  const course = await prisma.course.create({ data: parsed.data })
  captureServerEvent(admin?.email ?? 'admin', 'course_created', {
    courseId: course.id,
    category: course.category,
    skillLevel: course.skillLevel,
  })
  revalidatePath('/support/admin/courses')
}

export async function updateCourse(courseId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  await prisma.course.update({ where: { id: courseId }, data: parsed.data })
  captureServerEvent(admin?.email ?? 'admin', 'course_updated', { courseId })
  revalidatePath('/support/admin/courses')
  revalidatePath('/dashboard/learning')
}

export async function toggleCourseActive(courseId: string, current: boolean) {
  await requireAdmin()
  await prisma.course.update({ where: { id: courseId }, data: { isActive: !current } })
  revalidatePath('/support/admin/courses')
  revalidatePath('/dashboard/learning')
}

export async function deleteCourse(courseId: string) {
  await requireAdmin()
  await prisma.course.delete({ where: { id: courseId } })
  revalidatePath('/support/admin/courses')
  revalidatePath('/dashboard/learning')
}
