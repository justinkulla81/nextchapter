'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { logManualContact } from '@/lib/crm/log-contact'
import { PERSON_GROUPS } from '@/lib/outreach/person-groups'
import { QUOTA_CHANNELS } from '@/lib/outreach/quotas'
import { CALL_OUTCOMES } from '@/lib/outreach/touch-stats'

const PAGE = '/support/admin/crm/outreach'

export type ActionResult = { ok: boolean; message: string }

const CHANNELS = { call: 'CALL', linkedin: 'LINKEDIN', text: 'TEXT' } as const

/** Logs a call, LinkedIn message or text you made by hand, so it counts in the Outreach totals and quotas. */
export async function logOutreachTouch(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin()
  const personId = String(formData.get('personId') ?? '')
  const channel = String(formData.get('channel') ?? 'call') as keyof typeof CHANNELS
  const outcome = String(formData.get('outcome') ?? '')
  const date = String(formData.get('date') ?? '').trim()
  const time = String(formData.get('time') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!personId) return { ok: false, message: 'Pick the person first: type a name and choose them from the list.' }
  if (!(channel in CHANNELS)) return { ok: false, message: 'Choose Call, LinkedIn or Text.' }
  if (channel === 'call' && !(CALL_OUTCOMES as readonly string[]).includes(outcome)) return { ok: false, message: 'Choose how the call went, so response rates are right.' }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'The date looks wrong. Pick it from the calendar.' }
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, message: 'The time looks wrong. Use the time picker, for example 2:30 PM.' }

  const person = await prisma.crmPerson.findFirst({ where: { id: personId, deletedAt: null }, select: { fullName: true } })
  if (!person) return { ok: false, message: 'That person is no longer in the CRM. Search for them again.' }

  await logManualContact({ personId, channel: CHANNELS[channel], date: date || null, time: time || null, outcome: channel === 'call' ? outcome : null, note: note || null, loggedByEmail: admin.email ?? null })
  captureServerEvent(admin.email ?? 'admin', 'outreach_touch_logged', { personId, channel, outcome: channel === 'call' ? outcome : null, hasTime: Boolean(time), backdated: Boolean(date) })
  revalidatePath(PAGE)
  revalidatePath(`/support/admin/crm/people/${personId}`)
  return { ok: true, message: `Logged ${channel === 'call' ? `a call with ${person.fullName}${outcome ? `: ${outcome.toLowerCase()}` : ''}` : `a ${channel === 'text' ? 'text' : 'LinkedIn message'} to ${person.fullName}`}.` }
}

/** Sets the weekly target for one slice (a person group and a channel, either or both "all"). */
export async function saveQuota(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin()
  const groupKey = String(formData.get('groupKey') ?? '')
  const channel = String(formData.get('channel') ?? '')
  const target = Number.parseInt(String(formData.get('weeklyTarget') ?? ''), 10)
  if (groupKey !== 'ALL' && !(PERSON_GROUPS as string[]).includes(groupKey)) return { ok: false, message: 'Choose who the target is for.' }
  if (!(QUOTA_CHANNELS as string[]).includes(channel)) return { ok: false, message: 'Choose how the target is counted.' }
  if (!Number.isInteger(target) || target < 1 || target > 10_000) return { ok: false, message: 'Enter a weekly number between 1 and 10,000.' }
  try {
    await prisma.crmOutreachQuota.upsert({
      where: { groupKey_channel: { groupKey, channel } },
      create: { groupKey, channel, weeklyTarget: target, updatedByEmail: admin.email ?? null },
      update: { weeklyTarget: target, updatedByEmail: admin.email ?? null },
    })
  } catch {
    return { ok: false, message: 'Targets could not be saved right now. Try again in a minute.' }
  }
  captureServerEvent(admin.email ?? 'admin', 'outreach_quota_saved', { groupKey, channel, weeklyTarget: target })
  revalidatePath(PAGE)
  return { ok: true, message: 'Target saved.' }
}

export async function deleteQuota(groupKey: string, channel: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  try {
    await prisma.crmOutreachQuota.deleteMany({ where: { groupKey, channel } })
  } catch {
    return { ok: false, message: 'Could not remove that target. Try again in a minute.' }
  }
  captureServerEvent(admin.email ?? 'admin', 'outreach_quota_removed', { groupKey, channel })
  revalidatePath(PAGE)
  return { ok: true, message: 'Target removed.' }
}
