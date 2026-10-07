'use server'

import type { CheckInPromptKind, Mood } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { recordMoodCheckIn } from '@/lib/daily/mood'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { isPromptDue } from '@/lib/daily/check-in-schedule'

const MOODS = new Set<Mood>(['STUCK', 'GETTING_THERE', 'MOVING', 'FIRED_UP'])
const COMMIT_RESPONSES = new Set(['YES', 'NOT_TODAY'])

async function currentCandidate() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// No revalidatePath here: these run from whatever portal page the pop-up
// opened on, and revalidating would re-render that whole page.

/** Records that the pop-up actually showed. Re-checks the schedule so two tabs can't both count. */
export async function recordCheckInPromptShown(kind: CheckInPromptKind, countShown: number | null, askedCount: number | null): Promise<string | null> {
  const profile = await currentCandidate()
  if (!profile) return null
  const recent = await prisma.checkInPrompt.findMany({
    where: { candidateId: profile.id, shownAt: { gte: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } },
    select: { shownAt: true },
  })
  if (!isPromptDue(recent.map((r) => r.shownAt))) return null
  const row = await prisma.checkInPrompt.create({ data: { candidateId: profile.id, kind, countShown, askedCount } })
  captureServerEvent(profile.id, 'checkin_prompt_shown', { promptId: row.id, kind, countShown, askedCount })
  return row.id
}

/**
 * The candidate's answer. A mood answer is a real check-in (it counts for
 * the streak and earns the weekly check-in points); a commitment answer is
 * YES / NOT_TODAY; closing the pop-up is DISMISSED.
 */
export async function answerCheckInPrompt(promptId: string, response: string): Promise<void> {
  const profile = await currentCandidate()
  if (!profile) return
  const prompt = await prisma.checkInPrompt.findFirst({ where: { id: promptId, candidateId: profile.id } })
  if (!prompt) return
  const valid = response === 'DISMISSED' || (prompt.kind === 'MOOD' ? MOODS.has(response as Mood) : COMMIT_RESPONSES.has(response))
  if (!valid) return
  await prisma.checkInPrompt.update({ where: { id: promptId }, data: { response, answeredAt: new Date() } })

  if (prompt.kind === 'MOOD' && MOODS.has(response as Mood)) {
    await recordMoodCheckIn(profile.id, response as Mood)
    // Same once-a-week bonus the old Check In card gave (no-op if already earned).
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
    captureServerEvent(profile.id, 'mood_checked_in', { mood: response, source: 'app_open_prompt' })
  }
  captureServerEvent(profile.id, response === 'DISMISSED' ? 'checkin_prompt_dismissed' : 'checkin_prompt_answered', {
    promptId, kind: prompt.kind, response, askedCount: prompt.askedCount, countShown: prompt.countShown,
  })
}
