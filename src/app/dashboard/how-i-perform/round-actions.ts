'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recordPerformanceAssessment } from '@/lib/assessments/performance-record'
import { mergeAnswers, sanitizeAllAnswers, sanitizeRoundAnswers, type RoundAnswers, type RoundSaveInput, type RoundSaveResult } from '@/lib/redesign/rounds'
import { PERFORMANCE_FLOW, answersFromScores, performanceComplete, performanceResponses, scoresFromAnswers } from '@/lib/redesign/performance-rounds'

// One round of How I perform, saved on its own into a draft (item id -> score), so closing the tab loses nothing.
// The last round turns a complete draft into the same response row the long form saves (five scores, effort
// credit, completion event) and clears the draft. If the draft table is not there yet, the browser's own full
// set of answers stands in for it, so finishing still works and nothing is lost.
export async function saveHowIPerformRound(input: RoundSaveInput): Promise<RoundSaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be signed in to save. Sign in again; your answers are still on this page.' }

  const round = PERFORMANCE_FLOW.rounds.find((r) => r.id === input.roundId)
  if (!round) return { ok: false, error: 'We could not tell which round this was. Reload the page; your saved answers are kept.' }

  try {
    const profile = await getOrCreateCandidateProfile(user.id)
    const incoming = sanitizeRoundAnswers(PERFORMANCE_FLOW, round, input.answers)

    let draftReadable = true
    let stored: RoundAnswers = {}
    try {
      const draft = await prisma.performanceAssessmentDraft.findUnique({ where: { candidateId: profile.id } })
      stored = answersFromScores((draft?.answers ?? null) as Record<string, number> | null)
    } catch {
      draftReadable = false
    }

    // The saved draft first, then this round on top. At the end, the browser's full set fills any gap the draft cannot.
    let merged = mergeAnswers(stored, incoming)
    if (input.final && (!draftReadable || !performanceComplete(merged))) {
      merged = mergeAnswers(sanitizeAllAnswers(PERFORMANCE_FLOW, input.allAnswers), merged)
    }

    const scores = scoresFromAnswers(merged) as Prisma.InputJsonObject
    if (draftReadable) {
      try {
        await prisma.performanceAssessmentDraft.upsert({
          where: { candidateId: profile.id },
          create: { candidateId: profile.id, answers: scores },
          update: { answers: scores },
        })
      } catch (error) {
        console.error('How I perform draft save failed:', error)
        if (!input.final) return { ok: false, error: 'We could not save this round. Your answers are still here: try again in a moment.' }
      }
    }

    let completed = false
    if (input.final && performanceComplete(merged)) {
      await recordPerformanceAssessment(profile.id, performanceResponses(merged), { source: 'rounds' })
      if (draftReadable) await prisma.performanceAssessmentDraft.delete({ where: { candidateId: profile.id } }).catch(() => undefined)
      completed = true
      revalidatePath('/dashboard/how-i-perform')
      revalidatePath('/dashboard/skills-assessments')
      revalidatePath('/dashboard')
    }

    return { ok: true, answers: merged, completed }
  } catch (error) {
    console.error('How I perform round save failed:', error)
    return { ok: false, error: 'We could not save this round. Your answers are still here: try again in a moment.' }
  }
}
