'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { effectiveJourney } from '@/lib/journey/journey'
import { START_FIELDS, currentStartStage, isStartStageKey, parseStartValue, startDetailsOf, type StartDetails } from '@/lib/journey/start-business'

const PAGE = '/dashboard/start-a-business'

async function currentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return getOrCreateCandidateProfile(user.id)
}

// Writes the start block into journeyDetails, keeping every other key (the venture, runway, paths, buy, ...).
async function writeStart(profileId: string, existing: unknown, start: StartDetails) {
  const details = { ...((existing as Record<string, unknown> | null) ?? {}), start }
  await prisma.candidateProfile.update({ where: { id: profileId }, data: { journeyDetails: details as Prisma.InputJsonValue } })
}

function refresh() {
  revalidatePath(PAGE)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/other-paths')
}

// Begin a plan for starting a business, next to whatever the member is already doing.
export async function startBuilding(): Promise<void> {
  const profile = await currentProfile()
  const start = { ...startDetailsOf(profile.journeyDetails) }
  await writeStart(profile.id, profile.journeyDetails, { ...start, startedAt: start.startedAt ?? new Date().toISOString() })
  captureServerEvent(profile.id, 'start_business_started', { main: effectiveJourney(profile) })
  refresh()
}

// Save the profile questions. A blank answer leaves the earlier one alone.
export async function saveStartIntake(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const start: StartDetails = { ...startDetailsOf(profile.journeyDetails) }
  const saved: string[] = []
  for (const f of START_FIELDS) {
    if (f.kind === 'multi' && !formData.has(`${f.key}__shown`)) continue
    if (f.kind !== 'multi' && !formData.has(f.key)) continue
    const v = parseStartValue(f, f.kind === 'multi' ? formData.getAll(f.key).map(String) : String(formData.get(f.key) ?? ''))
    if (v === null) continue
    ;(start as Record<string, unknown>)[f.key] = v
    saved.push(f.key)
  }
  start.startedAt = start.startedAt ?? new Date().toISOString()
  await writeStart(profile.id, profile.journeyDetails, start)
  captureServerEvent(profile.id, 'start_business_intake_saved', { fields: saved, count: saved.length, kind: start.kind ?? null, customers: start.customers ?? null, team: start.team ?? null, funding: start.funding ?? [], stage: currentStartStage(start) })
  refresh()
}

export async function setStartStage(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const to = String(formData.get('stage') ?? '')
  if (!isStartStageKey(to)) return
  const start = startDetailsOf(profile.journeyDetails)
  const from = currentStartStage(start)
  await writeStart(profile.id, profile.journeyDetails, { ...start, stage: to, startedAt: start.startedAt ?? new Date().toISOString() })
  captureServerEvent(profile.id, 'start_business_stage_changed', { from, to, main: effectiveJourney(profile) })
  refresh()
}
