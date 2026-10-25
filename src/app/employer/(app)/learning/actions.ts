'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireEmployeesRoleForAction } from '@/lib/employer/outplacement-auth'
import { orgProgramTypes, readCourse } from '@/lib/employer/staff-programs'

export type CourseFormState = { error?: string; ok?: string } | undefined

async function learningAdmin() {
  const orgUser = await requireEmployeesRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can manage courses.' } as const
  if (!(await orgProgramTypes(orgUser.orgId)).has('LEARNING')) return { error: 'Courses come with a Learning program. Ask your NextChapter contact to add one.' } as const
  return { orgUser } as const
}

export async function addCourse(_prev: CourseFormState, f: FormData): Promise<CourseFormState> {
  const g = await learningAdmin()
  if ('error' in g) return { error: g.error }
  const input = readCourse(f)
  if ('error' in input) return { error: input.error }
  const course = await prisma.orgCourse.create({ data: { orgId: g.orgUser.orgId, ...input }, select: { id: true } })
  captureServerEvent(g.orgUser.userId, 'org_course_added', { orgId: g.orgUser.orgId, courseId: course.id, skills: input.skills.length, covered: !!input.covered })
  revalidatePath('/employer/learning')
  return { ok: `${input.title} is listed. People on your Learning program see it under Company courses.` }
}

export async function setCourseActive(courseId: string, isActive: boolean): Promise<{ error?: string }> {
  const g = await learningAdmin()
  if ('error' in g) return { error: g.error }
  const r = await prisma.orgCourse.updateMany({ where: { id: courseId, orgId: g.orgUser.orgId }, data: { isActive } })
  if (!r.count) return { error: 'That course is no longer here. Refresh the page.' }
  captureServerEvent(g.orgUser.userId, isActive ? 'org_course_relisted' : 'org_course_removed', { orgId: g.orgUser.orgId, courseId })
  revalidatePath('/employer/learning')
  return {}
}
