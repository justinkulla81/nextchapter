'use server'

// Development (HE-10): signals, the gratitude ask, and the Resilience Fund.

import { revalidatePath } from 'next/cache'
import type { FundAwardType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
import { sendGratitude } from '@/lib/higher-ed/gratitude'
import { awardFromFund, revokeAward, saveFund } from '@/lib/higher-ed/fund'

type Result = { error?: string; message?: string; ok?: boolean }

async function gate(slug: string): Promise<WorkspaceContext | { error: string }> {
  const ctx = await requireWorkspace(slug, 'development', { write: true })
  return ctx.tokens.has('DEVELOPMENT') || ctx.tokens.has('INSTITUTION_ADMIN') ? ctx : { error: 'Only Development or a college admin can do this.' }
}

export async function setSignal(slug: string, flagId: string, action: 'approve' | 'dismiss' | 'undo'): Promise<Result> {
  const ctx = await gate(slug)
  if ('error' in ctx) return ctx
  const data = action === 'approve' ? { approvedAt: new Date() } : action === 'dismiss' ? { dismissedAt: new Date() } : { dismissedAt: null }
  const r = await prisma.prospectFlag.updateMany({ where: { id: flagId, institutionId: ctx.institution.id }, data })
  captureServerEvent(ctx.userId, 'he_signal_updated', { institutionId: ctx.institution.id, flagId, action })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.count ? { ok: true } : { error: 'That signal is gone. Reload the page.' }
}

export async function dismissGratitude(slug: string, outcomeReportId: string): Promise<Result> {
  const ctx = await gate(slug)
  if ('error' in ctx) return ctx
  const r = await prisma.outcomeReport.updateMany({
    where: { id: outcomeReportId, gratitudeStatus: 'PENDING', member: { institutionId: ctx.institution.id } },
    data: { gratitudeStatus: 'DISMISSED' },
  })
  captureServerEvent(ctx.userId, 'he_gratitude_dismissed', { institutionId: ctx.institution.id, outcomeReportId })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.count ? { ok: true } : { error: 'Already handled. Reload the page.' }
}

export async function approveGratitude(slug: string, outcomeReportIds: string[]): Promise<Result> {
  const ctx = await gate(slug)
  if ('error' in ctx) return ctx
  const r = await sendGratitude({ institutionId: ctx.institution.id, outcomeReportIds, createdBy: ctx.email ?? ctx.userId })
  if ('error' in r && r.error) return { error: r.error }
  const { sent, skipped, demo } = r as { sent: number; skipped: number; demo: boolean }
  captureServerEvent(ctx.userId, 'he_gratitude_sent', { institutionId: ctx.institution.id, sent, skipped, demo })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: `${sent} thank-you ${sent === 1 ? 'email' : 'emails'} ${demo ? 'recorded in the demo outbox (no email sent)' : 'sent'}.${skipped ? ` ${skipped} held back (do not contact, or back in transition).` : ''}` }
}

const dollars = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

export async function saveFundSettings(slug: string, _prev: Result | undefined, formData: FormData): Promise<Result> {
  const ctx = await gate(slug)
  if ('error' in ctx) return ctx
  const name = String(formData.get('name') ?? '').trim()
  const goalCents = dollars(formData.get('goal'))
  const raisedCents = dollars(formData.get('raised'))
  if (!name) return { error: 'Give the fund a name donors will recognize.' }
  if (goalCents === null || raisedCents === null) return { error: 'Goal and raised are dollar amounts, like 50000.' }
  await saveFund(ctx.institution.id, { name, description: String(formData.get('description') ?? '').trim() || null, goalCents, raisedCents })
  captureServerEvent(ctx.userId, 'he_fund_saved', { institutionId: ctx.institution.id, goalCents, raisedCents })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}

export async function awardFund(slug: string, _prev: Result | undefined, formData: FormData): Promise<Result> {
  const ctx = await gate(slug)
  if ('error' in ctx) return ctx
  const memberId = String(formData.get('memberId') ?? '')
  const awardType = String(formData.get('awardType') ?? '') as FundAwardType
  const valueCents = dollars(formData.get('value'))
  if (!memberId) return { error: 'Pick who the award is for.' }
  if (!['COACHING_PACKAGE', 'PREMIUM_SEAT'].includes(awardType)) return { error: 'Pick what the award covers.' }
  if (!valueCents) return { error: 'Enter the award’s value in dollars.' }
  const r = await awardFromFund({ institutionId: ctx.institution.id, memberId, awardType, valueCents, awardedBy: ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_fund_awarded', { institutionId: ctx.institution.id, awardId: r.id, awardType, valueCents })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Awarded. They’ll see it as prepaid on their coaching.' }
}

export async function revokeFundAward(slug: string, awardId: string): Promise<Result> {
  const ctx = await gate(slug)
  if ('error' in ctx) return ctx
  const r = await revokeAward(ctx.institution.id, awardId)
  captureServerEvent(ctx.userId, 'he_fund_award_revoked', { institutionId: ctx.institution.id, awardId })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.count ? { message: 'Award revoked.' } : { error: 'Only an unused award can be revoked.' }
}
