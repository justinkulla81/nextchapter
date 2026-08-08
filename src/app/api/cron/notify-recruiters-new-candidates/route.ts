import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRecruiterDatabaseRows, bucketRecruiterDatabaseRows } from '@/lib/admin/recruiter-database'
import { getRecruiterDigestAdminEmail } from '@/lib/admin/auth'
import { sendRecruiterDailyDigestEmail } from '@/lib/email/send-recruiter-daily-digest'
import { sendAdminRecruiterDigestEmail } from '@/lib/email/send-admin-recruiter-digest'
import { captureServerEvent } from '@/lib/posthog/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pendingNotify } = bucketRecruiterDatabaseRows(await getRecruiterDatabaseRows())
  if (pendingNotify.length === 0) {
    return NextResponse.json({ candidates: 0, recruitersNotified: 0, adminNotified: false })
  }

  const recruiters = await prisma.recruiter.findMany({
    where: { newCandidateAlertsOptedOut: false, userId: { not: null }, isSampleData: false },
    select: { id: true, fullName: true, workEmail: true },
  })

  const digestCandidates = pendingNotify.map((row) => ({
    primaryFunction: row.primaryFunction,
    level: row.level,
    targetRoleType: row.targetRoleType,
    industry: row.industry,
    geo: row.geo,
  }))

  // Stamped before sending, not after — a crash or timeout partway through
  // the sends below must never leave these candidates eligible for another
  // full re-send (to every recruiter) on the next cron run. Worst case here
  // is a rare missed digest mention for one day, not a repeated blast.
  await prisma.candidateProfile.updateMany({
    where: { id: { in: pendingNotify.map((row) => row.id) } },
    data: { recruiterNotifiedAt: new Date() },
  })

  let recruitersNotified = 0
  const results = await Promise.all(
    recruiters.map((r) =>
      sendRecruiterDailyDigestEmail(r, digestCandidates).then((result) => {
        if (result.sent) {
          captureServerEvent(r.id, 'recruiter_daily_digest_sent', { candidateCount: digestCandidates.length })
        }
        return result
      })
    )
  )
  recruitersNotified = results.filter((r) => r.sent).length

  let adminNotified = false
  const adminEmail = getRecruiterDigestAdminEmail()
  if (adminEmail) {
    const result = await sendAdminRecruiterDigestEmail(
      adminEmail,
      pendingNotify.map((row) => ({
        name: row.name,
        email: row.email,
        primaryFunction: row.primaryFunction,
        level: row.level,
        targetRoleType: row.targetRoleType,
        industry: row.industry,
        geo: row.geo,
      })),
      recruiters.length
    )
    adminNotified = result.sent
    if (adminNotified) {
      captureServerEvent(adminEmail, 'admin_recruiter_digest_sent', {
        candidateCount: pendingNotify.length,
        recruiterCount: recruiters.length,
      })
    }
  }

  await prisma.candidateProfile.updateMany({
    where: { id: { in: pendingNotify.map((row) => row.id) } },
    data: { recruiterNotifiedAt: new Date() },
  })

  return NextResponse.json({ candidates: pendingNotify.length, recruitersNotified, adminNotified })
}
