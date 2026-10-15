'use server'

import { revalidatePath } from 'next/cache'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { orgProgram } from '@/lib/employer/program-server'
import { markSeatPlaced, deactivateSeat, setSeatAccess, setSeatSessions, setSeatAccessEnd, updateCohort } from '@/lib/employer/outplacement-roster'

// Void return, matching the plain "row action button" convention used
// elsewhere for a bare <form action={fn.bind(null, id)}> (e.g.
// cancelWebinarAction) — a form action bound and used directly (not via
// useActionState) must return void|Promise<void>, so any error here is
// logged rather than surfaced inline. If richer inline error UI is needed
// later, switch the calling form to useActionState instead.
export async function markSeatPlacedAction(seatId: string): Promise<void> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return
  const result = await markSeatPlaced(orgUser, seatId)
  if (result.error) {
    console.error('markSeatPlacedAction error:', result.error)
    return
  }
  revalidatePath('/employer/roster')
}

export async function deactivateSeatAction(seatId: string): Promise<void> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return
  const result = await deactivateSeat(orgUser, seatId)
  if (result.error) {
    console.error('deactivateSeatAction error:', result.error)
    return
  }
  revalidatePath('/employer/roster')
}

type Res = { error?: string; ok?: boolean }

export async function setSeatAccessAction(seatId: string, feature: 'coaching' | 'recruiters', on: boolean): Promise<Res> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change access.' }
  const r = await setSeatAccess(orgUser, seatId, feature, on)
  revalidatePath('/employer/roster')
  return r.error ? r : { ok: true }
}

export async function setSeatSessionsAction(seatId: string, sessions: number): Promise<Res> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change access.' }
  const r = await setSeatSessions(orgUser, seatId, sessions)
  revalidatePath('/employer/roster')
  return r.error ? r : { ok: true }
}

export async function setSeatAccessEndAction(seatId: string, date: string): Promise<Res> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change access.' }
  const d = date ? new Date(`${date}T23:59:59Z`) : null
  if (d && Number.isNaN(d.getTime())) return { error: 'Pick a date.' }
  const r = await setSeatAccessEnd(orgUser, seatId, d)
  revalidatePath('/employer/roster')
  return r.error ? r : { ok: true }
}

export async function updateCohortAction(cohort: string, change: { packageKey?: string; accessEnds?: string; rename?: string }): Promise<Res & { count?: number }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change cohorts.' }
  const c: { packageKey?: string | null; accessEndsAt?: Date | null; rename?: string | null } = {}
  if (change.packageKey !== undefined) {
    const { settings } = await orgProgram(orgUser.orgId)
    if (change.packageKey !== 'all' && !settings.packages.some((p) => p.key === change.packageKey)) return { error: 'That package no longer exists.' }
    c.packageKey = change.packageKey === 'all' ? null : change.packageKey
  }
  if (change.accessEnds !== undefined) {
    const d = change.accessEnds ? new Date(`${change.accessEnds}T23:59:59Z`) : null
    if (d && Number.isNaN(d.getTime())) return { error: 'Pick a date.' }
    c.accessEndsAt = d
  }
  if (change.rename !== undefined) c.rename = change.rename
  const r = await updateCohort(orgUser, cohort, c)
  revalidatePath('/employer/roster')
  return r.error ? { error: r.error } : { ok: true, count: r.count }
}
