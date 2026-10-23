'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  clampExcitement,
  externalJobId,
  isChecklistKey,
  parseChecklist,
  parseFollowUpDate,
  MAX_CONTACTS_PER_JOB,
  MAX_JOB_TEXT,
  MAX_NOTES,
  type Checklist,
} from '@/lib/jobs/tracker'
import { classifyWorkType } from '@/lib/jobs/work-type'

// My jobs tracker fields (src/lib/jobs/tracker.ts): notes, excitement, follow-up date, checklist and
// contacts per job, and saving a job found on another site. Everything here is the member's own private
// annotation: no model call, nothing shared.

type Result = { ok: true } | { ok: false; error: string }
const NOT_SIGNED_IN: Result = { ok: false, error: 'Your session ended. Sign in again, then try once more.' }
const ITEM_KEY = /^(job_board|surfaced|matched_role|external|application|posting):[A-Za-z0-9_-]{1,64}$/

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export interface TrackerRowRef {
  itemKey: string
  title: string
  companyName: string | null
}

export type TrackerPatch =
  | { kind: 'notes'; notes: string }
  | { kind: 'excitement'; excitement: number | null }
  | { kind: 'follow_up'; date: string }
  | { kind: 'follow_up_sent' }
  | { kind: 'checklist'; key: string; checked: boolean }

function cleanRow(row: TrackerRowRef): TrackerRowRef | null {
  if (!row || typeof row.itemKey !== 'string' || !ITEM_KEY.test(row.itemKey) || !row.title?.trim()) return null
  return { itemKey: row.itemKey, title: row.title.trim().slice(0, 300), companyName: row.companyName?.trim().slice(0, 200) || null }
}

async function upsertNote(candidateId: string, row: TrackerRowRef, data: Partial<Pick<Prisma.JobTrackerNoteUncheckedCreateInput, 'notes' | 'excitement' | 'followUpAt' | 'followUpDoneAt' | 'contactIds' | 'jobText'>> & { checklist?: Checklist }) {
  return prisma.jobTrackerNote.upsert({
    where: { candidateId_itemKey: { candidateId, itemKey: row.itemKey } },
    create: { candidateId, itemKey: row.itemKey, title: row.title, companyName: row.companyName, ...data },
    update: { title: row.title, companyName: row.companyName, ...data },
  })
}

/** One change to a job's tracker fields. */
export async function updateTrackerNote(rawRow: TrackerRowRef, patch: TrackerPatch): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const row = cleanRow(rawRow)
  if (!row) return { ok: false, error: 'We could not find that job. Refresh the page and try again.' }
  const props = { jobKey: row.itemKey, source: row.itemKey.split(':')[0] }

  switch (patch.kind) {
    case 'notes': {
      const notes = String(patch.notes ?? '').slice(0, MAX_NOTES).trim() || null
      await upsertNote(profile.id, row, { notes })
      captureServerEvent(profile.id, 'job_tracker_notes_saved', { ...props, length: notes?.length ?? 0 })
      break
    }
    case 'excitement': {
      const excitement = clampExcitement(patch.excitement)
      await upsertNote(profile.id, row, { excitement })
      captureServerEvent(profile.id, 'job_excitement_set', { ...props, excitement })
      break
    }
    case 'follow_up': {
      const followUpAt = patch.date === '' ? null : parseFollowUpDate(patch.date)
      if (patch.date !== '' && !followUpAt) return { ok: false, error: 'Pick a date for the follow-up.' }
      await upsertNote(profile.id, row, { followUpAt, followUpDoneAt: null })
      captureServerEvent(profile.id, followUpAt ? 'job_follow_up_set' : 'job_follow_up_cleared', { ...props, followUpAt: followUpAt?.toISOString() ?? null })
      break
    }
    case 'follow_up_sent':
    case 'checklist': {
      const key = patch.kind === 'follow_up_sent' ? 'follow_up_sent' : patch.key
      const checked = patch.kind === 'follow_up_sent' ? true : !!patch.checked
      if (!isChecklistKey(key) || key === 'applied') return { ok: false, error: 'That step ticks itself when you mark the job applied.' }
      const existing = await prisma.jobTrackerNote.findUnique({ where: { candidateId_itemKey: { candidateId: profile.id, itemKey: row.itemKey } }, select: { checklist: true } })
      const checklist: Checklist = parseChecklist(existing?.checklist)
      if (checked) checklist[key] = new Date().toISOString()
      else delete checklist[key]
      const followUp = key === 'follow_up_sent' ? { followUpDoneAt: checked ? new Date() : null } : {}
      await upsertNote(profile.id, row, { checklist, ...followUp })
      captureServerEvent(profile.id, patch.kind === 'follow_up_sent' ? 'job_follow_up_marked_sent' : 'job_checklist_item_toggled', { ...props, item: key, checked })
      break
    }
    default:
      return { ok: false, error: 'We could not save that. Refresh the page and try again.' }
  }
  revalidatePath('/dashboard/find-my-job')
  return { ok: true }
}

export interface ContactOption {
  id: string
  name: string
  company: string | null
}

/** The member's contacts whose name or company matches, for the "who can help" picker. */
export async function searchTrackerContacts(q: string): Promise<ContactOption[]> {
  const profile = await getProfile()
  if (!profile) return []
  const term = String(q ?? '').trim().slice(0, 80)
  if (term.length < 2) return []
  return prisma.supportNetworkContact.findMany({
    where: { candidateId: profile.id, OR: [{ name: { contains: term, mode: 'insensitive' } }, { company: { contains: term, mode: 'insensitive' } }] },
    select: { id: true, name: true, company: true },
    orderBy: { name: 'asc' },
    take: 8,
  })
}

/** Link or unlink a contact who can help with this job. */
export async function setTrackerContact(rawRow: TrackerRowRef, contactId: string, linked: boolean): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const row = cleanRow(rawRow)
  if (!row) return { ok: false, error: 'We could not find that job. Refresh the page and try again.' }
  const contact = await prisma.supportNetworkContact.findFirst({ where: { id: contactId, candidateId: profile.id }, select: { id: true } })
  if (!contact) return { ok: false, error: 'We could not find that contact. Refresh the page and try again.' }
  const existing = await prisma.jobTrackerNote.findUnique({ where: { candidateId_itemKey: { candidateId: profile.id, itemKey: row.itemKey } }, select: { contactIds: true } })
  const ids = new Set(existing?.contactIds ?? [])
  if (linked) {
    if (!ids.has(contact.id) && ids.size >= MAX_CONTACTS_PER_JOB) return { ok: false, error: `Up to ${MAX_CONTACTS_PER_JOB} contacts per job. Remove one to add another.` }
    ids.add(contact.id)
  } else ids.delete(contact.id)
  await upsertNote(profile.id, row, { contactIds: [...ids] })
  captureServerEvent(profile.id, linked ? 'job_contact_linked' : 'job_contact_unlinked', { jobKey: row.itemKey, contactId: contact.id, contacts: ids.size })
  revalidatePath('/dashboard/find-my-job')
  return { ok: true }
}

export type SaveExternalState = { ok?: boolean; error?: string } | undefined

/**
 * Save a job found on another site to My jobs, without a fit check: its address, title and company,
 * and optionally the posting text so the keyword match can read it. No fetch, no model call.
 */
export async function saveExternalJob(_prev: SaveExternalState, formData: FormData): Promise<SaveExternalState> {
  const profile = await getProfile()
  if (!profile) return { error: 'Your session ended. Sign in again, then try once more.' }
  const rawUrl = String(formData.get('url') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim().slice(0, 300)
  const companyName = String(formData.get('company') ?? '').trim().slice(0, 200) || null
  const text = String(formData.get('text') ?? '').trim().slice(0, MAX_JOB_TEXT) || null
  let url: string
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('scheme')
    url = u.toString().slice(0, 2000)
  } catch {
    return { error: 'Paste the full address of the job, starting with https://' }
  }
  if (!title) return { error: 'Add the job title, so you can find it in My jobs.' }

  const sourceId = externalJobId(url)
  const tracked = await prisma.trackedJob.upsert({
    where: { candidateId_source_sourceId: { candidateId: profile.id, source: 'external', sourceId } },
    create: { candidateId: profile.id, source: 'external', sourceId, title, companyName, url, workType: classifyWorkType({ title, description: text }), savedAt: new Date() },
    update: { title, companyName, savedAt: new Date(), dismissedAt: null },
  })
  if (text) {
    await prisma.jobTrackerNote.upsert({
      where: { candidateId_itemKey: { candidateId: profile.id, itemKey: `external:${sourceId}` } },
      create: { candidateId: profile.id, itemKey: `external:${sourceId}`, title, companyName, jobText: text },
      update: { title, companyName, jobText: text },
    })
  }
  let host: string | null = null
  try {
    host = new URL(url).hostname
  } catch {}
  captureServerEvent(profile.id, 'job_saved_external', { trackedJobId: tracked.id, host, withText: !!text })
  revalidatePath('/dashboard/find-my-job')
  return { ok: true }
}
