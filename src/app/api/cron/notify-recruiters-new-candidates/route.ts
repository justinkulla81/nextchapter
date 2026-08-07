import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRecruiterDatabaseRows, bucketRecruiterDatabaseRows } from '@/lib/admin/recruiter-database'
import { sendRecruiterNewCandidateAlertEmail } from '@/lib/email/send-recruiter-new-candidate-alert'

// Daily — for every candidate who's opted in AND holds an A Exec Dossier
// Grade but recruiters haven't been told yet (pendingNotify bucket), blasts
// every opted-in recruiter and marks recruiterNotifiedAt so it only ever
// fires once per candidate. Mirrors the admin page's manual "Notify
// recruiters" button (same underlying send) for the ones nobody clicks.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pendingNotify } = bucketRecruiterDatabaseRows(await getRecruiterDatabaseRows())
  if (pendingNotify.length === 0) {
    return NextResponse.json({ candidates: 0, recruitersNotified: 0 })
  }

  const recruiters = await prisma.recruiter.findMany({
    where: { newCandidateAlertsOptedOut: false, userId: { not: null } },
    select: { id: true, fullName: true, workEmail: true },
  })

  let sentCount = 0
  for (const row of pendingNotify) {
    try {
      const results = await Promise.all(
        recruiters.map((r) =>
          sendRecruiterNewCandidateAlertEmail(r, {
            primaryFunction: row.primaryFunction,
            level: row.level,
            targetRoleType: row.targetRoleType,
            industry: row.industry,
            geo: row.geo,
          })
        )
      )
      sentCount += results.filter((r) => r.sent).length
      await prisma.candidateProfile.update({ where: { id: row.id }, data: { recruiterNotifiedAt: new Date() } })
    } catch (error) {
      console.error('Failed to notify recruiters for candidate', row.id, error)
    }
  }

  return NextResponse.json({ candidates: pendingNotify.length, recruitersNotified: sentCount })
}
