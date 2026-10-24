'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { previewQuickAdd, confirmQuickAdd, type QuickAddPreview } from '@/lib/conferences/quick-add'
import { clearUserStatus, addTalk, logPeopleMet, saveNotes, setTrackStatus, setUserStatus } from '@/lib/conferences/tracking'
import { firstLinkIn } from '@/lib/conferences/share'
import { resolveChange } from '@/lib/conferences/apply-change'
import { TALK_KINDS, TRACK_STATUSES, USER_STATUSES, type TalkKind, type TrackStatus, type UserStatus } from '@/lib/conferences/constants'

async function member() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return getOrCreateCandidateProfile(user.id)
}
const text = (v: FormDataEntryValue | null) => String(v ?? '').trim()

export type PreviewState = { preview: QuickAddPreview | null; error: string | null; url: string }

export async function previewConferenceAction(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const profile = await member()
  const raw = text(formData.get('link'))
  const url = firstLinkIn(raw)
  if (!url) return { preview: null, url: raw, error: 'That does not look like a link. Paste the web address of the conference page, starting with https://.' }
  const preview = await previewQuickAdd(profile.id, url)
  if (preview.status === 'invalid') return { preview: null, url: raw, error: 'We could not read that address. Check it and try again.' }
  if (preview.status === 'exists') revalidatePath('/dashboard/conferences')
  return { preview, url, error: null }
}

export async function confirmConferenceAction(formData: FormData): Promise<void> {
  const profile = await member()
  const list = (k: string) => formData.getAll(k).map(String)
  const num = (k: string) => { const n = parseInt(text(formData.get(k)).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null }
  let opportunities: unknown[] = []
  try { opportunities = JSON.parse(text(formData.get('opportunities')) || '[]') } catch { /* none */ }
  const result = await confirmQuickAdd(profile.id, {
    url: text(formData.get('url')),
    name: text(formData.get('name')), organizer: text(formData.get('organizer')),
    startDate: text(formData.get('startDate')), endDate: text(formData.get('endDate')),
    format: text(formData.get('format')), city: text(formData.get('city')), state: text(formData.get('state')), country: text(formData.get('country')),
    costLow: num('costLow'), costHigh: num('costHigh'), costNote: text(formData.get('costNote')),
    industries: list('industries'), functions: list('functions'), seniorities: list('seniorities'),
    whyAttend: text(formData.get('whyAttend')), opportunities,
  })
  if (!result) redirect('/dashboard/conferences/add?error=link')
  revalidatePath('/dashboard/conferences')
  redirect(`/dashboard/conferences/${result.seriesId}`)
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const profile = await member()
  const seriesId = text(formData.get('seriesId'))
  const status = text(formData.get('status'))
  if (status === 'NONE') await clearUserStatus(profile.id, seriesId)
  else if ((USER_STATUSES as readonly string[]).includes(status)) await setUserStatus(profile.id, seriesId, status as UserStatus)
  revalidatePath('/dashboard/conferences'); revalidatePath(`/dashboard/conferences/${seriesId}`)
}

export async function saveNotesAction(formData: FormData): Promise<void> {
  const profile = await member()
  const seriesId = text(formData.get('seriesId'))
  await saveNotes(profile.id, seriesId, text(formData.get('notes')) || null, text(formData.get('goals')) || null)
  revalidatePath(`/dashboard/conferences/${seriesId}`)
}

export async function setTrackAction(formData: FormData): Promise<void> {
  const profile = await member()
  const status = text(formData.get('status'))
  const id = text(formData.get('opportunityId'))
  if (status === 'NONE' || (TRACK_STATUSES as readonly string[]).includes(status)) await setTrackStatus(profile.id, id, status as TrackStatus | 'NONE')
  revalidatePath('/dashboard/conferences', 'layout')
}

export async function addTalkAction(formData: FormData): Promise<void> {
  const profile = await member()
  const kind = text(formData.get('kind'))
  const seriesId = text(formData.get('seriesId')) || null
  await addTalk(profile.id, {
    title: text(formData.get('title')), eventName: text(formData.get('eventName')), topic: text(formData.get('topic')), deliveredOn: text(formData.get('deliveredOn')),
    slidesUrl: text(formData.get('slidesUrl')), videoUrl: text(formData.get('videoUrl')), kind: (TALK_KINDS as readonly string[]).includes(kind) ? (kind as TalkKind) : 'TALK', seriesId,
  })
  revalidatePath('/dashboard/conferences', 'layout')
}

export async function logPeopleAction(formData: FormData): Promise<void> {
  const profile = await member()
  const seriesId = text(formData.get('seriesId'))
  // One person per line: "Name, Company, Title".
  const people = text(formData.get('people')).split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((p) => p[0])
    .map(([name, company, title]) => ({ name, company: company || null, title: title || null }))
  await logPeopleMet(profile.id, seriesId, people)
  revalidatePath(`/dashboard/conferences/${seriesId}`)
}

export async function resolveChangeAction(formData: FormData): Promise<void> {
  const profile = await member()
  const action = text(formData.get('action')) === 'APPLY' ? 'APPLY' : 'DISMISS'
  await resolveChange(text(formData.get('changeId')), action, { candidateId: profile.id })
  revalidatePath('/dashboard/conferences', 'layout')
}
