import 'server-only'
import { Prisma, type CandidateEmailKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function startOfUTCDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// Claim-before-send idempotency: attempt the insert first, and treat a
// unique-constraint violation as "another run already sent this today,"
// not an error. This is what makes the dispatcher safe against a duplicate
// cron fire or an admin-triggered retry — see CandidateEmailSendLog in
// schema.prisma.
export async function recordCandidateEmailSent(candidateId: string, emailKey: CandidateEmailKey): Promise<boolean> {
  try {
    await prisma.candidateEmailSendLog.create({
      data: { candidateId, emailKey, sentForDate: startOfUTCDay(new Date()) },
    })
    return true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false
    }
    throw error
  }
}

export async function hasAlreadySentToday(candidateId: string, emailKey: CandidateEmailKey): Promise<boolean> {
  const existing = await prisma.candidateEmailSendLog.findUnique({
    where: {
      candidateId_emailKey_sentForDate: { candidateId, emailKey, sentForDate: startOfUTCDay(new Date()) },
    },
  })
  return !!existing
}
