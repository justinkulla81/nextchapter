'use server'

import { revalidatePath } from 'next/cache'
import type { ContentVenue } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generatePostIdeas, draftPost, type PostIdea } from '@/lib/network/thought-leadership'
import { analyzeSubstack } from '@/lib/network/analyze-substack'
import { captureServerEvent } from '@/lib/posthog/server'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

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
  // shape as privacyOpenedUpBonusAt/jobBoardUsageBonusAt.
  if (!profile.contentUnlockBonusAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'MARKETING_PLAN_UNLOCK' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'MARKETING_PLAN_UNLOCK',
        text: 'Set up your Marketing Plan',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { contentUnlockBonusAt: new Date() },
      })
    }
  }

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

export type SubstackAnswerState = { error?: string } | undefined

export async function submitSubstackNo(): Promise<void> {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { substackHasAccount: false },
  })

  revalidatePath('/dashboard/marketing-plan')
}

export async function submitSubstackUrl(
  _prevState: SubstackAnswerState,
  formData: FormData
): Promise<SubstackAnswerState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const url = (formData.get('url') as string | null)?.trim()
  if (!url) return { error: 'Enter your Substack URL.' }

  try {
    new URL(url)
  } catch {
    return { error: 'Enter a valid URL.' }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { substackHasAccount: true },
  })

  await analyzeSubstack(profile.id, url)

  revalidatePath('/dashboard/marketing-plan')
}
