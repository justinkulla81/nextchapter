'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { nameKey } from '@/lib/speaking/voices'

const PATH = '/support/admin/crm/speaking/voices'

/** Adds a thought leader to follow. Linked to their CRM record when the name matches exactly one person. */
export async function addVoice(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim().slice(0, 200)
  if (!name) return
  const key = nameKey(name)
  const matches = await prisma.crmPerson.findMany({ where: { deletedAt: null, fullName: { equals: name, mode: 'insensitive' } }, select: { id: true }, take: 2 })
  const row = await prisma.speakerWatch.upsert({
    where: { nameKey: key },
    update: { status: 'ACTIVE' },
    create: {
      name, nameKey: key, org: String(formData.get('org') ?? '').trim().slice(0, 200) || null,
      topics: String(formData.get('topics') ?? '').trim().slice(0, 200) || null, crmPersonId: matches.length === 1 ? matches[0].id : null, source: 'ADMIN',
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'speaker_voice_added', { id: row.id, linkedToCrm: !!row.crmPersonId })
  revalidatePath(PATH)
}

/** Accept a suggested voice (follow them), pause one, or resume one. */
export async function setVoiceStatus(id: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
  const admin = await requireAdmin()
  const row = await prisma.speakerWatch.update({ where: { id }, data: { status }, select: { source: true } })
  captureServerEvent(admin.email ?? 'admin', 'speaker_voice_status_set', { id, status, source: row.source })
  revalidatePath(PATH)
}

/** Dismiss a suggestion for good (a row is kept paused so the search does not suggest the same name again). */
export async function dismissSuggestion(id: string): Promise<void> {
  const admin = await requireAdmin()
  await prisma.speakerWatch.update({ where: { id }, data: { status: 'PAUSED' } })
  captureServerEvent(admin.email ?? 'admin', 'speaker_suggestion_dismissed', { id })
  revalidatePath(PATH)
}
