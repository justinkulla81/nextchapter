'use server'

import { revalidatePath } from 'next/cache'
import type { ContentVenue } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generatePostIdeas, draftPost, type PostIdea } from '@/lib/network/thought-leadership'
import { captureServerEvent } from '@/lib/posthog/server'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { generateHardQuestions, shouldRouteHardQuestionsToCoach } from '@/lib/narrative/hard-questions'
import { isLinkedInPostingConfigured, publishLinkedInPost } from '@/lib/linkedin/oauth'
import { canParticipateInCommunity } from '@/lib/community/access'
import { createModeratedCommunityPost } from '@/lib/community/create-post'
import { gradeLinkedInProfile, REGRADE_COOLDOWN_DAYS } from '@/lib/linkedin/grade-profile'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type UnlockFormState = { error?: string } | undefined

export async function submitThoughtLeadershipUnlock(
  _prevState: UnlockFormState,
  formData: FormData
): Promise<UnlockFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const comfortLevel = Number(formData.get('comfortLevel'))
  const venues = formData.getAll('venues') as ContentVenue[]

  if (!Number.isFinite(comfortLevel)) {
    return { error: 'Please answer the comfort question first.' }
  }
  if (venues.length === 0) {
    return { error: 'Pick at least one venue.' }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { contentComfortLevel: comfortLevel, contentVenues: venues },
  })

  captureServerEvent(profile.id, 'thought_leadership_unlocked')

  // One-time bonus for answering the unlock question at all — same
  // shape as privacyOpenedUpBonusAt/jobBoardUsageBonusAt. The completion
  // flag is set unconditionally, not nested inside the sprint-exists
  // check — see the comment on the equivalent block in network/actions.ts
  // for why.
  if (!profile.contentUnlockBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { contentUnlockBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'MARKETING_PLAN_UNLOCK' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'MARKETING_PLAN_UNLOCK',
        text: 'Set up your Marketing Plan',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }

  revalidatePath('/dashboard/marketing-plan')
}

export type LinkedInGradeFormState = { error?: string } | undefined

// No public LinkedIn scraping API exists, so this grades whatever profile
// text the candidate pastes in themselves rather than fetching anything
// live — see LinkedInProfileGraderForm. Each submission is a real Claude
// call (gradeLinkedInProfile), so re-grading is cooldown-limited off
// analyzedAt rather than freely re-callable like generateIdeasAction above.
export async function submitLinkedInProfileGrade(
  _prevState: LinkedInGradeFormState,
  formData: FormData
): Promise<LinkedInGradeFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const pastedText = (formData.get('pastedText') as string | null)?.trim()
  if (!pastedText || pastedText.length < 50) {
    return { error: 'Paste your LinkedIn profile text (headline, About, and experience) — at least a few sentences.' }
  }

  const existing = await prisma.linkedInProfileGrade.findUnique({
    where: { candidateId: profile.id },
    select: { analyzedAt: true },
  })
  if (existing?.analyzedAt) {
    const daysSince = (Date.now() - existing.analyzedAt.getTime()) / 86400000
    if (daysSince < REGRADE_COOLDOWN_DAYS) {
      const daysLeft = Math.ceil(REGRADE_COOLDOWN_DAYS - daysSince)
      return { error: `You can re-grade your profile again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` }
    }
  }

  await gradeLinkedInProfile(profile.id, pastedText)
  captureServerEvent(profile.id, 'linkedin_profile_graded')
  revalidatePath('/dashboard/marketing-plan')
}

export type IdeasFormState = { ideas?: PostIdea[]; error?: string } | undefined

export async function generateIdeasAction(_prevState: IdeasFormState): Promise<IdeasFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const ideas = await generatePostIdeas(profile.id, profile.contentVenues)
  if (ideas.length === 0) return { error: 'Could not generate ideas right now — try again in a moment.' }
  if (profile.contentVenues.includes('LINKEDIN')) {
    captureServerEvent(profile.id, 'linkedin_ideas_generated')
  }
  return { ideas }
}

export type DraftFormState = { draft?: string; error?: string } | undefined

export async function draftPostAction(
  _prevState: DraftFormState,
  formData: FormData
): Promise<DraftFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const title = formData.get('title') as string | null
  const angle = formData.get('angle') as string | null
  const venue = formData.get('venue') as ContentVenue | null
  const reason = (formData.get('reason') as string | null)?.trim() || undefined
  if (!title || !angle) return { error: 'Missing idea details.' }
  if (!venue) return { error: 'Pick a venue to draft for.' }

  const draft = await draftPost(profile.id, { title, angle }, venue, reason)
  captureServerEvent(profile.id, 'content_draft_generated', { venue, hasReason: !!reason })
  return { draft }
}

export async function generateArticleAction(
  _prevState: DraftFormState,
  formData: FormData
): Promise<DraftFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const topic = (formData.get('topic') as string | null)?.trim()
  if (!topic) return { error: 'Give it a topic or angle first.' }

  const draft = await draftPost(profile.id, { title: topic, angle: topic }, 'SUBSTACK')
  return { draft }
}

// "Answers to the Hard Questions" — casual-register content, a separate
// generation from the six/nine-way narrative adaptations above. Routes to a
// coach-only note instead of generating when shouldRouteHardQuestionsToCoach
// is true (always false today — see that stub's comment).
export async function generateHardQuestionsAction() {
  const profile = await getAuthedProfile()
  if (!profile) return

  if (await shouldRouteHardQuestionsToCoach(profile.id)) return

  await generateHardQuestions(profile.id)
  captureServerEvent(profile.id, 'hard_questions_generated')
  revalidatePath('/dashboard/marketing-plan')
}

// Recurring low-comfort alternative to LINKEDIN_POST_IDEA — self-report, no
// verification, same trust level as that action. Once-per-day guard mirrors
// markLinkedInActivity's day-based dedupe. Returns whether this call
// actually logged a new one (false if already logged today), so the button
// can give honest immediate feedback either way.
export async function pitchPracticeWithCoachAction(): Promise<boolean> {
  const profile = await getAuthedProfile()
  if (!profile) return false

  const startOfTodayUTC = new Date()
  startOfTodayUTC.setUTCHours(0, 0, 0, 0)
  if (profile.pitchPracticeWithCoachAt && profile.pitchPracticeWithCoachAt >= startOfTodayUTC) return false

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { pitchPracticeWithCoachAt: new Date() },
  })
  captureServerEvent(profile.id, 'pitch_practice_with_coach_logged')

  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'PITCH_PRACTICE_WITH_COACH' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'PITCH_PRACTICE_WITH_COACH',
      text: 'Practice your pitch with your coach',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }
  revalidatePath('/dashboard/marketing-plan')
  return true
}

// Recurring low-comfort alternative to THOUGHT_LEADERSHIP_SHARE — same
// shape as pitchPracticeWithCoachAction above.
export async function shareNarrativeForFeedbackAction(): Promise<boolean> {
  const profile = await getAuthedProfile()
  if (!profile) return false

  const startOfTodayUTC = new Date()
  startOfTodayUTC.setUTCHours(0, 0, 0, 0)
  if (profile.sharedNarrativeForFeedbackAt && profile.sharedNarrativeForFeedbackAt >= startOfTodayUTC) return false

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { sharedNarrativeForFeedbackAt: new Date() },
  })
  captureServerEvent(profile.id, 'narrative_shared_for_feedback_logged')

  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'SHARE_NARRATIVE_FOR_FEEDBACK' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'SHARE_NARRATIVE_FOR_FEEDBACK',
      text: 'Share your narrative with a trusted contact for feedback',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }
  revalidatePath('/dashboard/marketing-plan')
  return true
}

// Direct LinkedIn posting — publishes the given text as a real feed update
// via the UGC Posts API, then awards the SAME LINKEDIN_POST_IDEA point value
// a self-reported "I posted this" click earns (see markLinkedInActivity in
// dashboard/actions.ts, left entirely unmodified). LinkedInActivityLog.source
// is the only thing that differs between the two paths (DIRECT_POST here vs.
// the column's SELF_REPORT default there) — pure provenance, same points.
// Unreachable in practice today: isLinkedInPostingConfigured() is false with
// no LINKEDIN_CLIENT_ID/SECRET set, and the page never renders a path to
// call this without that being true first.
export async function postToLinkedInAction(text: string): Promise<boolean> {
  const profile = await getAuthedProfile()
  if (!profile) return false
  if (!isLinkedInPostingConfigured()) return false
  if (!text.trim()) return false
  // §4.3: disabled by default in Confidential Search Mode, until the
  // candidate deliberately turns it on (see enableConfidentialLinkedInPosting
  // below) — re-checked here, never trusted from the client alone.
  if (profile.confidentialSearchMode && !profile.confidentialLinkedInPostingOptIn) return false

  const connection = await prisma.linkedInConnection.findUnique({ where: { candidateId: profile.id } })
  if (!connection || connection.disconnectedAt) return false

  try {
    await publishLinkedInPost(connection.accessToken, connection.personUrn, text)
  } catch (error) {
    console.error('Failed to publish LinkedIn post for candidate', profile.id, error)
    return false
  }

  // textLength backs the Visibility leaderboard's minimum-post-length guard
  // (see LinkedInActivityLog's schema comment) — this is the one write path
  // in the codebase where the real published text is available.
  await prisma.linkedInActivityLog.create({
    data: { candidateId: profile.id, source: 'DIRECT_POST', textLength: text.trim().length },
  })
  captureServerEvent(profile.id, 'linkedin_post_published', { source: 'direct_post' })

  // Mirror the real published text into the Community feed as a real
  // UPDATE post — same moderation/classification/points path a manually
  // typed post goes through (see createModeratedCommunityPost), never a
  // lower-scrutiny shortcut just because the text came from LinkedIn.
  // Best-effort: a candidate's real LinkedIn post already succeeded above,
  // so a failure here shouldn't be reported back as the whole action
  // failing. Same community-participation gate the manual composer checks
  // — publishing to LinkedIn doesn't bypass Community's own eligibility
  // rules.
  if (await canParticipateInCommunity(profile.id, profile.privacyTier, profile.confidentialSearchMode)) {
    await createModeratedCommunityPost(profile, { postType: 'UPDATE', description: text.trim() }).catch((error) =>
      console.error('Failed to mirror LinkedIn post into Community feed:', error)
    )
  }

  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'LINKEDIN_POST_IDEA' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'LINKEDIN_POST_IDEA',
      text: 'Publish a LinkedIn post',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }
  revalidatePath('/dashboard/marketing-plan')
  return true
}

// §4.3: "If they enable posting deliberately, warn once: your current
// employer can see this." One-time, explicit override — WaysToSayIt.tsx
// shows the warning text inline before calling this; re-checked here since
// this is the actual thing that lifts the block, not the warning text
// itself.
export async function enableConfidentialLinkedInPosting(): Promise<void> {
  const profile = await getAuthedProfile()
  if (!profile) return
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { confidentialLinkedInPostingOptIn: true },
  })
  captureServerEvent(profile.id, 'confidential_linkedin_posting_enabled')
  revalidatePath('/dashboard/marketing-plan')
}

