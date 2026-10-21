'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildTarget, mergeTarget, moveStance, pivotInterestsOf, pivotOf, stanceOf } from '@/lib/journey/pivot'
import { getLearningPaths } from '@/lib/journey/learning-paths-data'
import { markStepDone } from '@/lib/journey/learning-paths'
import { FUNCTION_PROFILES, PIVOT_REASONS } from '@/lib/journey/pathway'
import { pivotTargetWrite } from '@/lib/journey/pivot-target'
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


/** "Put it on my radar": a function they are thinking about. Not a commitment; committing is on Search Strategy. */
export async function saveExploredTarget(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  const fn = String(formData.get('target') ?? '')
  if (!candidateId || !FUNCTION_PROFILES[fn]) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true, primaryFunction: true, levelRankScore: true } })
  if (!p) return
  const previous = pivotOf(p.journeyDetails)
  const existing = previous?.targets.find((t) => t.function === fn)
  if (existing && stanceOf(existing) !== 'SET_ASIDE') return
  const now = new Date()
  const built = mergeTarget(existing, buildTarget(p.primaryFunction, fn, {}, now, (p.levelRankScore ?? 0) >= 60), now)
  const targets = [...(previous?.targets.filter((t) => t.function !== fn) ?? []), built]
  await saveDetails(candidateId, p.journeyDetails, { pivot: { targets, updatedAt: now.toISOString() } })
  captureServerEvent(candidateId, 'pivot_target_saved', { from: p.primaryFunction, to: fn, why: String(formData.get('why') ?? '') || null, revived: !!existing })
  revalidate()
}

/**
 * "Make this my target": the function they are moving to. Writes the target (the one source of truth,
 * src/lib/journey/pivot-target.ts) together with the older isPivoting flag, and puts it on the radar so the
 * plan and Search Strategy agree. Not a commitment: the route and hours are still chosen on Search Strategy.
 */
export async function setTargetFunction(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  const fn = String(formData.get('target') ?? '')
  if (!candidateId || !FUNCTION_PROFILES[fn]) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true, primaryFunction: true, targetFunction: true, levelRankScore: true } })
  if (!p) return
  const now = new Date()
  const previous = pivotOf(p.journeyDetails)
  const existing = previous?.targets.find((t) => t.function === fn)
  const built = mergeTarget(existing, buildTarget(p.primaryFunction, fn, {}, now, (p.levelRankScore ?? 0) >= 60), now)
  const targets = [...(previous?.targets.filter((t) => t.function !== fn) ?? []), built]
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      ...pivotTargetWrite(fn),
      journeyDetails: { ...((p.journeyDetails as Record<string, unknown> | null) ?? {}), pivot: { targets, updatedAt: now.toISOString() } } as Prisma.InputJsonValue,
    },
  })
  captureServerEvent(candidateId, 'pivot_target_function_set', { candidateId, from: p.primaryFunction, previousTarget: p.targetFunction, to: fn, tier: built.tier, source: String(formData.get('source') ?? 'pivot_plan') })
  revalidate()
  revalidatePath('/dashboard')
}

async function saveDetails(candidateId: string, current: unknown, patch: Record<string, unknown>) {
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { journeyDetails: { ...((current as Record<string, unknown> | null) ?? {}), ...patch } as Prisma.InputJsonValue },
  })
}

/** How an idea stands and how it feels. Every change is kept, so we can see the story over time. */
export async function updatePivotStance(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  const fn = String(formData.get('target') ?? '')
  if (!candidateId || !fn) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true } })
  const previous = pivotOf(p?.journeyDetails)
  const t = previous?.targets.find((x) => x.function === fn)
  if (!previous || !t) return
  const now = new Date()
  const moved = moveStance(t, { stance: String(formData.get('stance') ?? '') || null, feeling: String(formData.get('feeling') ?? '') || null, note: String(formData.get('note') ?? '') || null }, now)
  if (moved === t) return
  await saveDetails(candidateId, p?.journeyDetails, { pivot: { targets: previous.targets.map((x) => (x.function === fn ? moved : x)), updatedAt: now.toISOString() } })
  captureServerEvent(candidateId, 'pivot_stance_changed', { to: fn, from: stanceOf(t), stance: stanceOf(moved), feeling: moved.feeling ?? null, hasNote: !!formData.get('note') })
  revalidate()
}

/** An industry they want to look into. Kept apart from their job search until they say to include it. */
export async function updateIndustryInterest(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  const name = String(formData.get('industry') ?? '').trim().slice(0, 80)
  const action = String(formData.get('action') ?? 'add')
  if (!candidateId || !name) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true, targetIndustries: true } })
  if (!p) return
  const interests = pivotInterestsOf(p.journeyDetails)
  const now = new Date().toISOString()
  const others = interests.industries.filter((i) => i.name !== name)
  const mine = interests.industries.find((i) => i.name === name)
  if (action === 'add') interests.industries = [...others, { name, since: mine?.since ?? now }]
  else if (action === 'aside') interests.industries = [...others, { name, since: mine?.since ?? now, setAside: true }]
  else if (action === 'include') {
    interests.industries = others
    if (!p.targetIndustries.includes(name)) await prisma.candidateProfile.update({ where: { id: candidateId }, data: { targetIndustries: [...p.targetIndustries, name] } })
  }
  await saveDetails(candidateId, p.journeyDetails, { pivotInterests: interests })
  captureServerEvent(candidateId, 'pivot_industry_interest', { industry: name, action })
  revalidate()
}

/** "Start building this": adds a skill to what they want to build, which gives them a learning path for it. */
export async function addSkillToBuild(formData: FormData): Promise<void> {
  const candidateId = await getProfileId()
  const skill = String(formData.get('skill') ?? '').trim().slice(0, 60)
  if (!candidateId || !skill) return
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { skillsToBuild: true } })
  if (!p || p.skillsToBuild.includes(skill)) return
  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { skillsToBuild: [...p.skillsToBuild, skill].slice(-8) } })
  captureServerEvent(candidateId, 'skill_to_build_added', { skill, source: 'pivot_ideas', forFunction: String(formData.get('forFunction') ?? '') || null })
  revalidate()
  revalidatePath('/dashboard/learning')
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
