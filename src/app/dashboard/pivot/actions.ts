'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { confirmCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { getTaxonomy } from '@/lib/careers/taxonomy'

export type PivotActionState = { error?: string; message?: string } | undefined

async function currentCandidate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

const LOGGED_OUT = { error: 'You need to be logged in to do this. Sign in and try again.' }

// "This is my job": the candidate picks the closest occupation from the list.
export async function confirmOccupation(_prev: PivotActionState, formData: FormData): Promise<PivotActionState> {
  const profile = await currentCandidate()
  if (!profile) return LOGGED_OUT
  const socCode = String(formData.get('socCode') ?? '')
  const matchedFrom = String(formData.get('matchedFrom') ?? '').slice(0, 200)
  const ok = await confirmCandidateOccupation(profile.id, socCode, matchedFrom)
  if (!ok) return { error: 'We could not find that occupation. Search again and pick one from the list.' }
  captureServerEvent(profile.id, 'pivot_occupation_confirmed', { candidateId: profile.id, socCode, source: 'CANDIDATE_CONFIRMED' })
  revalidatePath('/dashboard/pivot')
  return { message: 'Saved.' }
}

// Adds the tools and knowledge gaps shown on a pivot option to the skills the
// candidate has said they want to build. Skips ones already there.
export async function addPivotSkillsToPlan(_prev: PivotActionState, formData: FormData): Promise<PivotActionState> {
  const profile = await currentCandidate()
  if (!profile) return LOGGED_OUT
  const socCode = String(formData.get('socCode') ?? '')
  const taxonomy = await getTaxonomy()
  if (!taxonomy?.profiles.has(socCode)) return { error: 'We could not find that occupation. Reload the page and try again.' }

  const requested = formData
    .getAll('skill')
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 12)
  if (requested.length === 0) return { error: 'This role has no specific skills to add.' }

  const current = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { skillsToBuild: true } })
  const have = new Set(current.skillsToBuild.map((s) => s.toLowerCase()))
  const added = requested.filter((s) => !have.has(s.toLowerCase()))
  if (added.length > 0) {
    await prisma.candidateProfile.update({ where: { id: profile.id }, data: { skillsToBuild: [...current.skillsToBuild, ...added] } })
  }
  captureServerEvent(profile.id, 'pivot_skills_added', { candidateId: profile.id, socCode, skills: added, alreadyPresent: requested.length - added.length })
  revalidatePath('/dashboard/pivot')
  revalidatePath('/dashboard/learning')
  return { message: added.length > 0 ? `Added ${added.length} to the skills you want to build.` : 'Those are already on your list.' }
}

// Sets the candidate's target role to the occupation's title.
export async function setPivotTargetRole(_prev: PivotActionState, formData: FormData): Promise<PivotActionState> {
  const profile = await currentCandidate()
  if (!profile) return LOGGED_OUT
  const socCode = String(formData.get('socCode') ?? '')
  const taxonomy = await getTaxonomy()
  const target = taxonomy?.profiles.get(socCode)
  if (!target) return { error: 'We could not find that occupation. Reload the page and try again.' }

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { targetRoleType: target.title } })
  captureServerEvent(profile.id, 'pivot_target_role_set', { candidateId: profile.id, socCode, title: target.title })
  revalidatePath('/dashboard/pivot')
  revalidatePath('/dashboard/search-strategy')
  return { message: `Your target role is now ${target.title}.` }
}
