'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { answersOf, areaOf, MAX_ANSWER, withAnswer, type AreaSummary, type SavedAnswer } from '@/lib/strengths-interview/areas'
import { followUpFor, summarizeArea } from '@/lib/strengths-interview/ai'

// Find your strengths: save one answer (and get the follow-up that drills into it), or finish an area (and get its
// summary). Each call reads and writes one small row.

async function profileId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

async function rowOf(candidateId: string, area: string) {
  return prisma.strengthReflection.findUnique({ where: { candidateId_area: { candidateId, area } }, select: { answers: true } })
}

export type SaveAnswerResult = { ok: true; answers: SavedAnswer[] } | { ok: false; error: string }

export async function saveStrengthAnswer(input: { area: string; questionKey: string; text: string; isFollowUp: boolean }): Promise<SaveAnswerResult> {
  const candidateId = await profileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again and your answers so far are still here.' }
  const area = areaOf(input.area)
  const q = area?.questions.find((x) => x.key === input.questionKey)
  const text = input.text.trim().slice(0, MAX_ANSWER)
  if (!area || !q) return { ok: false, error: 'That question is not part of this area. Reload the page and try again.' }
  if (!text) return { ok: false, error: 'Write a few words first, or skip this question.' }

  try {
    const existing = answersOf((await rowOf(candidateId, area.key))?.answers)
    let answers: SavedAnswer[]
    if (input.isFollowUp) {
      const prev = existing.find((a) => a.questionKey === q.key)
      if (!prev) return { ok: false, error: 'We lost the question this answers. Reload the page and try again.' }
      answers = withAnswer(existing, { ...prev, followUpAnswer: text })
    } else {
      const followUp = await followUpFor(area, q, text, existing.filter((a) => a.questionKey !== q.key))
      answers = withAnswer(existing, { questionKey: q.key, question: q.text, answer: text, followUp, followUpAnswer: null })
    }
    await prisma.strengthReflection.upsert({
      where: { candidateId_area: { candidateId, area: area.key } },
      create: { candidateId, area: area.key, answers: answers as object[] },
      update: { answers: answers as object[] },
    })
    captureServerEvent(candidateId, 'strength_answer_saved', { area: area.key, questionKey: q.key, kind: q.kind, isFollowUp: input.isFollowUp, chars: text.length, followUpAsked: !input.isFollowUp && !!answers.find((a) => a.questionKey === q.key)?.followUp })
    return { ok: true, answers }
  } catch (error) {
    console.error('Find your strengths: save failed', error)
    return { ok: false, error: 'We could not save that. Your words are still in the box: try again in a moment.' }
  }
}

/** Marks a follow-up as skipped, so the flow moves on and the summary knows. */
export async function skipStrengthFollowUp(input: { area: string; questionKey: string }): Promise<SaveAnswerResult> {
  const candidateId = await profileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again and your answers so far are still here.' }
  const existing = answersOf((await rowOf(candidateId, input.area))?.answers)
  const prev = existing.find((a) => a.questionKey === input.questionKey)
  if (!prev) return { ok: true, answers: existing }
  const answers = withAnswer(existing, { ...prev, followUpAnswer: '' })
  await prisma.strengthReflection.update({ where: { candidateId_area: { candidateId, area: input.area } }, data: { answers: answers as object[] } })
  captureServerEvent(candidateId, 'strength_followup_skipped', { area: input.area, questionKey: input.questionKey })
  return { ok: true, answers }
}

export type FinishResult = { ok: true; summary: AreaSummary } | { ok: false; error: string }

export async function finishStrengthArea(areaKey: string): Promise<FinishResult> {
  const candidateId = await profileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again and your answers so far are still here.' }
  const area = areaOf(areaKey)
  if (!area) return { ok: false, error: 'That area does not exist. Go back and pick one.' }
  const answers = answersOf((await rowOf(candidateId, area.key))?.answers)
  if (answers.length === 0) return { ok: false, error: 'Answer at least one question in this area first.' }
  const summary = await summarizeArea(area, answers)
  if (!summary) return { ok: false, error: 'We could not write your summary just now. Your answers are saved: try again in a minute.' }
  await prisma.strengthReflection.update({
    where: { candidateId_area: { candidateId, area: area.key } },
    data: { ...summary, completedAt: new Date() },
  })
  const done = await prisma.strengthReflection.count({ where: { candidateId, completedAt: { not: null } } })
  captureServerEvent(candidateId, 'strength_area_completed', { area: area.key, answers: answers.length, areasDone: done, hasWatchOut: !!summary.watchOut })
  revalidatePath('/dashboard/strengths')
  return { ok: true, summary }
}

/** Shows or hides one finished strength in the member's Dossier. */
export async function setStrengthHidden(input: { area: string; hidden: boolean }): Promise<{ ok: boolean; error?: string }> {
  const candidateId = await profileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again to change this.' }
  if (!areaOf(input.area)) return { ok: false, error: 'That area does not exist.' }
  const r = await prisma.strengthReflection.updateMany({ where: { candidateId, area: input.area }, data: { hiddenFromEmployers: input.hidden } })
  if (r.count === 0) return { ok: false, error: 'Finish this area first.' }
  captureServerEvent(candidateId, 'strength_dossier_visibility_changed', { area: input.area, hidden: input.hidden })
  revalidatePath('/dashboard/strengths')
  revalidatePath('/dashboard/strengths/discover')
  return { ok: true }
}
