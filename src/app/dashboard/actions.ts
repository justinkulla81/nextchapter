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
  CoachingStylePreference,
  ChangePacePreference,
  ChangeReadiness,
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
import {
  dismissPageBox,
  minimizeActionPlanBox as minimizeActionPlanBoxForCandidate,
  maximizeActionPlanBox as maximizeActionPlanBoxForCandidate,
  type PageKey,
} from '@/lib/dashboard/page-content'
import { clampMulti } from '@/lib/forms/clamp-multi'
import { MOTIVATIONS_MAX } from '@/lib/constants/onboarding'
import { maybeAwardSearchStrategyCompleteBonus } from '@/lib/weekly/search-strategy-complete'
import type { PassiveToActiveTrigger } from '@/lib/dashboard/passive-to-active-prompt'

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

// §A5.4 post-session rating — prompted once from SessionImpactCard
// (getUnviewedSessionImpact only ever shows a session once, so this is the
// one real window a candidate gets to rate it). Re-scoped to this
// candidate's own session so nothing lets one candidate rate another's.
export async function rateCoachSession(sessionId: string, rating: number): Promise<void> {
  const profile = await getAuthedProfile()
  if (!profile) return
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return

  const session = await prisma.coachSession.findFirst({
    where: { id: sessionId, candidateId: profile.id },
    select: { id: true, candidateRating: true, coachId: true },
  })
  if (!session || session.candidateRating !== null) return

  await prisma.coachSession.update({
    where: { id: sessionId },
    data: { candidateRating: rating, candidateRatedAt: new Date() },
  })

  captureServerEvent(profile.id, 'coach_session_rated', { sessionId, rating, coachId: session.coachId })
  revalidatePath('/dashboard')
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
      text: "Check in on how you're feeling",
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
    text: "Answer this week's visibility comfort check-in",
    points: effort.points,
    estimatedMinutes: effort.minutes,
  })

  captureServerEvent(profile.id, 'visibility_comfort_checked_in', { comfort })
  revalidatePath('/dashboard')
}

// Daily Message box's X — lasts through the rest of the day, resetting at
// 12:01am Pacific (see startOfPacificDay in page-content.ts's
// getPageBoxContent). Action Plan minimize/maximize below shares the same
// boundary; the mood card's dismiss further down intentionally stays on the
// UTC boundary (startOfUTCDay in dashboard/page.tsx) — only Daily Message
// and Action Plan were asked to move to Pacific time.
export async function dismissDailyMessageBox(pageKey: PageKey) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await dismissPageBox(profile.id, pageKey, 'DAILY_MESSAGE')
  captureServerEvent(profile.id, 'page_daily_message_dismissed', { pageKey })
  revalidatePath(pageKey === 'dashboard' ? '/dashboard' : `/dashboard/${pageKey}`)
}

// "How NextChapter works with Victoria" welcome video on the dashboard's
// Daily Message card — fires the moment playback starts, not on a close/
// dismiss click, so a candidate who never presses play still sees it next
// time. Idempotent (only the first play sets the timestamp) since a
// re-watch after the first shouldn't matter either way.
export async function markWelcomeVideoWatched() {
  const profile = await getAuthedProfile()
  if (!profile || profile.welcomeVideoWatchedAt) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { welcomeVideoWatchedAt: new Date() },
  })
  captureServerEvent(profile.id, 'welcome_video_watched')
}

// Action Plan box's minimize/maximize arrow — same day-boundary contract as
// dismissDailyMessageBox above (12:01am Pacific), but bidirectional: unlike
// Daily Message, maximizing before the boundary clears the dismissal record
// immediately instead of waiting for the next day (see
// maximizeActionPlanBox in page-content.ts).
export async function minimizeActionPlanBox(pageKey: PageKey) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await minimizeActionPlanBoxForCandidate(profile.id, pageKey)
  captureServerEvent(profile.id, 'action_plan_minimized', { pageKey })
  revalidatePath(pageKey === 'dashboard' ? '/dashboard' : `/dashboard/${pageKey}`)
}

export async function maximizeActionPlanBox(pageKey: PageKey) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await maximizeActionPlanBoxForCandidate(profile.id, pageKey)
  captureServerEvent(profile.id, 'action_plan_maximized', { pageKey })
  revalidatePath(pageKey === 'dashboard' ? '/dashboard' : `/dashboard/${pageKey}`)
}

// §10-12 "Passive to Active" prompt. evaluatePassiveToActivePrompt
// (src/lib/dashboard/passive-to-active-prompt.ts) is deliberately
// read-only, so nothing advances the 30-day throttle until the prompt
// actually renders client-side — PassiveToActivePromptCard calls this once,
// on mount. Recording "shown" here (not in the eval function) means a
// server re-render or prefetch that computes a trigger but never actually
// paints the card for the member can't silently burn their 30-day window.
export async function recordPassiveToActivePromptShown(trigger: PassiveToActiveTrigger) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { passiveToActivePromptLastShownAt: new Date() },
  })
  captureServerEvent(profile.id, 'passive_to_active_prompt_shown', { trigger })
}

// The 3 button choices (§10). "Something's changed" never sets
// confidentialSearchMode itself here — that stays exclusively
// setConfidentialSearchMode's job (src/app/dashboard/privacy/actions.ts),
// called directly by PassiveToActivePromptCard before this action runs, so
// there is only ever one path that turns the mode off. §11: "never gate
// anything on the answer" — this only ever logs the choice and, for "Don't
// ask again," flips the permanent flag; nothing else in the codebase reads
// passiveToActivePromptDontAskAgain or these events to gate behavior.
export async function respondToPassiveToActivePrompt(
  choice: 'OPENED_UP' | 'NOT_YET' | 'DONT_ASK_AGAIN',
  trigger: PassiveToActiveTrigger
) {
  const profile = await getAuthedProfile()
  if (!profile) return

  if (choice === 'DONT_ASK_AGAIN') {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { passiveToActivePromptDontAskAgain: true },
    })
  }

  const event =
    choice === 'OPENED_UP'
      ? 'passive_to_active_prompt_opened_up'
      : choice === 'NOT_YET'
        ? 'passive_to_active_prompt_not_yet'
        : 'passive_to_active_prompt_dont_ask_again'
  captureServerEvent(profile.id, event, { trigger })

  revalidatePath('/dashboard')
}

// The "How motivated are you today?" card's X — dismissal only lasts through
// the rest of the day (see startOfUTCDay in dashboard/page.tsx). This one
// intentionally stays UTC-scoped — see the comment on dismissDailyMessageBox
// above.
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
  revalidatePath('/dashboard/market-reality')
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
  const hasMBA = checkedDegrees.has('MBA')

  // hasDO is intentionally left untouched — there's no checkbox for it in
  // the current UI (see DEGREE_OPTIONS), so overwriting it here would
  // silently erase a value set by resume extraction.
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { highestEducationLevel, hasJD, hasMD, hasMBA },
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
  revalidatePath('/dashboard/market-reality')
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

// "What could you help another NextChapter member with" — shown on the
// candidate's Contacts profile page (see member-profile.ts), edited here.
export async function updateCanTeach(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const canTeach = formData
    .getAll('canTeach')
    .map((v) => v.toString().trim())
    .filter(Boolean)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { canTeach },
  })
  captureServerEvent(profile.id, 'can_teach_updated', { count: canTeach.length })
  revalidatePath('/dashboard/profile')
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
      resumeLatestJobTitle: (formData.get('resumeLatestJobTitle') as string) || null,
      yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      functionConfirmedAt: new Date(),
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/market-reality')

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
  revalidatePath('/dashboard/market-reality')
}

export async function confirmSalary(_prevState: ConfirmFormState, formData: FormData): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const declineToAnswer = formData.get('declineToAnswer') === '1'
  const lastSalaryThousandsRaw = formData.get('lastSalaryThousands')

  // Declining still confirms the item — same reasoning as confirmLinkedIn's
  // noLinkedIn checkbox: answering the question (even "I'd rather not say")
  // is the real signal, not any particular answer.
  if (declineToAnswer) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { lastSalary: null, salaryConfirmedAt: new Date() },
    })
    captureServerEvent(profile.id, 'salary_confirmed', { declined: true })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/market-reality')
    return
  }

  if (!lastSalaryThousandsRaw) return { error: 'Enter your last salary, or choose to decline.' }

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
  captureServerEvent(profile.id, 'salary_confirmed', { declined: false })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/market-reality')
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
  revalidatePath('/dashboard/market-reality')
}

// Blockers + Motivations (Personal Context, PersonalContextForm) — stays
// private between the candidate and their coach. Neither field is ever
// read by dossier-sections.ts; see that file's header comment for the
// explicit exclusion list.
export async function updatePersonalContext(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const jobSearchDifficultyRaw = formData.get('jobSearchDifficultyLevel')
  const jobSearchDifficultyLevel = jobSearchDifficultyRaw ? Number(jobSearchDifficultyRaw) : null
  const biggestBarriers = formData.getAll('biggestBarriers').map(String)
  const blockers = formData.getAll('blockers').map(String)
  const consistencySelfRating = formData.get('consistencySelfRating')
  const blockersOpenText = (formData.get('blockersOpenText') as string | null)?.trim() || null
  const motivations = clampMulti(formData, 'motivations', MOTIVATIONS_MAX)
  const motivationsElaboration = (formData.get('motivationsElaboration') as string | null)?.trim() || null
  const coachingStylePreference = (formData.get('coachingStylePreference') as CoachingStylePreference | null) || null
  const changePacePreference = (formData.get('changePacePreference') as ChangePacePreference | null) || null
  const changeReadiness = (formData.get('changeReadiness') as ChangeReadiness | null) || null

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      jobSearchDifficultyLevel,
      biggestBarriers,
      blockers,
      consistencySelfRating: consistencySelfRating ? Number(consistencySelfRating) : null,
      blockersOpenText,
      motivations,
      motivationsElaboration,
      coachingStylePreference,
      changePacePreference,
      changeReadiness,
      // Blockers and Motivations is one of the two required buckets that
      // feed search-strategy-guidance.ts — null the cache so the next page
      // load regenerates against the freshly-saved values, same
      // invalidation pattern as updateSearchStrategy.
      searchStrategyGuidance: null,
      searchStrategyGuidanceGeneratedAt: null,
    },
  })

  captureServerEvent(profile.id, 'personal_context_updated', {
    blockersCount: blockers.length,
    motivationsCount: motivations.length,
  })

  await maybeAwardSearchStrategyCompleteBonus(profile.id)

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
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
