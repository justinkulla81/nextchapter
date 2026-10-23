'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { SEGMENTS } from '@/lib/events/taxonomy'
import { ACCESS, FORMATS, JOURNEYS, PROGRAM_FORMATS, KINDS, SENIORITIES, SPEAKING } from '@/lib/events/types'

const text = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null
const pick = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(String(v)) ? (String(v) as T) : fallback
const many = (fd: FormData, key: string, allowed: readonly string[]) => fd.getAll(key).map(String).filter((x) => allowed.includes(x))
const int = (v: FormDataEntryValue | null) => { const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null }
const date = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null }
const url = (v: FormDataEntryValue | null) => { const s = text(v); return s && /^https?:\/\//i.test(s) ? s : null }
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

/** Create or update one event from the edit form. A saved row is locked so the bundled catalog never overwrites it. */
export async function saveEvent(formData: FormData) {
  const admin = await requireAdmin()
  const name = text(formData.get('name'))
  if (!name) redirect(`/support/admin/crm/events/${text(formData.get('id')) ?? 'new'}?error=name`)
  const existingId = text(formData.get('id'))
  const id = existingId && existingId !== 'new' ? existingId : slug(name)
  const eventUrl = url(formData.get('url'))
  const published = formData.get('published') === 'on'
  // Published rows need a real link; the candidate page has nothing to send people to otherwise.
  if (published && !eventUrl) redirect(`/support/admin/crm/events/${id}?error=url`)
  const data = {
    name,
    organizer: text(formData.get('organizer')),
    url: eventUrl,
    kind: pick(formData.get('kind'), KINDS, 'CONFERENCE'),
    format: pick(formData.get('format'), FORMATS, 'IN_PERSON'),
    startDate: date(formData.get('startDate')),
    endDate: date(formData.get('endDate')),
    datesConfirmed: formData.get('datesConfirmed') === 'on',
    typicalMonth: text(formData.get('typicalMonth')),
    city: text(formData.get('city')),
    state: text(formData.get('state'))?.toUpperCase().slice(0, 2) ?? null,
    country: text(formData.get('country')) ?? 'US',
    industries: many(formData, 'industries', INDUSTRY_BUCKET_NAMES),
    functions: many(formData, 'functions', PRIMARY_FUNCTION_OPTIONS),
    journeys: many(formData, 'journeys', JOURNEYS),
    programFormats: many(formData, 'programFormats', PROGRAM_FORMATS),
    segments: many(formData, 'segments', SEGMENTS),
    roles: String(formData.get('roles') ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12),
    seniorities: many(formData, 'seniorities', SENIORITIES),
    importance: Math.min(3, Math.max(1, int(formData.get('importance')) ?? 2)),
    whyAttend: text(formData.get('whyAttend')),
    access: pick(formData.get('access'), ACCESS, 'PAID'),
    costLow: int(formData.get('costLow')),
    costHigh: int(formData.get('costHigh')),
    costNote: text(formData.get('costNote')),
    speaking: pick(formData.get('speaking'), SPEAKING, 'UNKNOWN'),
    speakingUrl: url(formData.get('speakingUrl')),
    speakingDeadline: date(formData.get('speakingDeadline')),
    speakingNote: text(formData.get('speakingNote')),
    cheaperWays: text(formData.get('cheaperWays')),
    applyUrl: url(formData.get('applyUrl')),
    applyDeadline: date(formData.get('applyDeadline')),
    published,
    verified: formData.get('verified') === 'on',
    checkedAt: formData.get('verified') === 'on' ? new Date() : null,
    adminNote: text(formData.get('adminNote')),
    locked: true,
  }
  const before = await prisma.conferenceEvent.findUnique({ where: { id }, select: { published: true } })
  await prisma.conferenceEvent.upsert({ where: { id }, create: { id, source: 'crm', ...data }, update: data })
  captureServerEvent(admin.id, 'conference_event_saved', { eventId: id, created: !before, published, wasPublished: before?.published ?? false, access: data.access, speaking: data.speaking })
  revalidatePath('/support/admin/crm/events')
  revalidatePath('/dashboard/network/events')
  redirect(`/support/admin/crm/events/${id}?saved=1`)
}

/** Publish or hide an event from the list. Publishing needs a link and locks the row. */
export async function setPublished(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const publish = formData.get('publish') === '1'
  const row = await prisma.conferenceEvent.findUnique({ where: { id }, select: { url: true } })
  if (!row || (publish && !row.url)) return
  await prisma.conferenceEvent.update({ where: { id }, data: { published: publish, locked: true } })
  captureServerEvent(admin.id, publish ? 'conference_event_published' : 'conference_event_unpublished', { eventId: id })
  revalidatePath('/support/admin/crm/events')
  revalidatePath('/dashboard/network/events')
}

export async function deleteEvent(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (formData.get('confirm') !== 'on') redirect(`/support/admin/crm/events/${id}?error=confirm`)
  await prisma.conferenceEvent.delete({ where: { id } }).catch(() => {})
  captureServerEvent(admin.id, 'conference_event_deleted', { eventId: id })
  revalidatePath('/support/admin/crm/events')
  revalidatePath('/dashboard/network/events')
  redirect('/support/admin/crm/events')
}
