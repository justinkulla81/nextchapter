'use server'

// Admin › Connected organizations: ask to connect, answer a request, choose what to share, disconnect. Admins only.

import { WorkspaceAccessError } from '@/lib/higher-ed/resolve'
import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { captureServerEvent } from '@/lib/posthog/server'
import { decideConnection, endConnection, requestConnection, setShares } from '@/lib/connections/connections'
import { idFrom, partyFrom, type ConnState } from '@/lib/connections/form'
import type { Party } from '@/lib/connections/rules'

async function admin(slug: string) {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  // A whole-institution setting, not one school or department's.
  if (ctx.units?.length) throw new WorkspaceAccessError(`Whole-institution setting at ${slug}`)
  const me: Party = { kind: 'INSTITUTION', id: ctx.institution.id }
  return { ctx, me, actor: ctx.email ?? ctx.userId }
}

export async function requestConnectionAction(slug: string, _prev: ConnState, f: FormData): Promise<ConnState> {
  const { ctx, me, actor } = await admin(slug)
  const other = partyFrom(f.get('other'))
  if (!other) return { error: 'That organization was not found. Reload the page.' }
  const r = await requestConnection({ me, other, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(ctx.userId, 'portal_connection_requested', { connectionId: r.connectionId, fromKind: me.kind, fromId: me.id, toKind: other.kind, toId: other.id, emailed: r.emailed ?? 0 })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Request sent. They choose whether to accept.' }
}

export async function decideConnectionAction(slug: string, _prev: ConnState, f: FormData): Promise<ConnState> {
  const { ctx, me, actor } = await admin(slug)
  const id = idFrom(f.get('id'))
  const decision = f.get('decision') === 'accept' ? 'accept' : 'decline'
  if (!id) return { error: 'That request was not found. Reload the page.' }
  const r = await decideConnection({ me, id, decision, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(ctx.userId, 'portal_connection_answered', { connectionId: id, partyKind: me.kind, partyId: me.id, decision })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: decision === 'accept' ? 'Connected. Choose what you share below.' : 'Declined.' }
}

export async function setSharesAction(slug: string, _prev: ConnState, f: FormData): Promise<ConnState> {
  const { ctx, me, actor } = await admin(slug)
  const id = idFrom(f.get('id'))
  if (!id) return { error: 'That connection was not found. Reload the page.' }
  const shares = f.getAll('shares').map(String)
  const r = await setShares({ me, id, shares, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(ctx.userId, 'portal_connection_shares_changed', { connectionId: id, partyKind: me.kind, partyId: me.id, shares })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}

export async function endConnectionAction(slug: string, id: string): Promise<{ error?: string }> {
  const { ctx, me, actor } = await admin(slug)
  const r = await endConnection({ me, id, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(ctx.userId, 'portal_connection_ended', { connectionId: id, partyKind: me.kind, partyId: me.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}
