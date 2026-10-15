'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import { earlyCareerAudience } from '@/lib/early-career/audience'
import { ALL_CHECKLIST_IDS } from '@/lib/early-career/checklist'
import { saveMemberEducation } from '@/lib/early-career/data'
import { parseEducationForm } from '@/lib/early-career/education-form'
import { majorByKey } from '@/lib/early-career/major-roles'

const AUDIENCE_SELECT = {
  id: true,
  journey: true,
  journeyStage: true,
  currentJobStatus: true,
  highestLevelReached: true,
  yearsExperience: true,
  levelRankScore: true,
  isPivoting: true,
  resumeLatestJobTitle: true,
  earlyCareerChecklistDone: true,
} as const

async function currentProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  return prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: AUDIENCE_SELECT })
}

function revalidate() {
  revalidatePath('/dashboard/early-career')
  revalidatePath('/dashboard')
}

export async function setChecklistItem(itemId: string, done: boolean): Promise<{ error?: string }> {
  if (!ALL_CHECKLIST_IDS.has(itemId)) return { error: 'That step no longer exists. Refresh the page.' }
  const profile = await currentProfile()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  const set = new Set(profile.earlyCareerChecklistDone)
  if (done) set.add(itemId)
  else set.delete(itemId)
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { earlyCareerChecklistDone: [...set] } })
  const audience = earlyCareerAudience(profile)
  captureServerEvent(profile.id, audience === 'NEW_GRAD' ? 'first_job_checklist_item_completed' : 'early_career_checklist_item_completed', {
    item: itemId,
    done,
    audience,
    doneCount: set.size,
  })
  revalidate()
  return {}
}

export type EducationFormState = { error?: string; saved?: boolean } | undefined

export async function saveEducation(_prev: EducationFormState, formData: FormData): Promise<EducationFormState> {
  const profile = await currentProfile()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  const parsed = parseEducationForm(formData)
  if (!parsed.value) return { error: parsed.error }
  try {
    await saveMemberEducation(profile.id, parsed.value)
  } catch (error) {
    console.error('Failed to save education:', error)
    return { error: 'We could not save your school. Try again in a minute.' }
  }
  captureServerEvent(profile.id, 'early_career_education_saved', {
    audience: earlyCareerAudience(profile),
    degree: parsed.value.degree,
    hasMajor: !!parsed.value.fieldOfStudy,
    graduationYear: parsed.value.graduationYear,
    source: 'early_career_page',
  })
  revalidate()
  return { saved: true }
}

/** "Make this my target role" from the major → roles picker. */
export async function setTargetRoleFromMajor(majorKey: string, role: string): Promise<{ error?: string }> {
  const major = majorByKey(majorKey)
  if (!major || !major.roles.some((r) => r.title === role)) return { error: 'Pick a role from the list.' }
  const profile = await currentProfile()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { targetRoleType: role } })
  captureServerEvent(profile.id, 'early_career_target_role_set', {
    major: major.key,
    role,
    roles: major.roles.map((r) => r.title),
    audience: earlyCareerAudience(profile),
  })
  revalidate()
  return {}
}
