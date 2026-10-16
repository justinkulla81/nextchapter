'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { skillKey } from '@/lib/profile/skill-matrix'

const MAX = 40

/**
 * Saves the member's tools ("Tools you use"): checked ones join confirmedSkillsHave (the
 * skills matrix), offered ones they unchecked leave it, and toolsConfirmedAt is set.
 */
export async function saveConfirmedTools(checked: string[], offered: string[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be logged in to do this.' }
  const clean = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= 80).slice(0, MAX) : [])
  const on = clean(checked)
  const off = new Set(clean(offered).filter((o) => !on.includes(o)).map(skillKey))
  const profile = await getOrCreateCandidateProfile(user.id)
  const current = profile.confirmedSkillsHave ?? []
  const kept = current.filter((s) => !off.has(skillKey(s)))
  const have = new Set(kept.map(skillKey))
  const next = [...kept, ...on.filter((t) => !have.has(skillKey(t)))]
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { confirmedSkillsHave: next, toolsConfirmedAt: new Date() } })
  captureServerEvent(profile.id, 'tools_confirmed', { count: on.length })
  revalidatePath('/dashboard/skills-assessment')
  return { ok: true }
}
