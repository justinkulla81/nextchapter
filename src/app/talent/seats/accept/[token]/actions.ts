'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

async function linkAcceptedSeat(seatToken: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be logged in to accept this invite.' }

  const seat = await prisma.employerSeat.findUnique({ where: { inviteToken: seatToken } })
  if (!seat) return { error: 'This invite link is not valid.' }
  if (seat.acceptedAt) return { error: 'This invite has already been accepted.' }
  if (user.email.toLowerCase() !== seat.invitedEmail.toLowerCase()) {
    return { error: `This invite was sent to ${seat.invitedEmail}. Log in with that email to accept it.` }
  }

  await prisma.employerSeat.update({
    where: { id: seat.id },
    data: { userId: user.id, acceptedAt: new Date() },
  })
  captureServerEvent(user.id, 'employer_seat_accepted', { employerId: seat.employerId, seatId: seat.id })
  return {}
}

// Non-redirecting variant for CallbackHandler, which controls its own
// status/redirect flow (matching completeEmployerSignupFromSession and its
// siblings — see CallbackHandler.tsx).
export async function finishAcceptingEmployerSeat(seatToken: string): Promise<{ error?: string }> {
  return linkAcceptedSeat(seatToken)
}

export type AcceptSeatState = { error?: string } | undefined

// Form-action variant for the accept page's explicit "Accept invite" button
// (the already-logged-in-with-matching-email path) — redirects itself since
// it's invoked as a plain <form action>.
export async function acceptSeatInviteAction(
  seatToken: string,
  _prevState: AcceptSeatState,
  _formData: FormData
): Promise<AcceptSeatState> {
  const result = await linkAcceptedSeat(seatToken)
  if (result.error) return result
  redirect('/talent')
}
