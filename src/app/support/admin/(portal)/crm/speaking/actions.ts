'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { isKind, isStatus, type SpeakingStatus } from '@/lib/speaking/kinds'
import { leadRef, syncSpeakingTasks } from '@/lib/speaking/sync'

const PATH = '/support/admin/crm/speaking'

/** Moves an opportunity to a stage and keeps its to-do in step (Going for it opens "Apply"; later stages close it). */
export async function setSpeakingStatus(id: string, status: SpeakingStatus): Promise<void> {
  const admin = await requireAdmin()
  if (!isStatus(status)) return
  const row = await prisma.ceoSpeakingOpportunity.update({ where: { id }, data: { status }, select: { kind: true, source: true, fit: true } })
  await syncSpeakingTasks()
  captureServerEvent(admin.email ?? 'admin', 'ceo_speaking_status_set', { id, status, kind: row.kind, source: row.source, fit: row.fit })
  revalidatePath(PATH)
  revalidatePath('/support/admin/crm/todos')
}

export async function saveSpeakingNote(id: string, formData: FormData): Promise<void> {
  await requireAdmin()
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 2000) || null
  await prisma.ceoSpeakingOpportunity.update({ where: { id }, data: { notes } })
  revalidatePath(PATH)
}

/** Adds one by hand. No model call: Justin types the name and pastes the link. */
export async function addSpeakingOpportunity(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  const kind = String(formData.get('kind') ?? '')
  const url = String(formData.get('url') ?? '').trim().slice(0, 500) || undefined
  if (!title || !isKind(kind) || (url && !/^https?:\/\//i.test(url))) return
  const d = (k: string) => {
    const v = String(formData.get(k) ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : null
  }
  const deadline = d('deadline')
  const row = await prisma.ceoSpeakingOpportunity.upsert({
    where: { sourceRef: leadRef({ url, title }) },
    update: {},
    create: {
      kind, title, url, deadline, eventDate: d('eventDate'), hostName: String(formData.get('hostName') ?? '').trim().slice(0, 200) || null,
      why: String(formData.get('why') ?? '').trim().slice(0, 600) || null, fit: 1, source: 'ADMIN', sourceRef: leadRef({ url, title }),
      // Typed by hand means he wants it: straight to the to-do list.
      status: 'PLANNING',
    },
  })
  await syncSpeakingTasks()
  captureServerEvent(admin.email ?? 'admin', 'ceo_speaking_added', { id: row.id, kind, hasDeadline: !!deadline })
  revalidatePath(PATH)
  revalidatePath('/support/admin/crm/todos')
}
