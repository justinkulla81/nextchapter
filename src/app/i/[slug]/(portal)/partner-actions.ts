'use server'

// A person at a confirmed ecosystem partner: update what their partner offers. The partner comes from the signed-in person's own
// access (ctx.partnerIds), never from the form, so no one can change another partner's page.

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeCommitments } from '@/lib/workforce/ecosystem'

export type PartnerResult = { error?: string; ok?: boolean; message?: string } | undefined

export async function updateMyCommitments(slug: string, _prev: PartnerResult, f: FormData): Promise<PartnerResult> {
  const ctx = await requireWorkspace(slug, 'partnerview', { write: true })
  const partnerId = ctx.partnerIds?.[0]
  if (!partnerId) return { error: 'We could not find your partner page. Ask the person who gave you access.' }
  const commitments = normalizeCommitments(f.getAll('commitments').map(String))
  const r = await prisma.ecosystemPartner.updateMany({ where: { id: partnerId, institutionId: ctx.institution.id, status: 'CONFIRMED' }, data: { commitments } })
  if (r.count === 0) return { error: 'Your partner page is no longer confirmed, so it cannot be changed.' }
  captureServerEvent(ctx.userId, 'partner_commitments_updated', { institutionId: ctx.institution.id, partnerId, commitments, count: commitments.length })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved. Your changes show on the organization’s Ecosystem screen.' }
}
