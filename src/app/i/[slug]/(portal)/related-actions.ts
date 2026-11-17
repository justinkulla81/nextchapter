'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { addRelatedOrg, removeRelatedOrg } from '@/lib/org-claims/related-orgs'
import { MAX_LINK_BATCH } from '@/lib/org-claims/related-suggest-rules'
import { orgKindOf } from '@/lib/higher-ed/workspaces'

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

// Talent Hub > Your network: link every organization the person ticked in one go. Each link is an invitation to claim its own page; an
// organization already on NextChapter is connected at once. Nothing is emailed by NextChapter: the invites come back to copy or open as a draft.
export async function linkSuggestedOrgs(slug: string, _prev: RelatedState, f: FormData): Promise<RelatedState> {
  // A workforce organization links from the Talent Hub, a college from Admin: each needs the workspace its screen is in.
  const row = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true } })
  const ctx = await requireWorkspace(slug, row && orgKindOf(row.orgType) === 'workforce' ? 'hub' : 'admin', { write: true })
  const ids = [...new Set(f.getAll('orgId').map(String))].filter((x) => /^[A-Za-z0-9_-]{8,40}$/.test(x)).slice(0, MAX_LINK_BATCH)
  if (ids.length === 0) return { error: 'Pick at least one organization.' }
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { crmOrganizationId: true } })
  let linked = 0
  let already = 0
  let failed = 0
  for (const crmOrgId of ids) {
    const r = await addRelatedOrg({ institutionId: ctx.institution.id, institutionCrmOrgId: inst?.crmOrganizationId ?? null, crmOrgId, createdBy: ctx.email ?? ctx.userId })
    if (!r.ok) failed += 1
    else {
      linked += 1
      if (r.alreadyOnNextChapter) already += 1
    }
  }
  captureServerEvent(ctx.userId, 'related_suggestions_linked', { institutionId: ctx.institution.id, selected: ids.length, linked, alreadyOnNextChapter: already, failed })
  revalidatePath(`/i/${slug}`, 'layout')
  if (linked === 0) return { error: 'None of those could be linked. They may no longer have a public page.' }
  const rest = [already ? `${already} already ${already === 1 ? 'has' : 'have'} a portal, so you are connected.` : null, failed ? `${failed} could not be linked.` : null].filter(Boolean).join(' ')
  return { ok: true, message: `Linked ${linked}. Send each one its invite below: when they claim their page, you are connected. ${rest}`.trim() }
}
