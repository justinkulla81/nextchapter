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

  // Selects every applied job with a company name (not just still-unnotified
  // ones) so the email can tell the candidate how many OTHER companies
  // they've applied to also have a network connection, beyond the one this
  // particular send calls out — backchannelEmailSentAt is filtered in code
  // below to find which one to actually notify about.
  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, weeklyReportOptedOut: false },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      jobPostings: {
        where: { appliedAt: { not: null }, companyName: { not: null } },
        select: { id: true, companyName: true, backchannelEmailSentAt: true },
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

      // Every distinct applied company with at least one matched contact —
      // this candidate's full backchannel picture, independent of whether
      // they've already been emailed about a given one. Used to tell them
      // how many OTHER companies they have this same leverage at.
      const matchedCompanyNames = new Set(
        candidate.jobPostings
          .filter((job) =>
            contacts.some(
              (c) =>
                (c.company && orgNamesMatch(c.company, job.companyName!)) ||
                (c.inferredCompany && orgNamesMatch(c.inferredCompany, job.companyName!))
            )
          )
          .map((job) => job.companyName!.toLowerCase().trim())
      )

      for (const job of candidate.jobPostings) {
        if (!job.companyName || job.backchannelEmailSentAt) continue
        const matchedContacts = contacts.filter(
          (c) =>
            (c.company && orgNamesMatch(c.company, job.companyName!)) ||
            (c.inferredCompany && orgNamesMatch(c.inferredCompany, job.companyName!))
        )
        if (matchedContacts.length === 0) continue

        const otherCompanyCount = Math.max(0, matchedCompanyNames.size - 1)
        const result = await sendBackchannelMatchEmail(
          candidate,
          job.companyName,
          matchedContacts.map((c) => c.name),
          otherCompanyCount
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
