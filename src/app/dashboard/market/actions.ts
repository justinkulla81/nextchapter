'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { ROLES } from '@/lib/pivots/pivot-map'

type Kind = 'remote' | 'state' | 'relocate' | 'role' | 'industry'

// Add one expansion to the person's job search, or take it back out. Each is
// their choice; nothing is added without it.
export async function setSearchExpansion(kind: Kind, value: string, on: boolean): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const row = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { searchExpansion: true, targetIndustries: true } })
  const exp = readSearchExpansion(row.searchExpansion)
  const toggle = (list: string[], v: string) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v))
  const data: Record<string, unknown> = {}
  if (kind === 'remote') exp.remote = on
  else if (kind === 'state') {
    if (!/^[A-Z]{2}$/.test(value)) return { error: 'Unknown state.' }
    exp.states = toggle(exp.states, value)
  } else if (kind === 'role') {
    if (!ROLES.has(value)) return { error: 'Unknown role.' }
    exp.roles = toggle(exp.roles, value)
  } else if (kind === 'industry') {
    const v = value.trim().slice(0, 80)
    if (!v) return { error: 'Unknown industry.' }
    exp.industries = toggle(exp.industries, v)
    // Their target industries are what the job score reads; keep them in step.
    data.targetIndustries = on ? [...new Set([...row.targetIndustries, v])] : row.targetIndustries.filter((x) => x !== v)
  } else if (kind === 'relocate') data.openToRelocation = on
  else return { error: 'Unknown option.' }
  exp.at = new Date().toISOString()
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { ...data, searchExpansion: exp } })
  captureServerEvent(profile.id, on ? 'search_expansion_added' : 'search_expansion_removed', { kind, value })
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
