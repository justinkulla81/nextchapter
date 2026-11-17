'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { addRelatedOrg, removeRelatedOrg } from '@/lib/org-claims/related-orgs'

export type RelatedState = { ok?: boolean; message?: string; error?: string; inviteUrl?: string } | undefined

// Admin › Related organizations: link an organization that has its own public page. Free and paid alike, with no limit:
// every link is an invitation to another organization (owner decision 2026-11-17).
export async function addRelatedOrgAction(slug: string, crmOrgId: string, _prev: RelatedState): Promise<RelatedState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { crmOrganizationId: true } })
  const r = await addRelatedOrg({ institutionId: ctx.institution.id, institutionCrmOrgId: inst?.crmOrganizationId ?? null, crmOrgId, createdBy: ctx.email ?? ctx.userId })
  if (!r.ok) return { error: r.error }
  captureServerEvent(ctx.userId, 'related_org_added', { institutionId: ctx.institution.id, crmOrgId, partnerId: r.partnerId, alreadyOnNextChapter: r.alreadyOnNextChapter })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.alreadyOnNextChapter
    ? { ok: true, message: 'Linked. They already have a portal on NextChapter, so you are connected.' }
    : { ok: true, message: 'Linked. Send them the invite below: when they claim their page, you are connected.', inviteUrl: r.inviteUrl }
}

export async function removeRelatedOrgAction(slug: string, partnerId: string): Promise<{ error?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  if (!(await removeRelatedOrg(ctx.institution.id, partnerId))) return { error: 'That link was not found.' }
  captureServerEvent(ctx.userId, 'related_org_removed', { institutionId: ctx.institution.id, partnerId })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}
