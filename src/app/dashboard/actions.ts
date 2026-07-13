'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActionWindow, Mood } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { recordMoodCheckIn } from '@/lib/daily/mood'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function markNetworkingListSubmitted() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { networkingListSubmittedAt: new Date() },
  })
  await recalculateScore(profile.id, 'networking_list_submitted')
  revalidatePath('/dashboard')
}

export async function markAskedForHelp() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { askedForHelpAt: new Date() },
  })
  await recalculateScore(profile.id, 'asked_for_help')
  revalidatePath('/dashboard')
}

export async function markLinkedInActivity() {
  const profile = await getAuthedProfile()
  if (!profile) return

  const startOfTodayUTC = new Date()
  startOfTodayUTC.setUTCHours(0, 0, 0, 0)

  const alreadyLoggedToday = await prisma.linkedInActivityLog.findFirst({
    where: { candidateId: profile.id, loggedAt: { gte: startOfTodayUTC } },
  })
  if (alreadyLoggedToday) return

  await prisma.linkedInActivityLog.create({ data: { candidateId: profile.id } })
  await recalculateScore(profile.id, 'linkedin_activity_logged')
  revalidatePath('/dashboard')
}

export async function checkInMood(mood: Mood) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await recordMoodCheckIn(profile.id, mood)
  revalidatePath('/dashboard')
}

export async function setActionWindow(actionWindow: ActionWindow) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { actionWindow } })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/privacy')
}

export async function resendConfirmationEmail() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return

  await supabase.auth.resend({ type: 'signup', email: user.email })
}

export type ConfirmFormState = { error?: string } | undefined

export async function confirmProfile(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      firstName: (formData.get('firstName') as string) || null,
      lastName: (formData.get('lastName') as string) || null,
      phone: (formData.get('phone') as string) || null,
      streetAddress: (formData.get('streetAddress') as string) || null,
      currentCity: (formData.get('currentCity') as string) || null,
      currentState: (formData.get('currentState') as string) || null,
      profileConfirmedAt: new Date(),
    },
  })
  await recalculateScore(profile.id, 'profile_confirmed')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmIndustry(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      industryContext: (formData.get('industryContext') as string) || null,
      industryConfirmedAt: new Date(),
    },
  })
  await recalculateScore(profile.id, 'industry_confirmed')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmFunctionAndExperience(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const yearsExperience = formData.get('yearsExperience')

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      primaryFunction: (formData.get('primaryFunction') as string) || null,
      resumeLatestJobTitle: (formData.get('resumeLatestJobTitle') as string) || null,
      yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      highestLevelReached: (formData.get('highestLevelReached') as string) || null,
      functionConfirmedAt: new Date(),
    },
  })
  await recalculateScore(profile.id, 'function_confirmed')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmLinkedIn(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const url = (formData.get('linkedInUrl') as string | null)?.trim() || null
  const noLinkedIn = formData.get('noLinkedIn') === 'on'

  if (!url && !noLinkedIn) {
    return { error: "Enter your LinkedIn URL, or check the box if you don't have one yet." }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      linkedInUrl: url,
      linkedInConfirmedAt: new Date(),
    },
  })
  await recalculateScore(profile.id, 'linkedin_confirmed')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmSalaryAndAuthorization(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const lastSalary = formData.get('lastSalary')
  const workAuthorization = (formData.get('workAuthorization') as string) || null

  if (!lastSalary || !workAuthorization) {
    return { error: 'Please answer both questions.' }
  }

  const now = new Date()
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      lastSalary: Number(lastSalary),
      workAuthorization,
      salaryConfirmedAt: now,
      workAuthConfirmedAt: now,
    },
  })
  await recalculateScore(profile.id, 'salary_and_work_authorization_confirmed')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hireability-report')
}
