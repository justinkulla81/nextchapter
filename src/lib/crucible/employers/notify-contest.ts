import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEligibleCandidatesForContest, resolveCrucibleSessionEmail } from './eligible-candidates'
import { sendCrucibleContestInviteEmail } from '@/lib/email/send-crucible-contest-invite'

// Runs inline inside publishCrucibleContest — no queue infra exists in this
// repo. Flag moving to a background dispatch as a follow-up if candidate
// volume grows large enough to risk request timeouts.
export async function notifyEligibleCandidatesForContest(
  contestId: string
): Promise<{ checked: number; sent: number }> {
  const contest = await prisma.crucibleContest.findUniqueOrThrow({
    where: { id: contestId },
    include: { employer: true },
  })
  const eligible = await getEligibleCandidatesForContest(contest)

  let sent = 0
  for (const session of eligible) {
    try {
      // The [contestId, sessionId] unique constraint IS the idempotency
      // claim — a P2002 here means this session was already invited
      // (e.g. a retried publish), so skip it rather than double-emailing.
      let entry
      try {
        entry = await prisma.crucibleContestEntry.create({
          data: { contestId: contest.id, sessionId: session.id },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue
        throw error
      }

      const email = await resolveCrucibleSessionEmail(session)
      if (!email) continue

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const result = await sendCrucibleContestInviteEmail(
        email,
        contest.employer.companyName,
        contest.title,
        `${appUrl}/noexperience/employers/contests/entry/${entry.token}`
      )
      if (result.sent) {
        sent++
        await prisma.crucibleContestEntry.update({ where: { id: entry.id }, data: { emailSentAt: new Date() } })
      }
    } catch (error) {
      console.error('Contest invite failed for session', session.id, error)
    }
  }

  return { checked: eligible.length, sent }
}
