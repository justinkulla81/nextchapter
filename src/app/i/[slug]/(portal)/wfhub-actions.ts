'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { institutionEntitlements, lockedReason } from '@/lib/plans/entitlements'
import { isCommitStatus, validateCommitment } from '@/lib/workforce/funding-partners'

export type WfResult = { ok?: boolean; message?: string; error?: string } | undefined

const MAX_PER_APPLICATION = 40
const done = (slug: string) => revalidatePath(`/i/${slug}`, 'layout')

// Add one partner to a funding application: their part, where they stand and the match they bring. Tracking partners is a paid step.
export async function addCommitment(slug: string, applicationId: string, _prev: WfResult, f: FormData): Promise<WfResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  if (!institutionEntitlements({ plan: ctx.institution.plan }).fundingPartners) return { error: lockedReason('fundingPartners') }
  const v = validateCommitment({ get: (k) => { const x = f.get(k); return typeof x === 'string' ? x : null } })
  if ('error' in v) return { error: v.error }
  const app = await prisma.fundingApplication.findFirst({ where: { id: applicationId, institutionId: ctx.institution.id }, select: { id: true } })
  if (!app) return { error: 'That application was not found.' }
  if ((await prisma.fundingPartnerCommitment.count({ where: { applicationId } })) >= MAX_PER_APPLICATION) return { error: `An application holds up to ${MAX_PER_APPLICATION} partners.` }
  let partnerKind = 'OTHER'
  if (v.value.partnerId) {
    const p = await prisma.ecosystemPartner.findFirst({ where: { id: v.value.partnerId, institutionId: ctx.institution.id }, select: { kind: true } })
    if (!p) return { error: 'That partner was not found.' }
    partnerKind = p.kind
  }
  await prisma.fundingPartnerCommitment.create({ data: { ...v.value, partnerKind, institutionId: ctx.institution.id, applicationId, createdBy: ctx.userId } })
  captureServerEvent(ctx.userId, 'funding_partner_added', { institutionId: ctx.institution.id, applicationId, role: v.value.role, status: v.value.status, hasAmount: v.value.amount !== null, fromEcosystem: !!v.value.partnerId })
  done(slug)
  return { ok: true, message: `Added ${v.value.partnerName}.` }
}

export async function setCommitmentStatus(slug: string, id: string, status: string, _prev: WfResult, _f: FormData): Promise<WfResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  if (!institutionEntitlements({ plan: ctx.institution.plan }).fundingPartners) return { error: lockedReason('fundingPartners') }
  if (!isCommitStatus(status)) return { error: 'Pick asked, committed or declined.' }
  const r = await prisma.fundingPartnerCommitment.updateMany({ where: { id, institutionId: ctx.institution.id }, data: { status } })
  if (r.count === 0) return { error: 'That partner was not found.' }
  captureServerEvent(ctx.userId, 'funding_partner_status_set', { institutionId: ctx.institution.id, commitmentId: id, status })
  done(slug)
  return { ok: true, message: 'Updated.' }
}

export async function removeCommitment(slug: string, id: string, _prev: WfResult, _f: FormData): Promise<WfResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const r = await prisma.fundingPartnerCommitment.deleteMany({ where: { id, institutionId: ctx.institution.id } })
  if (r.count === 0) return { error: 'That partner was not found.' }
  captureServerEvent(ctx.userId, 'funding_partner_removed', { institutionId: ctx.institution.id, commitmentId: id })
  done(slug)
  return { ok: true, message: 'Removed.' }
}
