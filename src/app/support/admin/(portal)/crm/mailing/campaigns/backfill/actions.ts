'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { createHeldDrafts, discardHeld, releaseHeld } from '@/lib/warn/outreach/backfill'

export type BackfillState = { message?: string; error?: string } | undefined
const PATH = '/support/admin/crm/mailing/campaigns/backfill'
const fail = (e: unknown): BackfillState => ({ error: `Something went wrong: ${e instanceof Error ? e.message : 'unknown error'}. Nothing was sent. Try again.` })

/** Drafts the next batch of layoffs. Held: nothing sends. */
export async function draftNextBatch(): Promise<BackfillState> {
  await requireAdmin()
  try {
    const r = await createHeldDrafts()
    revalidatePath(PATH)
    const skipped = Object.entries(r.skipped).map(([k, n]) => `${n} ${k}`).join(', ')
    return { message: `Looked at ${r.looked} layoffs: ${r.queued} drafted (${r.editions} emails, ${r.recipients} recipients)${skipped ? `; skipped: ${skipped}` : ''}. ${Math.max(0, r.remaining - r.looked)} still to look at. Nothing has been sent.` }
  } catch (e) { return fail(e) }
}

/** Schedules every held draft for the next Monday 9 a.m. Eastern. The owner's approval. */
export async function releaseForMonday(): Promise<BackfillState> {
  await requireAdmin()
  try {
    const r = await releaseHeld()
    revalidatePath(PATH)
    return { message: `Scheduled ${r.editions} emails to ${r.recipients} people for ${r.at.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} Eastern${r.removed ? `; took out ${r.removed} who were suppressed since the draft` : ''}.` }
  } catch (e) { return fail(e) }
}

/** Deletes the held drafts. */
export async function discardDrafts(): Promise<BackfillState> {
  await requireAdmin()
  try {
    const n = await discardHeld()
    revalidatePath(PATH)
    return { message: `Deleted ${n} held drafts. Those layoffs are pending again.` }
  } catch (e) { return fail(e) }
}
