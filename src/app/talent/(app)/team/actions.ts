'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendEmployerSeatInviteEmail } from '@/lib/email/send-employer-seat-invite'

export type SeatInviteState = { error?: string } | undefined

// Seat management is owner-only — resolved via the direct EmployerProfile.userId
// lookup, not resolveEmployerForUserId's owner-or-seat fallback, so an
// invited member can't turn around and invite further members without the
// owner's knowledge.
async function requireOwner() {
  const supabase = await createClient('talent')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.employerProfile.findUnique({ where: { userId: user.id } })
}

export async function inviteSeat(_prevState: SeatInviteState, formData: FormData): Promise<SeatInviteState> {
  const employer = await requireOwner()
  if (!employer) return { error: 'You need to be logged in as the account owner to do this.' }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }

  const existing = await prisma.employerSeat.findUnique({
    where: { employerId_invitedEmail: { employerId: employer.id, invitedEmail: email } },
  })
  if (existing) return { error: 'This person has already been invited.' }

  const seat = await prisma.employerSeat.create({
    data: { employerId: employer.id, invitedEmail: email },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  await sendEmployerSeatInviteEmail(
    email,
    employer.companyName,
    employer.contactName,
    `${appUrl}/talent/seats/accept/${seat.inviteToken}`
  )

  captureServerEvent(employer.id, 'employer_seat_invited', { employerId: employer.id, seatId: seat.id })
  revalidatePath('/talent/team')
}

export async function revokeSeat(seatId: string) {
  const employer = await requireOwner()
  if (!employer) return

  const seat = await prisma.employerSeat.findUnique({ where: { id: seatId } })
  if (!seat || seat.employerId !== employer.id) return

  await prisma.employerSeat.delete({ where: { id: seatId } })
  captureServerEvent(employer.id, 'employer_seat_revoked', { employerId: employer.id, seatId })
  revalidatePath('/talent/team')
}
