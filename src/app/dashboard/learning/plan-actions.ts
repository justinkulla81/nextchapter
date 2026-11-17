'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { MAX_PLAN, addBlocked, cleanTitle, cleanUrl, isPlanStatus, skillsForTitle } from '@/lib/learning/plan'

export type PlanResult = { error?: string; ok?: boolean } | undefined

async function who() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

// Add a course to my plan. Adding one that is already there changes nothing.
export async function addToPlan(_prev: PlanResult, f: FormData): Promise<PlanResult> {
  const profile = await who()
  if (!profile) return { error: 'Sign in to keep a plan.' }
  const title = cleanTitle(str(f, 'title'))
  const url = cleanUrl(str(f, 'url'))
  if (!title || !url) return { error: 'That course could not be added. Open it from the list and try again.' }
  const [count, existing] = await Promise.all([
    prisma.learningPlanEntry.count({ where: { candidateId: profile.id } }),
    prisma.learningPlanEntry.findUnique({ where: { candidateId_title: { candidateId: profile.id, title } }, select: { id: true } }),
  ])
  const blocked = addBlocked(count, !!existing)
  if (blocked) return { error: blocked }
  if (!existing) {
    const skills = skillsForTitle(title)
    const slot = str(f, 'slot') === 'featured' ? 'featured' : 'more'
    await prisma.learningPlanEntry.create({ data: { candidateId: profile.id, title, provider: str(f, 'provider').slice(0, 80) || null, url, skills, slot } })
    captureServerEvent(profile.id, 'learning_plan_course_added', { courseTitle: title, provider: str(f, 'provider') || null, slot, skills, planSize: count + 1, maxPlan: MAX_PLAN })
  }
  revalidatePath('/dashboard/learning')
  return { ok: true }
}

export async function setPlanStatus(_prev: PlanResult, f: FormData): Promise<PlanResult> {
  const profile = await who()
  if (!profile) return { error: 'Sign in to keep a plan.' }
  const status = str(f, 'status')
  if (!isPlanStatus(status)) return { error: 'Pick planned, started or done.' }
  const r = await prisma.learningPlanEntry.updateMany({ where: { id: str(f, 'id'), candidateId: profile.id }, data: { status } })
  if (r.count === 0) return { error: 'That course is no longer in your plan.' }
  captureServerEvent(profile.id, 'learning_plan_status_changed', { entryId: str(f, 'id'), status })
  revalidatePath('/dashboard/learning')
  return { ok: true }
}

export async function removeFromPlan(_prev: PlanResult, f: FormData): Promise<PlanResult> {
  const profile = await who()
  if (!profile) return { error: 'Sign in to keep a plan.' }
  const r = await prisma.learningPlanEntry.deleteMany({ where: { id: str(f, 'id'), candidateId: profile.id } })
  if (r.count === 0) return { error: 'That course is no longer in your plan.' }
  captureServerEvent(profile.id, 'learning_plan_course_removed', { entryId: str(f, 'id') })
  revalidatePath('/dashboard/learning')
  return { ok: true }
}
