import 'server-only'
import { prisma } from '@/lib/prisma'
import { stopGmailWatch } from '@/lib/email-tracking/gmail-push'
import { revokeGoogleTokens } from '@/lib/google/candidate-revoke'

export type GoogleDataDeletionResult = {
  emails: number
  calendarEvents: number
  scamAlerts: number
  platformEmails: number
  connections: number
  grantRevoked: boolean
  hadTokens: boolean
}

/**
 * "Delete my Google data" (Dashboard → Privacy). Everything NextChapter
 * stored from a member's Gmail and Calendar, in this order:
 *
 * 1. Stop Gmail push, then revoke the Google grant with every stored token.
 * 2. Delete the raw Google-derived records: tracked emails (subject, sender,
 *    message and thread IDs), tracked calendar events (title, time,
 *    attendee), Gmail scam alerts, platform-email log rows, and "this
 *    detection is wrong" feedback that copied an email's subject or sender.
 * 3. Delete the Gmail and Calendar connection rows (and so the tokens).
 *
 * Kept, because they are the member's own records and hold no email or event
 * IDs: applications (JobPosting), contacts on their network list, outreach
 * log entries, the platforms list (its last email subject is cleared), badges
 * and points already earned.
 */
export async function deleteGoogleDataForCandidate(candidateId: string): Promise<GoogleDataDeletionResult> {
  const [emailConns, calendarConn] = await Promise.all([
    prisma.emailConnection.findMany({ where: { candidateId } }),
    prisma.calendarConnection.findUnique({ where: { candidateId } }),
  ])

  for (const c of emailConns) if (!c.disconnectedAt) await stopGmailWatch(c)

  // Stop every sync before the revoke, so no cron run writes new rows mid-delete.
  const now = new Date()
  await Promise.all([
    prisma.emailConnection.updateMany({ where: { candidateId, disconnectedAt: null }, data: { disconnectedAt: now } }),
    prisma.calendarConnection.updateMany({ where: { candidateId, disconnectedAt: null }, data: { disconnectedAt: now } }),
  ])

  const tokens = [...emailConns.flatMap((c) => [c.refreshToken, c.accessToken]), calendarConn?.refreshToken, calendarConn?.accessToken]
  const hadTokens = tokens.some((t) => !!t)
  const grantRevoked = hadTokens ? await revokeGoogleTokens(tokens) : false

  const [emails, calendarEvents, scamAlerts, platformEmails, , , emailConnections, calendarConnections] = await prisma.$transaction([
    prisma.trackedEmailActivity.deleteMany({ where: { candidateId } }),
    prisma.trackedCalendarEvent.deleteMany({ where: { candidateId } }),
    prisma.scamAlert.deleteMany({ where: { candidateId } }),
    prisma.candidatePlatformEvent.deleteMany({ where: { candidateId } }),
    prisma.classificationFeedback.deleteMany({ where: { candidateId, recordKind: 'EMAIL_ACTIVITY' } }),
    // A removed application's feedback copied the confirmation email's sender and subject.
    prisma.classificationFeedback.updateMany({ where: { candidateId, recordKind: 'JOB_APPLICATION', fromAddress: { not: null } }, data: { fromAddress: null, subject: null } }),
    prisma.emailConnection.deleteMany({ where: { candidateId } }),
    prisma.calendarConnection.deleteMany({ where: { candidateId } }),
  ])
  await prisma.candidatePlatformActivity.updateMany({ where: { candidateId, lastSubject: { not: null } }, data: { lastSubject: null } })

  return {
    emails: emails.count,
    calendarEvents: calendarEvents.count,
    scamAlerts: scamAlerts.count,
    platformEmails: platformEmails.count,
    connections: emailConnections.count + calendarConnections.count,
    grantRevoked,
    hadTokens,
  }
}
