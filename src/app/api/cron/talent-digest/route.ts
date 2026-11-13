import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'
import { loadWeeklyDigest } from '@/lib/recruiter/intake/digest-load'
import { firstNameOf } from '@/lib/recruiter/intake/reply-templates'
import { sendIntakeWeeklyDigest } from '@/lib/email/send-intake'

// Monday: each NextChapter Talent recruiter gets one email of what changed in their candidates, only if something did.
// Off until TALENT_DIGEST_ENABLED=true. Reads: the recruiters of VERIFIED firms, then per recruiter at most 300 of
// their own connections plus one batched profile read; once a week.
export const maxDuration = 300

export const GET = withCronRun('talent-digest', async () => {
  const summary = { enabled: process.env.TALENT_DIGEST_ENABLED === 'true', recruiters: 0, sent: 0, skippedEmpty: 0, errors: 0 }
  if (!summary.enabled) return NextResponse.json(summary)

  const recruiters = await prisma.recruiter.findMany({
    where: { recruiterFirmId: { not: null }, firmRole: { not: null }, recruiterFirm: { status: 'VERIFIED' } },
    include: { recruiterFirm: true },
    take: 2000,
  })
  for (const recruiter of recruiters) {
    summary.recruiters++
    try {
      const digest = await loadWeeklyDigest({ recruiter, firm: recruiter.recruiterFirm, role: recruiter.firmRole })
      if (digest.isEmpty) {
        summary.skippedEmpty++
        continue
      }
      const result = await sendIntakeWeeklyDigest({
        to: recruiter.workEmail,
        recruiterId: recruiter.id,
        recruiterFirstName: firstNameOf(recruiter.fullName),
        digest: {
          newCount: digest.newCount,
          newNames: digest.newNames,
          due: digest.due.map((d) => ({ name: d.name, stage: d.stage, nextStepAt: d.nextStepAt.toISOString().slice(0, 10) })),
          changes: digest.changes.map((c) => ({ name: c.name, label: c.label, landing: c.landing })),
        },
      })
      if (result.sent) {
        summary.sent++
        captureServerEvent(recruiter.id, 'talent_weekly_digest_sent', {
          recruiterId: recruiter.id,
          firmId: recruiter.recruiterFirmId,
          dueCount: digest.due.length,
          changeCount: digest.changes.length,
          newCount: digest.newCount,
        })
      }
    } catch (error) {
      summary.errors++
      console.error('talent-digest cron failed for recruiter', recruiter.id, error)
    }
  }
  return NextResponse.json(summary)
})
