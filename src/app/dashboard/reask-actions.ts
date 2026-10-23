'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { isReaskKey, reaskStateOf, withAnswer, withShown, withSnooze, withStop, type ReaskKey } from '@/lib/journey/stalled-reask'

const HREF: Record<ReaskKey, { has: string; none: string }> = {
  broaden: { has: '/dashboard/search-strategy', none: '/dashboard/search-strategy' },
  pivot: { has: '/dashboard/pivot-paths', none: '/dashboard/pivot-paths' },
  paths: { has: '/dashboard/other-paths', none: '/dashboard/other-paths' },
  coach: { has: '/dashboard/my-coaching', none: '/dashboard/premium' },
}

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

async function writeReask(profileId: string, existing: unknown, next: Record<string, unknown>) {
  const details = { ...((existing as Record<string, unknown> | null) ?? {}), reask: next }
  await prisma.candidateProfile.update({ where: { id: profileId }, data: { journeyDetails: details as Prisma.InputJsonValue } })
}

// The card painted: this is when the ask counts and the gap starts, never during the server render.
export async function recordReaskShown(weeks: number) {
  const profile = await getAuthedProfile()
  if (!profile) return
  const next = withShown(profile.journeyDetails, new Date())
  await writeReask(profile.id, profile.journeyDetails, next)
  captureServerEvent(profile.id, 'stalled_reask_shown', { weeks, asks: (next as { asks: number }).asks })
}

// They chose what to change. Recorded (so the plan follows it for four weeks and the option is not offered again soon), then
// sent where the choice leads. The destination is decided here, never trusted from the browser.
export async function answerReask(formData: FormData) {
  const profile = await getAuthedProfile()
  if (!profile) return
  const key = String(formData.get('choice') ?? '')
  if (!isReaskKey(key)) return
  const weeks = Number(formData.get('weeks')) || null
  await writeReask(profile.id, profile.journeyDetails, withAnswer(profile.journeyDetails, key, new Date()))
  captureServerEvent(profile.id, 'stalled_reask_answered', { answer: key, weeks, asks: reaskStateOf(profile.journeyDetails).asks, hasCoach: !!profile.coachId })
  revalidatePath('/dashboard')
  redirect(profile.coachId ? HREF[key].has : HREF[key].none)
}

export async function snoozeReask(weeks: number) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await writeReask(profile.id, profile.journeyDetails, withSnooze(profile.journeyDetails, new Date()))
  captureServerEvent(profile.id, 'stalled_reask_snoozed', { weeks })
  revalidatePath('/dashboard')
}

export async function stopReask(weeks: number) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await writeReask(profile.id, profile.journeyDetails, withStop(profile.journeyDetails))
  captureServerEvent(profile.id, 'stalled_reask_stopped', { weeks })
  revalidatePath('/dashboard')
}
