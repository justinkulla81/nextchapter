'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { findSkill } from '@/lib/skills/market'

export type WatchResult = { ok: true; watching: boolean } | { ok: false; error: string; signedOut?: boolean }

/** Watch or stop watching a skill. Only skills on the market list can be watched, so a slug cannot be made up. */
export async function setSkillWatched(slug: string, watch: boolean, source: string): Promise<WatchResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Join free or sign in to watch a skill.', signedOut: true }
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
  if (!profile) return { ok: false, error: 'Watching skills is for job seekers. Open your member home to set up your profile.' }

  if (watch) {
    const market = await loadSkillsMarket()
    const skill = market ? findSkill(market, slug) : null
    if (!skill) return { ok: false, error: 'That skill is not on the list right now. Reload the page and try again.' }
    await prisma.skillWatch.upsert({
      where: { candidateId_skillSlug: { candidateId: profile.id, skillSlug: skill.slug } },
      create: { candidateId: profile.id, skillSlug: skill.slug, skillName: skill.name },
      update: {},
    })
    captureServerEvent(profile.id, 'skill_watched', { skillSlug: skill.slug, skillName: skill.name, source, postings: skill.n })
  } else {
    await prisma.skillWatch.deleteMany({ where: { candidateId: profile.id, skillSlug: slug } })
    captureServerEvent(profile.id, 'skill_unwatched', { skillSlug: slug, source })
  }
  revalidatePath('/dashboard', 'layout')
  return { ok: true, watching: watch }
}

/** Whether the signed-in member watches this skill. False for anyone else, so the public page can stay cached. */
export async function getSkillWatched(slug: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (!profile) return false
    return !!(await prisma.skillWatch.findUnique({ where: { candidateId_skillSlug: { candidateId: profile.id, skillSlug: slug } }, select: { id: true } }))
  } catch {
    return false
  }
}
