import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { orgNamesMatchStrict } from '@/lib/text/org-name-match'
import { sendBackchannelMatchEmail } from '@/lib/email/send-backchannel-match'
import { rankBackchannelContacts } from '@/lib/email/backchannel-note'
import { withCronRun } from '@/lib/cron/run'
import { isCircularEmailMatch } from '@/lib/network/backchannel-circular'

// Fires daily — for each candidate, finds the first still-unnotified applied
// job whose company matches someone already in their network, sends one
// email, and marks that job's backchannelEmailSentAt so it's never resent.
// Deliberately at most one email per candidate per run (not one per
// matching job) — this is an occasional nudge, not a digest.
//
// Uses orgNamesMatchStrict, not the looser orgNamesMatch — this feature
// tells a real person "you know someone here, reach out to them," so a
// false positive is actively harmful, not just a display quirk. Confirmed
// against real production data: orgNamesMatch's substring-containment
// fallback (fine for its original use — resume-derived company dedup)
// matched "Cohere" to a contact's "Coherent Corp.", "InvestX" to "VEST",
// and "Archimed" to "Chime" — completely unrelated companies that happen
// to share a substring. Strict equality misses some real abbreviations
// ("Hyland" for "Hyland Software") but that's a missed nudge, not a false
// claim mailed to the candidate.
//
// Optional query params, for testing against one real account without
// emailing everyone (the route is still behind the CRON_SECRET bearer check):
//   candidateId=<id>  only that candidate
//   dryRun=1          report what would be sent; send nothing, mark nothing
//   force=1           with candidateId only: ignore "already notified" so an
//                     application that already got the email can be re-sent
export const GET = withCronRun('backchannel-match', async (request) => {
  const params = request.nextUrl.searchParams
  const candidateId = params.get('candidateId')
  const dryRun = params.get('dryRun') === '1'
  const force = params.get('force') === '1'
  if (force && !candidateId) {
    return NextResponse.json({ error: 'force requires candidateId' }, { status: 400 })
  }

  // Selects every applied job with a company name (not just still-unnotified
  // ones) so the email can tell the candidate how many OTHER companies
  // they've applied to also have a network connection, beyond the one this
  // particular send calls out — backchannelEmailSentAt is filtered in code
  // below to find which one to actually notify about.
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      weeklyReportOptedOut: false,
      ...(candidateId ? { id: candidateId } : {}),
    },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      jobPostings: {
        where: { appliedAt: { not: null }, companyName: { not: null } },
        select: { id: true, source: true, title: true, companyName: true, appliedAt: true, backchannelEmailSentAt: true },
      },
    },
  })

  let sentCount = 0
  const wouldSend: { candidateId: string; jobId: string; companyName: string; contactCount: number }[] = []
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (candidate.jobPostings.length === 0) continue

      const contacts = await prisma.supportNetworkContact.findMany({
        where: { candidateId: candidate.id, OR: [{ company: { not: null } }, { inferredCompany: { not: null } }] },
        select: {
          id: true,
          name: true,
          title: true,
          email: true,
          warmth: true,
          employmentStatusAtCompany: true,
          relationshipTags: true,
          company: true,
          inferredCompany: true,
          source: true,
        },
      })
      if (contacts.length === 0) continue

      // Every distinct applied company with at least one matched contact —
      // this candidate's full backchannel picture, independent of whether
      // they've already been emailed about a given one. Used to tell them
      // how many OTHER companies they have this same leverage at.
      const contactsAt = (job: (typeof candidate.jobPostings)[number]) =>
        contacts.filter((c) => {
          if (c.company && orgNamesMatchStrict(c.company, job.companyName!)) return true
          if (!c.inferredCompany || !orgNamesMatchStrict(c.inferredCompany, job.companyName!)) return false
          // Skip a pair that matches only because both are guesses from the
          // same email domain (see backchannel-circular.ts).
          return !isCircularEmailMatch({ jobSource: job.source, contactSource: c.source, matchedOnlyByInference: true })
        })
      const matchedCompanyNames = new Set(
        candidate.jobPostings.filter((job) => contactsAt(job).length > 0).map((job) => job.companyName!.toLowerCase().trim())
      )

      for (const job of candidate.jobPostings) {
        if (!job.companyName || (job.backchannelEmailSentAt && !force)) continue
        // Ranked best-first (has an email, then warmest, then most relevant to
        // this role), and anyone confirmed to have left is dropped.
        const matchedContacts = rankBackchannelContacts(contactsAt(job), job.title)
        if (matchedContacts.length === 0) continue

        if (dryRun) {
          wouldSend.push({ candidateId: candidate.id, jobId: job.id, companyName: job.companyName, contactCount: matchedContacts.length })
          break
        }

        const otherCompanyCount = Math.max(0, matchedCompanyNames.size - 1)
        const result = await sendBackchannelMatchEmail(
          candidate,
          { id: job.id, companyName: job.companyName, role: job.title, appliedAt: job.appliedAt },
          matchedContacts,
          otherCompanyCount,
          // How many of these emails they've had already — rotates the stat shown.
          candidate.jobPostings.filter((j) => j.backchannelEmailSentAt).length
        )
        // Only mark it notified once the email actually went out — a failed send
        // (provider error, no address on file) is retried on the next run rather
        // than silently using up this application's one nudge.
        if (result.sent) {
          await prisma.jobPosting.update({ where: { id: job.id }, data: { backchannelEmailSentAt: new Date() } })
          sentCount += 1
        }
        break
      }
    } catch (error) {
      console.error('Backchannel match nudge failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json(dryRun ? { checked: eligible.length, dryRun: true, wouldSend } : { checked: eligible.length, sent: sentCount })
})
