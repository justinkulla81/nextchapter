'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { readSkillLevels, skillKey, SKILL_LEVELS, type SkillLevel } from '@/lib/profile/skill-matrix'

type Result = { error?: string; ok?: boolean }

async function me() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

async function patch(candidateId: string, key: string, value: { level?: SkillLevel; removed?: boolean } | null) {
  const row = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { skillLevels: true } })
  const levels = readSkillLevels(row.skillLevels)
  if (value) levels[key] = value
  else delete levels[key]
  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { skillLevels: levels } })
}

// The person's own level for one skill in their matrix.
export async function setSkillLevel(skill: string, level: SkillLevel): Promise<Result> {
  const profile = await me()
  if (!profile) return { error: 'You need to be logged in to do this.' }
  if (!SKILL_LEVELS.some((l) => l.key === level)) return { error: 'Pick used it, strong or expert.' }
  const key = skillKey(skill)
  await patch(profile.id, key, { level })
  captureServerEvent(profile.id, 'skill_level_set', { skill: key, level })
  revalidatePath('/dashboard/skills-assessment')
  return { ok: true }
}

// Take a skill out of the matrix (e.g. a resume keyword that isn't really a
// skill of theirs), or put it back.
export async function removeSkill(skill: string, removed: boolean): Promise<Result> {
  const profile = await me()
  if (!profile) return { error: 'You need to be logged in to do this.' }
  const key = skillKey(skill)
  await patch(profile.id, key, removed ? { removed: true } : null)
  captureServerEvent(profile.id, removed ? 'skill_removed' : 'skill_restored', { skill: key })
  revalidatePath('/dashboard/skills-assessment')
  return { ok: true }
}
