'use server'

import { revalidatePath } from 'next/cache'
import type { CompanySizeBand, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { CAREER_LEVELS, SIZE_BANDS, effectiveCareerHighPoint, type CareerLevel } from '@/lib/profile/career-high-point'

// The member's own correction of their career high point (career-high-point.ts). Saved
// beside the derived one on searchExpansion.careerHighPoint; it overrides it for matching.
export async function saveCareerHighPoint(input: {
  level: string
  sizeBand: string | null
  startup: boolean
}): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  if (!CAREER_LEVELS.includes(input.level as CareerLevel)) return { error: 'Pick the highest level you reached.' }
  const sizeBand = input.sizeBand && SIZE_BANDS.includes(input.sizeBand as CompanySizeBand) ? (input.sizeBand as CompanySizeBand) : null

  const profile = await getOrCreateCandidateProfile(user.id)
  const row = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { searchExpansion: true } })
  const raw = (row.searchExpansion && typeof row.searchExpansion === 'object' ? row.searchExpansion : {}) as Record<string, unknown>
  const store = readSearchExpansion(raw).careerHighPoint ?? {}
  const before = effectiveCareerHighPoint(store)
  const member = {
    level: input.level as CareerLevel,
    sizeBand,
    startup: input.startup === true,
    companyName: before?.companyName ?? null,
    title: before?.title ?? null,
    source: 'member' as const,
    at: new Date().toISOString(),
  }
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { searchExpansion: { ...raw, careerHighPoint: { ...store, member } } as unknown as Prisma.InputJsonValue },
  })
  captureServerEvent(profile.id, 'career_high_point_edited', {
    level: member.level,
    sizeBand: member.sizeBand,
    startup: member.startup,
    previousLevel: before?.level ?? null,
    previousSizeBand: before?.sizeBand ?? null,
    previousStartup: before?.startup ?? null,
    previousSource: before?.source ?? null,
  })
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
