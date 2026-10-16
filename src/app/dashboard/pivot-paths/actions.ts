'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildTarget, pivotOf } from '@/lib/journey/pivot'
import { getLearningPaths } from '@/lib/journey/learning-paths-data'
import { markStepDone } from '@/lib/journey/learning-paths'
import { FUNCTION_PROFILES, PIVOT_REASONS } from '@/lib/journey/pathway'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { ROLES } from '@/lib/pivots/pivot-map'
import { isPeopleEnergy, type PeopleEnergy } from '@/lib/pivots/scoring'

type Result = { ok: true } | { ok: false; error: string }

const NOT_SIGNED_IN: Result = { ok: false, error: 'You are signed out. Sign in again and try once more.' }
const SAVE_FAILED: Result = { ok: false, error: 'We could not save that just now. Try again in a moment.' }

async function getProfileId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

function revalidate() {
  revalidatePath('/dashboard/pivot-paths')
  revalidatePath('/dashboard/search-strategy')
}

/** Answer to "How much people contact energizes you?" — self-reported, stored as given. */
export async function savePeopleEnergy(answer: PeopleEnergy): Promise<Result> {
  if (!isPeopleEnergy(answer)) return { ok: false, error: 'Pick one of the three answers.' }
  const candidateId = await getProfileId()
  if (!candidateId) return NOT_SIGNED_IN
  try {
    const now = new Date()
    await prisma.pivotPreference.upsert({
      where: { candidateId },
      create: { candidateId, peopleEnergy: answer, peopleEnergyAt: now },
      update: { peopleEnergy: answer, peopleEnergyAt: now },
    })
  } catch (error) {
    console.error('Pivot paths: could not save people energy', error)
    return SAVE_FAILED
  }
  revalidate()
  return { ok: true }
}

/** "Not for me": hide a pivot path (hidden: true) or bring it back (hidden: false). */
export async function setPivotPathHidden(target: string, hidden: boolean): Promise<Result> {
  if (!ROLES.has(target)) return { ok: false, error: 'That path is no longer offered. Refresh the page.' }
  const candidateId = await getProfileId()
  if (!candidateId) return NOT_SIGNED_IN
  try {
    const current = await prisma.pivotPreference.findUnique({ where: { candidateId }, select: { dismissedTargets: true } })
    const set = new Set(current?.dismissedTargets ?? [])
    if (hidden) set.add(target)
    else set.delete(target)
    const dismissedTargets = [...set]
    await prisma.pivotPreference.upsert({ where: { candidateId }, create: { candidateId, dismissedTargets }, update: { dismissedTargets } })
  } catch (error) {
    console.error('Pivot paths: could not save hidden path', error)
    return SAVE_FAILED
  }
  revalidate()
  return { ok: true }
}

// ── What would it take? ─────────────────────────────────────────────────────


/** "Save to my list": the function goes on their list as exploring. Committing is done on Search Strategy. */
export async function saveExploredTarget(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  const fn = String(formData.get('target') ?? '')
  if (!candidateId || !FUNCTION_PROFILES[fn]) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true, primaryFunction: true, levelRankScore: true } })
  if (!p) return
  const previous = pivotOf(p.journeyDetails)
  if (previous?.targets.some((t) => t.function === fn)) return
  const now = new Date()
  const targets = [...(previous?.targets ?? []), buildTarget(p.primaryFunction, fn, {}, now, (p.levelRankScore ?? 0) >= 60)]
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { journeyDetails: { ...((p.journeyDetails as Record<string, unknown> | null) ?? {}), pivot: { targets, updatedAt: now.toISOString() } } as Prisma.InputJsonValue },
  })
  captureServerEvent(candidateId, 'pivot_target_saved', { from: p.primaryFunction, to: fn, why: String(formData.get('why') ?? '') || null })
  revalidate()
}

/** Marks one step of a learning path done. Progress is stored with the member's situation and survives journey changes. */
export async function completePathStep(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  if (!candidateId) return
  const pathId = String(formData.get('pathId') ?? '')
  const stepId = String(formData.get('stepId') ?? '')
  const { paths, progress } = await getLearningPaths(candidateId)
  const next = markStepDone(progress, paths, pathId, stepId)
  if (!next) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true } })
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { journeyDetails: { ...((p?.journeyDetails as Record<string, unknown> | null) ?? {}), pathProgress: next } as Prisma.InputJsonValue },
  })
  const path = paths.find((x) => x.id === pathId)
  captureServerEvent(candidateId, 'learning_path_step_done', { pathId, goalKind: path?.goalKind, source: path?.source, stepsDone: next[pathId]?.length ?? 0, stepsTotal: path?.steps.length ?? 0 })
  revalidate()
  revalidatePath('/dashboard/learning')
  revalidatePath('/dashboard')
}

/** "Show what it would take": keeps the choice in the address so the page can be shared and reloaded. */
export async function exploreTarget(formData: FormData): Promise<void> {
  const fn = String(formData.get('target') ?? '')
  const why = String(formData.get('why') ?? '')
  const q = new URLSearchParams()
  if (FUNCTION_PROFILES[fn]) q.set('target', fn)
  if (PIVOT_REASONS.some((r) => r.key === why)) q.set('why', why)
  redirect(`/dashboard/pivot-paths?${q.toString()}#what-it-takes`)
}
