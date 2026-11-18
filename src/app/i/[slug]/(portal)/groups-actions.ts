'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { institutionEntitlements } from '@/lib/plans/entitlements'
import { canStartGroup, cleanMembers, memberChanges, validateGroup, validatePost } from '@/lib/workforce/partner-groups'

export type GroupResult = { ok?: boolean; message?: string; error?: string } | undefined

const done = (slug: string) => revalidatePath(`/i/${slug}`, 'layout')
const text = (f: FormData) => ({ get: (k: string) => { const x = f.get(k); return typeof x === 'string' ? x : null } })

export async function createGroup(slug: string, _prev: GroupResult, f: FormData): Promise<GroupResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const v = validateGroup(text(f))
  if ('error' in v) return { error: v.error }
  const limit = institutionEntitlements({ plan: ctx.institution.plan }).partnerGroupLimit
  const room = canStartGroup(limit, await prisma.partnerGroup.count({ where: { institutionId: ctx.institution.id } }))
  if (!room.allowed) return { error: room.message ?? 'No room for another group.' }
  const g = await prisma.partnerGroup.create({ data: { ...v.value, institutionId: ctx.institution.id, createdBy: ctx.userId }, select: { id: true } })
  captureServerEvent(ctx.userId, 'partner_group_created', { institutionId: ctx.institution.id, groupId: g.id })
  done(slug)
  return { ok: true, message: `Started “${v.value.name}”. Add its members below.` }
}

export async function deleteGroup(slug: string, id: string): Promise<{ error?: string; message?: string }> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const r = await prisma.partnerGroup.deleteMany({ where: { id, institutionId: ctx.institution.id } })
  if (r.count === 0) return { error: 'That group was not found.' }
  captureServerEvent(ctx.userId, 'partner_group_deleted', { institutionId: ctx.institution.id, groupId: id })
  done(slug)
  return { message: 'Group deleted. Its updates are gone; its partners are untouched.' }
}

// Replace the group's members with the ticked partners.
export async function saveMembers(slug: string, groupId: string, _prev: GroupResult, f: FormData): Promise<GroupResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const group = await prisma.partnerGroup.findFirst({ where: { id: groupId, institutionId: ctx.institution.id }, select: { id: true, members: { select: { partnerId: true }, take: 100 } } })
  if (!group) return { error: 'That group was not found.' }
  const valid = new Set((await prisma.ecosystemPartner.findMany({ where: { institutionId: ctx.institution.id }, take: 300, select: { id: true } })).map((p) => p.id))
  const next = cleanMembers(f.getAll('partnerId').map(String), valid)
  const { add, remove } = memberChanges(group.members.map((m) => m.partnerId), next)
  if (remove.length) await prisma.partnerGroupMember.deleteMany({ where: { groupId, partnerId: { in: remove } } })
  if (add.length) await prisma.partnerGroupMember.createMany({ data: add.map((partnerId) => ({ groupId, partnerId })), skipDuplicates: true })
  captureServerEvent(ctx.userId, 'partner_group_members_saved', { institutionId: ctx.institution.id, groupId, added: add.length, removed: remove.length, total: next.length })
  done(slug)
  return { ok: true, message: `Saved. ${next.length} ${next.length === 1 ? 'member' : 'members'}.` }
}

export async function postUpdate(slug: string, groupId: string, _prev: GroupResult, f: FormData): Promise<GroupResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const v = validatePost(text(f))
  if ('error' in v) return { error: v.error }
  const group = await prisma.partnerGroup.findFirst({ where: { id: groupId, institutionId: ctx.institution.id }, select: { id: true } })
  if (!group) return { error: 'That group was not found.' }
  await prisma.partnerGroupPost.create({ data: { groupId, body: v.value.body, createdBy: ctx.userId, authorLabel: ctx.institution.programBrandName ?? ctx.institution.name } })
  captureServerEvent(ctx.userId, 'partner_group_update_posted', { institutionId: ctx.institution.id, groupId, length: v.value.body.length })
  done(slug)
  return { ok: true, message: 'Posted. Members see it in their Partner Hub.' }
}
