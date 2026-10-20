'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { candidateOrgIds } from '@/lib/employer/staff-programs'

export type CourseStatus = 'NONE' | 'STARTED' | 'COMPLETED'

// Your employer sees how many people started or finished each course, never who.
export async function setCompanyCourseStatus(courseId: string, status: CourseStatus): Promise<{ error?: string }> {
  const profile = await getDashboardProfile()
  const orgIds = await candidateOrgIds(profile.id, 'LEARNING')
  const course = await prisma.orgCourse.findFirst({ where: { id: courseId, orgId: { in: orgIds }, isActive: true }, select: { id: true, orgId: true } })
  if (!course) return { error: 'This course is no longer listed.' }
  if (status === 'NONE') {
    await prisma.orgCourseProgress.deleteMany({ where: { courseId, candidateId: profile.id } })
  } else {
    await prisma.orgCourseProgress.upsert({
      where: { courseId_candidateId: { courseId, candidateId: profile.id } },
      create: { courseId, candidateId: profile.id, status },
      update: { status },
    })
  }
  captureServerEvent(profile.id, 'company_course_status_set', { courseId, orgId: course.orgId, status })
  revalidatePath('/dashboard/company-courses')
  revalidatePath('/dashboard/learning')
  return {}
}
