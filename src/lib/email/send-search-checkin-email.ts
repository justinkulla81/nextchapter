import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import SearchCheckInEmail from '@/emails/search-checkin'

// Creates the CandidateSearchCheckIn row (and its token) up front, then
// deletes it again if the send itself fails — the no-login response link
// only exists once a real send has gone out, so a failed attempt never
// leaves a dangling row an admin report could confuse for a real send.
export async function sendSearchCheckInEmail(candidateId: string, introCopy?: string | null) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Search Check-in email.')
    return { sent: false as const }
  }

  const checkIn = await prisma.candidateSearchCheckIn.create({ data: { candidateId } })

  try {
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) {
      await prisma.candidateSearchCheckIn.delete({ where: { id: checkIn.id } })
      return { sent: false as const }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`
    const linkFor = (answer: string) => `${appUrl}/api/checkin/${checkIn.token}?answer=${answer}`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject: candidate.firstName ? `Are you still searching, ${candidate.firstName}?` : 'Are you still searching?',
      react: SearchCheckInEmail({
        firstName: candidate.firstName,
        introCopy: introCopy ?? null,
        stillSearchingUrl: linkFor('still_searching'),
        takingABreakUrl: linkFor('taking_a_break'),
        gotAnOfferUrl: linkFor('got_an_offer'),
        pixelUrl: `${appUrl}/api/checkin/${checkIn.token}/pixel`,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Search Check-in email:', error)
      await prisma.candidateSearchCheckIn.delete({ where: { id: checkIn.id } })
      return { sent: false as const }
    }

    await recordCandidateEmailSent(candidateId, 'SEARCH_CHECKIN')

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Search Check-in email:', error)
    await prisma.candidateSearchCheckIn.delete({ where: { id: checkIn.id } }).catch(() => {})
    return { sent: false as const }
  }
}
