'use server'

// Hiring portal › Your network › Connected portals: the same connection actions as an organization's admin, for the employer account.

import { revalidatePath } from 'next/cache'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { decideConnection, endConnection, requestConnection, setShares } from '@/lib/connections/connections'
import { idFrom, partyFrom, type ConnState } from '@/lib/connections/form'
import type { Party } from '@/lib/connections/rules'

async function employer() {
  const e = await getTalentDashboardData()
  const me: Party = { kind: 'EMPLOYER', id: e.id }
  return { me, actor: `employer:${e.id}` }
}
const done = () => revalidatePath('/talent/network')

export async function requestEmployerConnection(_prev: ConnState, f: FormData): Promise<ConnState> {
  const { me, actor } = await employer()
  const other = partyFrom(f.get('other'))
  if (!other) return { error: 'That organization was not found. Reload the page.' }
  const r = await requestConnection({ me, other, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(me.id, 'portal_connection_requested', { connectionId: r.connectionId, fromKind: me.kind, fromId: me.id, toKind: other.kind, toId: other.id, emailed: r.emailed ?? 0 })
  done()
  return { ok: true, message: 'Request sent. They choose whether to accept.' }
}

export async function decideEmployerConnection(_prev: ConnState, f: FormData): Promise<ConnState> {
  const { me, actor } = await employer()
  const id = idFrom(f.get('id'))
  const decision = f.get('decision') === 'accept' ? 'accept' : 'decline'
  if (!id) return { error: 'That request was not found. Reload the page.' }
  const r = await decideConnection({ me, id, decision, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(me.id, 'portal_connection_answered', { connectionId: id, partyKind: me.kind, partyId: me.id, decision })
  done()
  return { ok: true, message: decision === 'accept' ? 'Connected. Choose what you share below.' : 'Declined.' }
}

export async function setEmployerShares(_prev: ConnState, f: FormData): Promise<ConnState> {
  const { me, actor } = await employer()
  const id = idFrom(f.get('id'))
  if (!id) return { error: 'That connection was not found. Reload the page.' }
  const shares = f.getAll('shares').map(String)
  const r = await setShares({ me, id, shares, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(me.id, 'portal_connection_shares_changed', { connectionId: id, partyKind: me.kind, partyId: me.id, shares })
  done()
  return { ok: true, message: 'Saved.' }
}

export async function endEmployerConnection(id: string): Promise<{ error?: string }> {
  const { me, actor } = await employer()
  const r = await endConnection({ me, id, actor })
  if (!r.ok) return { error: r.error }
  captureServerEvent(me.id, 'portal_connection_ended', { connectionId: id, partyKind: me.kind, partyId: me.id })
  done()
  return {}
}
