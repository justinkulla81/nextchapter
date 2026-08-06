import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import { sendBackchannelMatchEmail } from '@/lib/email/send-backchannel-match'

// Fires daily — for each candidate, finds the first still-unnotified applied
// job whose company matches someone already in their network, sends one
// email, and marks that job's backchannelEmailSentAt so it's never resent.
// Deliberately at most one email per candidate per run (not one per
// matching job) — this is an occasional nudge, not a digest.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, weeklyReportOptedOut: false },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      jobPostings: {
        where: { appliedAt: { not: null }, companyName: { not: null }, backchannelEmailSentAt: null },
        select: { id: true, companyName: true },
      },
    },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (candidate.jobPostings.length === 0) continue

      const contacts = await prisma.supportNetworkContact.findMany({
        where: { candidateId: candidate.id, OR: [{ company: { not: null } }, { inferredCompany: { not: null } }] },
        select: { name: true, company: true, inferredCompany: true },
      })
      if (contacts.length === 0) continue

      for (const job of candidate.jobPostings) {
        if (!job.companyName) continue
        const matchedContacts = contacts.filter(
          (c) =>
            (c.company && orgNamesMatch(c.company, job.companyName!)) ||
            (c.inferredCompany && orgNamesMatch(c.inferredCompany, job.companyName!))
        )
        if (matchedContacts.length === 0) continue

        const result = await sendBackchannelMatchEmail(
          candidate,
          job.companyName,
          matchedContacts.map((c) => c.name)
        )
        await prisma.jobPosting.update({ where: { id: job.id }, data: { backchannelEmailSentAt: new Date() } })
        if (result.sent) sentCount += 1
        break
      }
    } catch (error) {
      console.error('Backchannel match nudge failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
