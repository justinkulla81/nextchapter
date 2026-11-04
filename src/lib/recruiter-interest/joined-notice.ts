import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { getFirmBriefs } from '@/lib/seo/search-firm-pages'
import FirmJoinedEmail from '@/emails/firm-joined'
import { groupPicksByMember, joinedSubject, type JoinedPick } from '@/lib/recruiter-interest/joined-format'

// A member picked a search firm that had not joined (RecruiterInterest HELD). When the firm joins (its RecruiterFirm is
// VERIFIED), tell the member once. The email sends nothing to the firm: it points to the recruiter package page, where the
// member chooses to send their résumé. A pick made after the firm had already joined gets no email (the member saw it was
// joined). Each pick is stamped before sending, so a retry or a second run never repeats an email.

const MAX_ROWS = 2000
const DEADLINE_MS = 240_000
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'

/** Held picks whose firm joined after the member picked it, with no email yet. */
export async function findJoinedPicks(): Promise<JoinedPick[]> {
  return prisma.$queryRaw<JoinedPick[]>`
    SELECT i.id, i."candidateId", i."crmOrgId" AS "firmOrgId"
    FROM "RecruiterInterest" i
    JOIN "CrmOrganization" o ON o.id = i."crmOrgId"
    JOIN "RecruiterFirm" f ON f.id = o."recruiterFirmId"
    WHERE i.status = 'HELD' AND i."joinedNoticeAt" IS NULL
      AND f.status = 'VERIFIED' AND f."verifiedAt" IS NOT NULL AND i."createdAt" < f."verifiedAt"
    ORDER BY f."verifiedAt" ASC
    LIMIT ${MAX_ROWS}`
}

export async function runFirmJoinedNotices(): Promise<Record<string, number>> {
  const startedAt = Date.now()
  const picks = await findJoinedPicks()
  if (picks.length === 0) return { picks: 0, members: 0, emailsSent: 0 }

  const profiles = await prisma.candidateProfile.findMany({
    where: { id: { in: [...new Set(picks.map((p) => p.candidateId))] }, isSampleData: false },
    select: { id: true, userId: true, firstName: true, confidentialSearchMode: true, registrationCompletedAt: true, deactivatedAt: true, notificationTier: true },
  })
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const briefs = await getFirmBriefs([...new Set(picks.map((p) => p.firmOrgId))])
  let sent = 0
  let members = 0

  for (const [candidateId, mine] of groupPicksByMember(picks)) {
    const p = byId.get(candidateId)
    if (!p || !p.registrationCompletedAt || p.deactivatedAt || p.notificationTier === 'MINIMAL') continue
    if (Date.now() - startedAt > DEADLINE_MS) break
    members++
    // Stamp first: a failure after this point loses one email, never repeats one.
    await prisma.recruiterInterest.updateMany({ where: { id: { in: mine.map((m) => m.id) }, joinedNoticeAt: null }, data: { joinedNoticeAt: new Date() } })
    try {
      if (!process.env.RESEND_API_KEY) continue
      const { data } = await createAdminClient().auth.admin.getUserById(p.userId)
      const to = data.user?.email
      if (!to) continue
      const firms = mine.map((m) => briefs.get(m.firmOrgId)?.name).filter((n): n is string => !!n)
      if (firms.length === 0) continue
      const subject = joinedSubject(firms, p.confidentialSearchMode)
      const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
        from: FROM,
        replyTo: 'support@launchyournextchapter.com',
        to,
        subject,
        react: FirmJoinedEmail({ firstName: p.firstName, firms, packageUrl: `${APP_URL}/dashboard/recruiter-package?src=firm_joined` }),
      })
      if (error) { console.error('Firm-joined email failed for', candidateId, error); continue }
      sent++
      captureServerEvent(candidateId, 'firm_joined_email_sent', { firmOrgIds: mine.map((m) => m.firmOrgId), count: firms.length })
    } catch (error) {
      console.error('Firm-joined email failed for', candidateId, error)
    }
  }
  return { picks: picks.length, members, emailsSent: sent }
}
