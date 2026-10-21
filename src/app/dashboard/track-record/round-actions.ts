'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { sanitizeRoundAnswers, type RoundSaveInput, type RoundSaveResult } from '@/lib/redesign/rounds'
import { TRACK_RECORD_FLOW, answersFromTrackRecord, trackRecordUpdate } from '@/lib/redesign/track-record-rounds'

// One round of the track record, saved on its own. Only the columns of the questions in that round are
// written (an unanswered question never erases a saved one), so stopping after any round keeps everything so
// far and the long form still reads the same row. The last round also does what the long form's save does on
// completion: stamps completedAt, credits the effort once, and sets trackRecordCompletedAt.
export async function saveTrackRecordRound(input: RoundSaveInput): Promise<RoundSaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be signed in to save. Sign in again; your answers are still on this page.' }

  const round = TRACK_RECORD_FLOW.rounds.find((r) => r.id === input.roundId)
  if (!round) return { ok: false, error: 'We could not tell which round this was. Reload the page; your saved answers are kept.' }

  try {
    const profile = await getOrCreateCandidateProfile(user.id)
    const incoming = sanitizeRoundAnswers(TRACK_RECORD_FLOW, round, input.answers)
    const { row, isPeopleManager } = trackRecordUpdate(incoming)

    const saved = await prisma.trackRecordResponse.upsert({
      where: { candidateId: profile.id },
      create: { candidateId: profile.id, ...row } as Prisma.TrackRecordResponseUncheckedCreateInput,
      update: row as Prisma.TrackRecordResponseUncheckedUpdateInput,
    })
    // Written to the same isPeopleManager field the long form writes; teamSizeManaged is left alone, as there.
    if (isPeopleManager !== null) {
      await prisma.candidateProfile.update({ where: { id: profile.id }, data: { isPeopleManager } })
    }

    let completed = false
    if (input.final) {
      await prisma.trackRecordResponse.update({ where: { candidateId: profile.id }, data: { completedAt: new Date() } })
      captureServerEvent(profile.id, 'track_record_updated', { source: 'rounds' })
      if (!profile.trackRecordCompletedAt) {
        const sprint = await getCurrentWeekSprint(profile.id)
        if (sprint) {
          const effort = estimateActionEffort({ actionType: 'TRACK_RECORD_COMPLETED' })
          await autoCompleteEngagementAction(profile.id, {
            actionType: 'TRACK_RECORD_COMPLETED',
            text: 'Complete your Track Record',
            points: effort.points,
            estimatedMinutes: effort.minutes,
          })
        }
        await prisma.candidateProfile.update({ where: { id: profile.id }, data: { trackRecordCompletedAt: new Date() } })
      }
      completed = true
      revalidatePath('/dashboard/track-record')
      revalidatePath('/dashboard/skills-assessments')
      revalidatePath('/dashboard')
    }

    const peopleManager = isPeopleManager !== null ? isPeopleManager : profile.isPeopleManager
    return { ok: true, answers: answersFromTrackRecord(saved, peopleManager), completed }
  } catch (error) {
    console.error('Track record round save failed:', error)
    return { ok: false, error: 'We could not save this round. Your answers are still here: try again in a moment.' }
  }
}
