'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { readSkillLevels, skillKey } from '@/lib/profile/skill-matrix'
import { captureMatchBaseline } from '@/lib/personalization/match-snapshot'
import { refreshCurrentMatches } from '@/lib/applications/skill-snapshot-data'

/**
 * "I have this" on a skill the member's applications keep asking for: adds it to the skills matrix
 * (confirmedSkillsHave; a skill they had removed is restored), then recomputes the current match of
 * their application snapshots. The snapshots' original match is never changed.
 */
export async function confirmApplicationSkill(skill: string): Promise<{ ok: boolean; error?: string }> {
  const term = typeof skill === 'string' ? skill.trim() : ''
  if (!term || term.length > 80) return { ok: false, error: 'That skill could not be added. Reload the page and try again.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  await captureMatchBaseline(profile)
  const key = skillKey(term)
  const have = new Set((profile.confirmedSkillsHave ?? []).map(skillKey))
  const levels = readSkillLevels(profile.skillLevels)
  const restore = levels[key]?.removed
  if (restore) delete levels[key]
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      ...(have.has(key) ? {} : { confirmedSkillsHave: [...(profile.confirmedSkillsHave ?? []), term] }),
      ...(restore ? { skillLevels: levels } : {}),
    },
  })
  const refreshed = await refreshCurrentMatches(profile.id).catch(() => 0)
  captureServerEvent(profile.id, 'application_skill_added_to_matrix', { skill: term, restored: !!restore, snapshotsRefreshed: refreshed })
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/learning')
  revalidatePath('/dashboard/skills-assessments')
  return { ok: true }
}
