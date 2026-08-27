'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import type { PrivacyTier, NotificationTier, CurrentJobStatus } from '@prisma/client'

const VALID_TIERS: PrivacyTier[] = ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE', 'STEALTH', 'LOCKED']
const VALID_NOTIFICATION_TIERS: NotificationTier[] = ['FULL', 'ESSENTIALS', 'MINIMAL']
const VALID_JOB_STATUSES = Object.keys(CURRENT_JOB_STATUS_LABELS) as CurrentJobStatus[]

export type FormState = { error?: string } | undefined

export async function updatePrivacyTier(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to change this.' }
  }

  const tier = formData.get('privacyTier') as PrivacyTier | null
  if (!tier || !VALID_TIERS.includes(tier)) {
    return { error: 'Please choose a valid privacy tier.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { privacyTier: tier },
  })

  captureServerEvent(profile.id, 'privacy_tier_updated', { tier, previousTier: profile.privacyTier })

  // One-time bonus for confirming any explicit privacy tier choice at
  // all — only awarded once per candidate. The completion flag is set
  // unconditionally, not nested inside the sprint-exists check — this used
  // to require a current-week sprint to already exist before it would
  // record anything, which silently dropped the flag forever for anyone
  // who confirmed in the gap between a week rolling over and that week's
  // auto-assign cron actually running (a real, demonstrated case, not just
  // the brand-new-candidate edge case this comment used to describe). The
  // points credit is still genuinely best-effort.
  if (!profile.privacyOpenedUpBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { privacyOpenedUpBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'PRIVACY_CONFIRMED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'PRIVACY_CONFIRMED',
        text: 'Confirm your privacy setting',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
      captureServerEvent(profile.id, 'privacy_confirmed_bonus_awarded', { points: effort.points })
    }
  }

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/community')
}

// currentJobStatus is otherwise write-once, set only by updateSituation at
// onboarding (src/app/onboarding/actions.ts) — this is the one place a
// member can change it afterward. Deliberately only writes
// currentJobStatus: confidentialSearchMode and confidentialModeEnteredJobStatus
// are left untouched here, matching spec §11 ("Persona changed ... Prompt,
// never auto-switch") — evaluatePassiveToActivePrompt
// (src/lib/dashboard/passive-to-active-prompt.ts) reads the resulting
// mismatch between confidentialModeEnteredJobStatus and currentJobStatus to
// decide whether to show that prompt, and the member drives any mode change
// themselves via setConfidentialSearchMode below.
export async function updateCurrentJobStatus(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to change this.' }
  }

  const jobStatus = formData.get('currentJobStatus') as CurrentJobStatus | null
  if (!jobStatus || !VALID_JOB_STATUSES.includes(jobStatus)) {
    return { error: 'Please choose a valid option.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  if (profile.currentJobStatus === jobStatus) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { currentJobStatus: jobStatus },
  })

  captureServerEvent(profile.id, 'current_job_status_updated', {
    previousStatus: profile.currentJobStatus,
    newStatus: jobStatus,
  })

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard')
}

export async function updateNotificationTier(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to change this.' }
  }

  const tier = formData.get('notificationTier') as NotificationTier | null
  if (!tier || !VALID_NOTIFICATION_TIERS.includes(tier)) {
    return { error: 'Please choose a valid notification setting.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { notificationTier: tier },
  })

  captureServerEvent(profile.id, 'notification_tier_updated', { tier })

  revalidatePath('/dashboard/privacy')
}

export async function updateSmsConsent(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to change this.' }
  }

  const consent = formData.get('smsConsent') === 'on'
  const smsPhone = (formData.get('smsPhone') as string | null)?.trim()

  if (consent && !smsPhone) {
    return { error: 'Enter a mobile number to opt in.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      smsPhone: smsPhone || null,
      smsConsentedAt: consent ? new Date() : null,
    },
  })

  captureServerEvent(profile.id, consent ? 'sms_consent_opted_in' : 'sms_consent_opted_out')

  revalidatePath('/dashboard/privacy')
}

export async function setRecruiterDatabaseOptIn(optIn: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  // §4.7 — the Recruiter Database is a blanket exposure to every recruiter
  // who searches, with no per-recruiter approval step (unlike the
  // per-instance ProfileShare flow). That's incompatible with Confidential
  // Search Mode's "Dossier never shared without explicit per-instance
  // consent." Opting IN is blocked outright while the mode is on; opting
  // OUT always still works.
  if (optIn && profile.confidentialSearchMode) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      recruiterDatabaseOptIn: optIn,
      recruiterDatabaseRequestedAt: optIn ? new Date() : null,
      recruiterVisibilityConfirmedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, optIn ? 'recruiter_database_opt_in' : 'recruiter_database_opt_out')

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard/find-my-job')
}

export async function setResumeBookOptIn(optIn: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { resumeBookOptIn: optIn, resumeBookOptInConfirmedAt: new Date() },
  })

  captureServerEvent(profile.id, optIn ? 'resume_book_opt_in' : 'resume_book_opt_out', { source: 'privacy_page' })

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard/find-my-job')
}

export type DeactivateAccountFormState = { error?: string } | undefined

// Deliberately NOT a delete — see deactivatedAt's own schema comment. Every
// row stays intact; this only blocks dashboard access (getDashboardData)
// and signs the session out. Real deletion only ever happens by request to
// support@launchyournextchapter.com, per the Danger Zone's own copy.
export async function deactivateMyAccount(
  _prevState: DeactivateAccountFormState,
  formData: FormData
): Promise<DeactivateAccountFormState> {
  const confirmation = formData.get('confirmation') as string | null
  if (confirmation?.trim().toUpperCase() !== 'DEACTIVATE') {
    return { error: 'Type DEACTIVATE (all caps) to confirm.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { deactivatedAt: new Date() },
  })
  captureServerEvent(profile.id, 'account_deactivated')

  await supabase.auth.signOut()

  redirect('/')
}

// Revokes a coach's access (Prompt 54) — the only mechanism in this
// codebase that changes/removes coachId once set, and specifically clears
// coachDossierConsentedAt at the same time, since that's what actually
// gates the coach-facing Dossier/Coaching Notes read path.
export async function disconnectCoach(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { coachId: null, coachDossierConsentedAt: null },
  })

  captureServerEvent(profile.id, 'coach_disconnected')
  revalidatePath('/dashboard/privacy')
}

// Lets a candidate turn consent on later if they chose "Not right now"
// during onboarding — the only other place coachDossierConsentedAt is set.
export async function grantCoachDossierConsent(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.coachId) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { coachDossierConsentedAt: new Date() },
  })

  captureServerEvent(profile.id, 'coach_dossier_consent_granted')
  revalidatePath('/dashboard/privacy')

  // Prompt 60 — send them straight to the Coaching Onboarding Form now that
  // consent is in place, rather than leaving it to a passive dashboard gate.
  if (!(await hasSubmittedCoachingOnboardingForm(profile.id))) {
    redirect('/dashboard/coaching-form')
  }
}

export type ConfidentialModeActionResult = { error?: string } | undefined

// Confidential Search Mode toggle (spec §3, §6). Turning it ON is
// immediate, no confirmation. Turning it OFF requires the client to have
// already shown the "here's exactly what becomes visible" confirmation
// (ConfidentialModeToggle.tsx) — re-checked here server-side since a client
// gate alone is never trusted for a visibility-changing action.
export async function setConfidentialSearchMode(
  enabled: boolean,
  confirmed: boolean
): Promise<ConfidentialModeActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to change this.' }

  if (!enabled && !confirmed) {
    return { error: 'Confirmation is required to turn off Confidential Search Mode.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  if (profile.confidentialSearchMode === enabled) return

  await prisma.$transaction([
    prisma.candidateProfile.update({
      where: { id: profile.id },
      data: {
        confidentialSearchMode: enabled,
        confidentialSearchModeChangedAt: new Date(),
        // §11 "persona changed" trigger baseline (src/lib/dashboard/
        // passive-to-active-prompt.ts) — snapshot currentJobStatus at the
        // moment the mode turns on, so a later transition to LAID_OFF can
        // be detected against it. Left alone when turning off (stays at
        // whatever it was) — it's only ever read while the mode is on, and
        // re-set fresh the next time it's turned back on.
        ...(enabled ? { confidentialModeEnteredJobStatus: profile.currentJobStatus } : {}),
        // Turning the mode ON also closes the blanket Recruiter Database
        // exposure (§4.7 — "Dossier never shared without explicit
        // per-instance consent"). recruiterDatabaseOptIn shows the full
        // Dossier to every recruiter who searches, with no per-recruiter
        // approval step — that blanket exposure defeats the mode's whole
        // purpose, so it can't coexist with it. The per-instance
        // ProfileShare flow (src/app/dashboard/privacy/share-actions.ts) is
        // unaffected — it already requires a real per-instance choice.
        ...(enabled ? { recruiterDatabaseOptIn: false } : {}),
      },
    }),
    prisma.confidentialModeChangeLog.create({
      data: { candidateId: profile.id, enabled, source: 'SETTINGS_TOGGLE' },
    }),
  ])

  captureServerEvent(profile.id, enabled ? 'confidential_search_mode_enabled' : 'confidential_search_mode_disabled')

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard/marketing-plan')
  revalidatePath('/dashboard/find-my-job')
}

// Profile picture upload/remove/visibility-toggle actions live in
// ../actions.ts (uploadMyProfilePicture etc.) — the UI moved to the Profile
// page, so the actions did too.
