'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type {
  ActionWindow,
  Mood,
  EeocGenderIdentity,
  EeocRaceEthnicity,
  EeocYesNoDecline,
  PublicDisclosureComfort,
  HighestEducationLevel,
} from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recordMoodCheckIn } from '@/lib/daily/mood'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { deriveHighestLevel } from '@/lib/constants/education'
import { captureServerEvent } from '@/lib/posthog/server'
import { uploadAvatarFile } from '@/lib/avatar/avatar'
import type { AvatarUploadState } from '@/components/ui/avatar-upload-form'
import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import { recomputeCandidateLevelRank } from '@/lib/scoring/level-rank-service'

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

export async function markAskedForHelp() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { askedForHelpAt: new Date() },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/network')
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
  revalidatePath('/dashboard')
}

export async function checkInMood(mood: Mood) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await recordMoodCheckIn(profile.id, mood)

  // Small recurring bonus, same one-award-per-week shape as
  // VISIBILITY_COMFORT_CHECKIN — autoCompleteEngagementAction no-ops if
  // this week's check-in already earned it.
  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'MOOD_CHECKIN' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'MOOD_CHECKIN',
      text: "Checked in on how you're feeling",
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }

  captureServerEvent(profile.id, 'mood_checked_in', { mood })
  revalidatePath('/dashboard')
}

// This week's answer to "how comfortable do you feel being publicly visible
// in your search this week?" — a coaching/sentiment signal only (see
// getVisibilityComfortTrend), never a direct grade input, so this is a
// standalone one-field write rather than routed through commitWeeklySprint.
// Silently no-ops if no current-week sprint exists yet, same accepted gap
// as autoCompleteEngagementAction/ENGAGE_POST_UPDATE.
export async function checkInVisibilityComfort(comfort: PublicDisclosureComfort) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const sprint = await getCurrentWeekSprint(profile.id)
  if (!sprint) return

  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { visibilityComfort: comfort },
  })

  // One-time-per-week points bonus — autoCompleteEngagementAction no-ops if
  // this actionType is already completed in the current sprint's
  // committedActions, so answering again later this week never double-awards.
  const effort = estimateActionEffort({ actionType: 'VISIBILITY_COMFORT_CHECKIN' })
  await autoCompleteEngagementAction(profile.id, {
    actionType: 'VISIBILITY_COMFORT_CHECKIN',
    text: "Answered this week's visibility comfort check-in",
    points: effort.points,
    estimatedMinutes: effort.minutes,
  })

  captureServerEvent(profile.id, 'visibility_comfort_checked_in', { comfort })
  revalidatePath('/dashboard')
}

export async function dismissDashboardMessage(messageId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  // Bumping dismissedAt on every dismiss (not just the first) matters here —
  // getNextDashboardMessage only treats a dismissal as active for the rest
  // of the day it happened, so re-dismissing after that day's reset needs a
  // fresh timestamp, not the original one from days ago.
  await prisma.candidateMessageDismissal.upsert({
    where: { candidateId_messageId: { candidateId: profile.id, messageId } },
    create: { candidateId: profile.id, messageId },
    update: { dismissedAt: new Date() },
  })
  captureServerEvent(profile.id, 'dashboard_message_dismissed', { messageId })
  revalidatePath('/dashboard')
}

// The "How motivated are you today?" card's X — dismissal only lasts through
// the rest of the day (see startOfUTCDay in dashboard/page.tsx), same
// contract as dismissDashboardMessage above.
export async function dismissMoodCard() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { moodCardDismissedAt: new Date() },
  })
  revalidatePath('/dashboard')
}

export async function setActionWindow(actionWindow: ActionWindow) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { actionWindow } })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/privacy')
}

export async function resendConfirmationEmail(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'You need to be logged in to do this.' }

  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
  if (error) return { error: error.message }
  return {}
}

export type ConfirmFormState = { error?: string } | undefined

export async function confirmProfile(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const currentCity = (formData.get('currentCity') as string) || null

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      firstName: (formData.get('firstName') as string) || null,
      lastName: (formData.get('lastName') as string) || null,
      phone: (formData.get('phone') as string) || null,
      streetAddress: (formData.get('streetAddress') as string) || null,
      currentCity,
      currentState: (formData.get('currentState') as string) || null,
      metroArea: normalizeMetroArea(currentCity),
      profileConfirmedAt: new Date(),
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmEducation(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const checkedDegrees = new Set(formData.getAll('degrees') as HighestEducationLevel[])
  const highestEducationLevel = deriveHighestLevel(checkedDegrees)
  const hasJD = checkedDegrees.has('JD')
  const hasMD = checkedDegrees.has('MD')

  // hasMBA/hasDO are intentionally left untouched — there's no checkbox for
  // either in the current UI (see DEGREE_OPTIONS), so overwriting them here
  // would silently erase a value set by resume extraction or an earlier
  // version of this form.
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { highestEducationLevel, hasJD, hasMD },
  })
  revalidatePath('/dashboard/profile')
}

export async function confirmIndustry(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const industryContext = (formData.get('industryContext') as string) || null

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      industryContext,
      industryBucket: normalizeIndustryBucket(industryContext),
      industryConfirmedAt: new Date(),
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/hireability-report')
}

export async function updateResumeKeywords(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const resumeKeywords = formData
    .getAll('resumeKeywords')
    .map((v) => v.toString().trim())
    .filter(Boolean)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { resumeKeywords },
  })
  captureServerEvent(profile.id, 'resume_keywords_updated', { count: resumeKeywords.length })
  revalidatePath('/dashboard/profile')
}

export async function confirmFunctionAndExperience(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const yearsExperience = formData.get('yearsExperience')
  const highestLevelReached = (formData.get('highestLevelReached') as string) || null
  // Required, not just recommended — this drives levelRankScore, which
  // feeds job-fit matching sitewide. A blank value here previously slipped
  // through silently and left the candidate matched as an entry-level IC.
  if (!highestLevelReached) return { error: 'Select your highest level reached before confirming.' }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      primaryFunction: (formData.get('primaryFunction') as string) || null,
      resumeLatestJobTitle: (formData.get('resumeLatestJobTitle') as string) || null,
      yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      highestLevelReached,
      functionConfirmedAt: new Date(),
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/hireability-report')

  try {
    await recomputeCandidateLevelRank(profile.id)
  } catch (error) {
    console.error('Failed to recompute level rank after function/experience confirm:', error)
  }
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
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/linkedin')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmSalary(_prevState: ConfirmFormState, formData: FormData): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const lastSalaryThousandsRaw = formData.get('lastSalaryThousands')
  if (!lastSalaryThousandsRaw) return { error: 'Enter your last salary.' }

  const lastSalaryThousandsEntered = Number(lastSalaryThousandsRaw)
  // Auto-correct if someone enters the full dollar amount instead of thousands.
  const lastSalary =
    lastSalaryThousandsEntered >= 10000
      ? Math.round(lastSalaryThousandsEntered / 1000) * 1000
      : lastSalaryThousandsEntered * 1000

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { lastSalary, salaryConfirmedAt: new Date() },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/hireability-report')
}

export async function confirmWorkAuthorization(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const workAuthorization = (formData.get('workAuthorization') as string) || null
  const visaStatus = (formData.get('visaStatus') as string) || null
  if (!workAuthorization) return { error: 'Select your work authorization status.' }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { workAuthorization, visaStatus, workAuthConfirmedAt: new Date() },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/hireability-report')
}

export async function uploadMyProfilePicture(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a photo first.' }

  const result = await uploadAvatarFile(profile.id, file)
  if (result.error) return { error: result.error }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { profilePictureUrl: result.url },
  })

  captureServerEvent(profile.id, 'profile_picture_uploaded')
  revalidatePath('/dashboard/profile')
  return undefined
}

export async function removeMyProfilePicture(): Promise<void> {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { profilePictureUrl: null },
  })

  captureServerEvent(profile.id, 'profile_picture_removed')
  revalidatePath('/dashboard/profile')
}

export async function toggleMyProfilePictureVisible(current: boolean): Promise<void> {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { profilePictureVisible: !current },
  })

  captureServerEvent(profile.id, 'profile_picture_visibility_toggled', { visible: !current })
  revalidatePath('/dashboard/profile')
}

// Prompt 69 — optional EEOC self-ID. Every field is independently optional;
// an empty string from the form means "leave unanswered," not "clear a
// previous answer to null" — a candidate can answer some questions and
// skip others in the same submit. HARD GUARDRAIL: nothing downstream of
// this write may read these fields except the admin-only bias-detection
// dashboard (src/lib/admin/bias-detection.ts).
export async function updateEeocSelfId(formData: FormData): Promise<void> {
  const profile = await getAuthedProfile()
  if (!profile) return

  const gender = (formData.get('eeocGenderIdentity') as EeocGenderIdentity | '') || undefined
  const race = (formData.get('eeocRaceEthnicity') as EeocRaceEthnicity | '') || undefined
  const disability = (formData.get('eeocDisabilityStatus') as EeocYesNoDecline | '') || undefined
  const veteran = (formData.get('eeocVeteranStatus') as EeocYesNoDecline | '') || undefined

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      ...(gender && { eeocGenderIdentity: gender }),
      ...(race && { eeocRaceEthnicity: race }),
      ...(disability && { eeocDisabilityStatus: disability }),
      ...(veteran && { eeocVeteranStatus: veteran }),
      eeocRespondedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, 'eeoc_self_id_updated')
  revalidatePath('/dashboard/profile')
}
