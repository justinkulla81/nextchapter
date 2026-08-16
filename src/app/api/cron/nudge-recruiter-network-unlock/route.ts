import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRecruiterDatabaseRows, bucketRecruiterDatabaseRows } from '@/lib/admin/recruiter-database'
import { sendUnlockRecruiterNetworkNudgeEmail } from '@/lib/email/send-unlock-recruiter-network-nudge'

const RENUDGE_AFTER_DAYS = 14

// Weekly — only the lockedButUnlocked bucket (Dossier unlocked, hasn't
// opted in) gets an automatic nudge; almostThere is deliberately
// manual-only, since those candidates haven't actually earned the
// "you're unlocked" pitch yet. Throttled per-candidate via
// recruiterUnlockNudgedAt so this doesn't re-send every week forever.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lockedButUnlocked } = bucketRecruiterDatabaseRows(await getRecruiterDatabaseRows())
  const cutoff = new Date(Date.now() - RENUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000)

  const eligible = lockedButUnlocked.filter(
    (row) => row.recruiterUnlockNudgedAt === null || row.recruiterUnlockNudgedAt < cutoff
  )
  if (eligible.length === 0) {
    return NextResponse.json({ eligible: 0, sent: 0 })
  }

  const optOuts = await prisma.candidateProfile.findMany({
    where: { id: { in: eligible.map((row) => row.id) }, recruiterUnlockNudgeOptedOut: true },
    select: { id: true },
  })
  const optedOutIds = new Set(optOuts.map((c) => c.id))

  let sentCount = 0
  for (const row of eligible) {
    if (optedOutIds.has(row.id) || !row.email) continue
    const [firstName] = row.name.split(' ')
    const result = await sendUnlockRecruiterNetworkNudgeEmail({ id: row.id, firstName: firstName ?? null, email: row.email })
    if (result.sent) {
      sentCount += 1
      await prisma.candidateProfile.update({ where: { id: row.id }, data: { recruiterUnlockNudgedAt: new Date() } })
    }
  }

  return NextResponse.json({ eligible: eligible.length, sent: sentCount })
}
