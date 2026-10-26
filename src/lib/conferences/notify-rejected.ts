import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import ConferenceRemovedEmail from '@/emails/conference-removed'

export interface RejectResult { members: number; emailed: number; failed: number }

/**
 * Reject a conference entry: record why, tell every member who was tracking it (with their own goals and notes, so
 * nothing they wrote is lost), then take it off their lists. An email that fails never blocks the rejection; the
 * count of failures comes back so the admin knows.
 */
export async function rejectEntry(seriesId: string, reason: string, adminId: string): Promise<RejectResult | null> {
  const note = reason.trim().slice(0, 400)
  if (!note) return null
  const series = await prisma.conferenceEvent.findUnique({ where: { id: seriesId }, select: { id: true, name: true, published: true } })
  if (!series || series.published) return null
  await prisma.conferenceEvent.update({ where: { id: seriesId }, data: { published: false, rejectedAt: new Date(), rejectedNote: note } })

  const ucs = await prisma.userConference.findMany({ where: { seriesId }, select: { id: true, candidateId: true, notes: true, goals: true } })
  const people = await prisma.candidateProfile.findMany({ where: { id: { in: ucs.map((u) => u.candidateId) } }, select: { id: true, userId: true, firstName: true } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const canEmail = !!process.env.RESEND_API_KEY
  const resend = canEmail ? createResend(process.env.RESEND_API_KEY!) : null
  const admin = canEmail ? createAdminClient() : null
  let emailed = 0
  let failed = 0
  for (const uc of ucs) {
    const p = people.find((x) => x.id === uc.candidateId)
    let ok = false
    if (p && resend && admin) {
      try {
        const { data } = await admin.auth.admin.getUserById(p.userId)
        const to = data.user?.email
        if (to) {
          const { error } = await resend.emails.send({
            from: 'NextChapter <support@launchyournextchapter.com>',
            replyTo: 'support@launchyournextchapter.com',
            to,
            subject: `We took ${series.name} off your conferences`,
            react: ConferenceRemovedEmail({ firstName: p.firstName, conferenceName: series.name, reason: note, goals: uc.goals, notes: uc.notes, addUrl: `${appUrl}/dashboard/conferences/add` }),
          })
          ok = !error
        }
      } catch (error) {
        console.error('Conference rejection email failed', error)
      }
    }
    if (ok) emailed++
    else failed++
  }
  // Off their lists. Their stages on its opportunities go too; their talks and contacts stay theirs.
  await prisma.conferenceOpportunityTrack.deleteMany({ where: { opportunity: { seriesId }, candidateId: { in: ucs.map((u) => u.candidateId) } } })
  await prisma.userConference.deleteMany({ where: { seriesId } })
  captureServerEvent(adminId, 'conference_entry_rejected', { seriesId, members: ucs.length, emailed, failed })
  return { members: ucs.length, emailed, failed }
}
