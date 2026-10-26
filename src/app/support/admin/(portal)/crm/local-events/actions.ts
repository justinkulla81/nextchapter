'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { placeKey } from '@/lib/workforce/places'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { classifyKind, trackOf, type LocalEventKind } from '@/lib/local-events/classify'

const KINDS: LocalEventKind[] = ['JOB_FAIR', 'HIRING_EVENT', 'CAREER_WORKSHOP', 'NETWORKING', 'RAPID_RESPONSE', 'STARTUP_WORKSHOP', 'SMALL_BUSINESS_COUNSELING', 'PITCH', 'FUNDING', 'BUSINESS_NETWORKING']
const text = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null
const refresh = () => { revalidatePath('/support/admin/crm/local-events') }

/** Hide or show one event. A hand-set row is locked: the weekly crawl no longer changes it. */
export async function setLocalEventPublished(formData: FormData) {
  await requireAdmin()
  const id = text(formData.get('id'))
  if (!id) return
  await prisma.localEvent.update({ where: { id }, data: { published: formData.get('published') === '1', locked: true } })
  refresh()
}

/** Add an event the crawler cannot see (a flyer, a phone call). Locked and published at once. */
export async function addLocalEvent(formData: FormData) {
  await requireAdmin()
  const title = text(formData.get('title'))
  const state = text(formData.get('state'))?.toUpperCase() ?? null
  const when = text(formData.get('startsAt'))
  const startsAt = when ? new Date(`${when}T12:00:00.000Z`) : null
  if (!title || !startsAt || Number.isNaN(startsAt.getTime()) || (state && !ALL_STATE_CODES.includes(state))) redirect('/support/admin/crm/local-events?error=fields')
  const picked = text(formData.get('kind')) as LocalEventKind | null
  const kind = picked && KINDS.includes(picked) ? picked : classifyKind(title)
  const city = text(formData.get('city'))
  const url = text(formData.get('url'))
  await prisma.localEvent.upsert({
    where: { dedupeKey: createHash('sha1').update(`manual|${title.toLowerCase()}|${when}`).digest('hex').slice(0, 24) },
    create: {
      dedupeKey: createHash('sha1').update(`manual|${title.toLowerCase()}|${when}`).digest('hex').slice(0, 24),
      title, kind, track: trackOf(kind), format: formData.get('online') === 'on' ? 'VIRTUAL' : 'IN_PERSON', startsAt, city, state, cityKey: city ? placeKey(city) : null,
      url: url && /^https?:\/\//i.test(url) ? url : null, proScore: 80, published: true, locked: true, sourceType: 'manual',
    },
    update: { published: true, locked: true },
  })
  refresh()
  redirect('/support/admin/crm/local-events?added=1')
}
