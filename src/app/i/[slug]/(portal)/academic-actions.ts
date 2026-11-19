'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { collegeRecord } from '@/lib/higher-ed/peers'
import { readProfile } from '@/lib/higher-ed/profile'
import { recordInstitutionAudit } from '@/lib/higher-ed/partner-audit'
import { MAX_CHOSEN_PEERS, peersOf } from '@/lib/higher-ed/programs-market'
import { loadIndex } from '@/lib/higher-ed/programs-market-data'

// Academic Affairs › Peers: the college's own peer group (Institution.profile.peerUnitids). The first change starts from the
// suggested peers, so removing one keeps the rest; resetting clears the list and the suggested peers return.

type Result = { error?: string; message?: string }

async function context(slug: string) {
  const ctx = await requireWorkspace(slug, 'academic', { write: true })
  if (ctx.readOnly) return { error: 'This seat is read-only.' } as const
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { name: true, profile: true } })
  const record = await collegeRecord(inst)
  if (!record) return { error: 'This workspace is not linked to a college yet.' } as const
  const index = await loadIndex()
  const profile = readProfile(inst.profile)
  const current = peersOf(record.unitid, index, profile.peerUnitids ?? []).ids
  return { ctx, profile, unitid: record.unitid, index, current } as const
}

async function save(slug: string, institutionId: string, profile: ReturnType<typeof readProfile>, peerUnitids: string[]) {
  const next = { ...profile, peerUnitids } as unknown as Prisma.InputJsonObject
  await prisma.institution.update({ where: { id: institutionId }, data: { profile: next } })
  revalidatePath(`/i/${slug}`, 'layout')
}

export async function addPeer(slug: string, _prev: Result | undefined, formData: FormData): Promise<Result> {
  const c = await context(slug)
  if ('error' in c) return { error: c.error }
  const name = String(formData.get('college') ?? '').trim().toLowerCase()
  if (!name) return { error: 'Type a college name and pick it from the list.' }
  const hit = Object.entries(c.index).find(([, r]) => r[0].toLowerCase() === name)
  if (!hit) return { error: 'No college by that exact name awards four-year degrees. Pick a name from the list as you type.' }
  const [id, row] = hit
  if (id === c.unitid) return { error: 'That is your own college.' }
  if (c.current.includes(id)) return { message: `${row[0]} is already in your peer group.` }
  if (c.current.length >= MAX_CHOSEN_PEERS) return { error: `Your peer group holds up to ${MAX_CHOSEN_PEERS} colleges. Remove one to add another.` }
  await save(slug, c.ctx.institution.id, c.profile, [...c.current, id])
  captureServerEvent(c.ctx.userId, 'academic_peer_added', { institutionId: c.ctx.institution.id, peerUnitid: id, size: c.current.length + 1 })
  await recordInstitutionAudit(c.ctx, 'peers.changed', { type: 'peer', id, detail: { change: 'added' } })
  return { message: `Added ${row[0]}.` }
}

export async function removePeer(slug: string, peerUnitid: string): Promise<Result> {
  const c = await context(slug)
  if ('error' in c) return { error: c.error }
  if (!c.current.includes(peerUnitid)) return { message: 'That college is not in your peer group.' }
  const next = c.current.filter((id) => id !== peerUnitid)
  if (next.length === 0) return { error: 'Keep at least one college, or reset to the suggested peers.' }
  await save(slug, c.ctx.institution.id, c.profile, next)
  captureServerEvent(c.ctx.userId, 'academic_peer_removed', { institutionId: c.ctx.institution.id, peerUnitid, size: next.length })
  await recordInstitutionAudit(c.ctx, 'peers.changed', { type: 'peer', id: peerUnitid, detail: { change: 'removed' } })
  return { message: `Removed ${c.index[peerUnitid]?.[0] ?? 'the college'}.` }
}

export async function resetPeers(slug: string): Promise<Result> {
  const c = await context(slug)
  if ('error' in c) return { error: c.error }
  await save(slug, c.ctx.institution.id, c.profile, [])
  captureServerEvent(c.ctx.userId, 'academic_peers_reset', { institutionId: c.ctx.institution.id })
  await recordInstitutionAudit(c.ctx, 'peers.changed', { type: 'peer', detail: { change: 'reset' } })
  return { message: 'Back to the suggested peers.' }
}
