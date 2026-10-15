'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { readAnswers, WORK_DIMS, type WorkDim } from '@/lib/profile/work-profile'

// One "this or that" answer: -2 (first pole), 0 (either), +2 (second pole).
export async function saveWorkStyleAnswer(dim: WorkDim, value: -2 | 0 | 2): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  if (!WORK_DIMS.some((d) => d.key === dim) || ![-2, 0, 2].includes(value)) return { error: 'Pick one of the three answers.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const row = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { workStyleAnswers: true } })
  const answers = { ...readAnswers(row.workStyleAnswers), [dim]: { value, at: new Date().toISOString() } }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { workStyleAnswers: answers } })
  captureServerEvent(profile.id, 'work_style_answered', { dimension: dim, value })
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
