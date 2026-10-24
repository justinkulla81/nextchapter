'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { mergeSeries } from '@/lib/conferences/merge'
import { resolveChange } from '@/lib/conferences/apply-change'

const text = (v: FormDataEntryValue | null) => String(v ?? '').trim()
const refresh = () => { revalidatePath('/support/admin/crm/events/review'); revalidatePath('/dashboard/conferences', 'layout') }

/** Approve a Quick Add entry: it becomes visible to every member, along with the opportunities that came with it. */
export async function approveEntry(formData: FormData) {
  const admin = await requireAdmin()
  const id = text(formData.get('id'))
  const row = await prisma.conferenceEvent.findUnique({ where: { id }, select: { url: true } })
  if (!row?.url) return
  await prisma.conferenceEvent.update({ where: { id }, data: { published: true, verified: true, checkedAt: new Date(), locked: true } })
  await prisma.conferenceOpportunity.updateMany({ where: { seriesId: id, source: 'QUICK_ADD' }, data: { published: true } })
  captureServerEvent(admin.id, 'conference_entry_approved', { seriesId: id })
  refresh()
}

export async function mergeEntry(formData: FormData) {
  const admin = await requireAdmin()
  const sourceId = text(formData.get('sourceId'))
  const targetId = text(formData.get('targetId'))
  if (formData.get('confirm') !== 'on' || !targetId) redirect('/support/admin/crm/events/review?error=merge')
  const ok = await mergeSeries(sourceId, targetId)
  captureServerEvent(admin.id, 'conference_entries_merged', { sourceId, targetId, ok })
  refresh()
  redirect(`/support/admin/crm/events/review?merged=${ok ? 1 : 0}`)
}

export async function resolveChangeAdmin(formData: FormData) {
  const admin = await requireAdmin()
  const action = text(formData.get('action')) === 'APPLY' ? 'APPLY' : 'DISMISS'
  await resolveChange(text(formData.get('changeId')), action, { admin: true })
  captureServerEvent(admin.id, 'conference_change_reviewed', { action })
  refresh()
}
