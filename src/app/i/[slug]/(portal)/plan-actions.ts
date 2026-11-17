'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { orgKindOf } from '@/lib/higher-ed/workspaces'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { TRIAL_DAYS, trialEndDate, trialState, type EntitlementFeature } from '@/lib/plans/entitlements'

export type TrialResult = { ok?: boolean; error?: string } | undefined

// A free organization's administrator starts its one 30-day trial of the paid plan. Nothing is billed; when it ends the workspace
// is free again with nothing deleted, and the paid plan is switched on by NextChapter staff.
export async function startTrial(slug: string, feature: EntitlementFeature, _prev: TrialResult): Promise<TrialResult> {
  const row = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true } })
  const ctx = await requireWorkspace(slug, row && orgKindOf(row.orgType) === 'workforce' ? 'hub' : 'admin', { write: true })
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { plan: true, trialStartedAt: true, trialEndsAt: true } })
  if (!inst) return { error: 'That workspace was not found.' }
  const t = trialState(inst.plan, inst.trialStartedAt, inst.trialEndsAt)
  if (t.state === 'none') return { error: 'You are already on the paid plan.' }
  if (t.state === 'active') return { ok: true }
  if (t.state === 'ended') return { error: 'Your trial has ended. Ask us to switch on the paid plan and everything opens again.' }
  const now = new Date()
  const claimed = await prisma.institution.updateMany({ where: { id: ctx.institution.id, trialStartedAt: null }, data: { trialStartedAt: now, trialEndsAt: trialEndDate(now) } })
  if (claimed.count === 0) return { ok: true }
  captureServerEvent(ctx.userId, 'plan_trial_started', { institutionId: ctx.institution.id, slug, fromFeature: feature, days: TRIAL_DAYS })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}
