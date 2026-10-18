'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { cleanCushion, cleanEvent } from '@/lib/career-story/validate'
import type { Prisma } from '@prisma/client'

export type StoryFormState = { error?: string; saved?: boolean } | undefined

const SIGNED_OUT = 'Your session ended. Sign in again, then try once more.'
const FAILED = 'We could not save that just now. Try again in a moment.'

async function profileId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? (await getOrCreateCandidateProfile(user.id)).id : null
}

const text = (f: FormData, k: string) => ((f.get(k) as string | null) ?? '').toString()

function refresh() {
  revalidatePath('/dashboard/my-career')
  revalidatePath('/dashboard/market-reality')
}

// Add a chapter (no sourceRef) or correct one we derived (sourceRef = work:<id>, edu:<id>, gap:<date>).
export async function saveStoryEvent(_prev: StoryFormState, formData: FormData): Promise<StoryFormState> {
  const candidateId = await profileId()
  if (!candidateId) return { error: SIGNED_OUT }
  const clean = cleanEvent({ kind: text(formData, 'kind'), label: text(formData, 'label'), detail: text(formData, 'detail'), start: text(formData, 'start'), end: text(formData, 'end'), reason: text(formData, 'reason') })
  if (!clean.ok) return { error: clean.error }
  const id = text(formData, 'id')
  const sourceRef = text(formData, 'sourceRef').slice(0, 80) || null
  const v = clean.value
  const data = { kind: v.kind, label: v.label, detail: v.detail, startDate: v.start, endDate: v.end, reason: v.reason, hidden: false }
  try {
    if (sourceRef) {
      await prisma.careerEvent.upsert({ where: { candidateId_sourceRef: { candidateId, sourceRef } }, create: { candidateId, sourceRef, ...data }, update: data })
    } else if (id) {
      const mine = await prisma.careerEvent.updateMany({ where: { id, candidateId }, data })
      if (mine.count === 0) return { error: 'We could not find that chapter. Refresh the page and try again.' }
    } else {
      const count = await prisma.careerEvent.count({ where: { candidateId, sourceRef: null } })
      if (count >= 60) return { error: 'That is a lot of chapters already. Remove one you no longer need before adding another.' }
      await prisma.careerEvent.create({ data: { candidateId, ...data } })
    }
  } catch (error) {
    console.error('Career story: could not save event', error)
    return { error: FAILED }
  }
  captureServerEvent(candidateId, sourceRef ? 'career_story_event_corrected' : id ? 'career_story_event_updated' : 'career_story_event_added', { kind: v.kind, reason: v.reason, hasEnd: !!v.end, derived: !!sourceRef })
  refresh()
  return { saved: true }
}

// Take something off the story. A derived event is hidden (the source data stays); one the member
// added is removed. Either way the member confirmed it first.
export async function removeStoryEvent(formData: FormData): Promise<StoryFormState> {
  const candidateId = await profileId()
  if (!candidateId) return { error: SIGNED_OUT }
  const id = text(formData, 'id')
  const sourceRef = text(formData, 'sourceRef').slice(0, 80)
  try {
    if (sourceRef) {
      const label = text(formData, 'label').slice(0, 80) || 'Hidden'
      const d = new Date(`${text(formData, 'start')}T12:00:00Z`)
      const start = Number.isNaN(d.getTime()) ? new Date() : d
      await prisma.careerEvent.upsert({
        where: { candidateId_sourceRef: { candidateId, sourceRef } },
        create: { candidateId, sourceRef, kind: 'WORK', label, startDate: start, hidden: true },
        update: { hidden: true },
      })
    } else if (id) {
      await prisma.careerEvent.deleteMany({ where: { id, candidateId } })
    } else return { error: 'We could not tell which chapter to remove. Refresh and try again.' }
  } catch (error) {
    console.error('Career story: could not remove event', error)
    return { error: FAILED }
  }
  captureServerEvent(candidateId, 'career_story_event_removed', { derived: !!sourceRef })
  refresh()
  return { saved: true }
}

async function mergeDetails(candidateId: string, patch: Record<string, unknown>) {
  const current = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journeyDetails: true } })
  const base = (current?.journeyDetails as Record<string, unknown> | null) ?? {}
  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { journeyDetails: { ...base, ...patch } as Prisma.InputJsonValue } })
}

// "How many months of expenses do you have saved?" Private; used only for the pause what-if.
export async function saveCushion(_prev: StoryFormState, formData: FormData): Promise<StoryFormState> {
  const candidateId = await profileId()
  if (!candidateId) return { error: SIGNED_OUT }
  const clean = cleanCushion(text(formData, 'months'))
  if (!clean.ok) return { error: clean.error }
  try {
    await mergeDetails(candidateId, { cushionMonths: clean.value })
  } catch (error) {
    console.error('Career story: could not save cushion', error)
    return { error: FAILED }
  }
  captureServerEvent(candidateId, 'career_story_cushion_saved', { hasValue: clean.value !== null })
  refresh()
  return { saved: true }
}

export async function setStoryHideYears(hide: boolean): Promise<{ ok: boolean }> {
  const candidateId = await profileId()
  if (!candidateId) return { ok: false }
  try {
    await mergeDetails(candidateId, { storyHideYears: !!hide })
  } catch (error) {
    console.error('Career story: could not save hide-years', error)
    return { ok: false }
  }
  captureServerEvent(candidateId, 'career_story_years_toggled', { hidden: !!hide })
  refresh()
  return { ok: true }
}

// Client-side moments worth counting (opening a door, trying the pause what-if). No data is stored.
export async function noteStoryAction(action: 'door_opened' | 'pause_tried' | 'list_view', detail: string): Promise<void> {
  const candidateId = await profileId()
  if (!candidateId) return
  captureServerEvent(candidateId, `career_story_${action}`, { detail: detail.slice(0, 60) })
}
