'use server'

import { revalidatePath } from 'next/cache'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { markSeatPlaced, deactivateSeat } from '@/lib/employer/outplacement-roster'

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
