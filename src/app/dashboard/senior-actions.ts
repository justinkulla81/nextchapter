'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import { readSeniorTrack } from '@/lib/journey/menu'
import type { Prisma } from '@prisma/client'

// The senior overlay's two choices live in journeyDetails.seniorTrack, so they need no new column and
// survive journey changes: the "I'm a senior leader" switch (true or false; absent means "decide from my
// level and title") and "show the job board normally again".
async function saveSeniorTrack(patch: { override?: boolean; jobsRestored?: boolean }): Promise<{ error?: string; id?: string; previous?: ReturnType<typeof readSeniorTrack> }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Your session ended. Sign in again.' }
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, journeyDetails: true } })
  if (!profile) return { error: 'Finish setting up your account first.' }
  const details = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  const previous = readSeniorTrack(details)
  const next = { ...((details.seniorTrack as Record<string, unknown> | undefined) ?? {}), ...patch }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: { ...details, seniorTrack: next } as Prisma.InputJsonValue } })
  revalidatePath('/dashboard', 'layout')
  return { id: profile.id, previous }
}

export async function setSeniorLeader(on: boolean): Promise<{ error?: string }> {
  const r = await saveSeniorTrack({ override: on })
  if (r.error || !r.id) return { error: r.error }
  captureServerEvent(r.id, 'senior_switch_changed', { on, was: r.previous?.override ?? null })
  return {}
}

export async function setSeniorJobsRestored(restored: boolean): Promise<{ error?: string }> {
  const r = await saveSeniorTrack({ jobsRestored: restored })
  if (r.error || !r.id) return { error: r.error }
  captureServerEvent(r.id, 'senior_jobs_restored', { restored })
  return {}
}
