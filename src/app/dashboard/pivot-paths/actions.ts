'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
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
