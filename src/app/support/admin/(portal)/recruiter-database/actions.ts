'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getRecruiterDatabaseRows } from '@/lib/admin/recruiter-database'
import { sendRecruiterNewCandidateAlertEmail } from '@/lib/email/send-recruiter-new-candidate-alert'
import { sendUnlockRecruiterNetworkNudgeEmail } from '@/lib/email/send-unlock-recruiter-network-nudge'

// Manual counterpart to the daily notify-recruiters-new-candidates cron —
// same underlying send, triggered on demand for one specific candidate
// instead of waiting for the next scheduled run.
export async function notifyRecruitersForCandidate(candidateId: string): Promise<void> {
  await requireAdmin()
  const rows = await getRecruiterDatabaseRows()
  const row = rows.find((r) => r.id === candidateId)
  if (!row) return

  const recruiters = await prisma.recruiter.findMany({
    where: { newCandidateAlertsOptedOut: false, userId: { not: null }, isSampleData: false },
    select: { id: true, fullName: true, workEmail: true },
  })

  await Promise.all(
    recruiters.map((r) =>
      sendRecruiterNewCandidateAlertEmail(r, {
        primaryFunction: row.primaryFunction,
        level: row.level,
        targetRoleType: row.targetRoleType,
        industry: row.industry,
        geo: row.geo,
      }).catch((error) => console.error('Failed to send recruiter alert to', r.id, error))
    )
  )

  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { recruiterNotifiedAt: new Date() } })
  revalidatePath('/support/admin/recruiter-database')
}

// Manual counterpart to the weekly nudge-recruiter-network-unlock cron —
// used for both the lockedAGrade bucket (which the cron also covers
// automatically) and the almostThere bucket (manual-only by design, since
// a B-grade candidate hasn't actually earned the pitch yet).
export async function nudgeCandidateToUnlock(candidateId: string): Promise<void> {
  await requireAdmin()
  const [row, profile] = await Promise.all([
    getRecruiterDatabaseRows().then((rows) => rows.find((r) => r.id === candidateId)),
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { firstName: true, recruiterUnlockNudgeOptedOut: true },
    }),
  ])
  // row.email comes from the real Supabase auth user (getAuthEmail), not
  // the resume-derived CandidateProfile.email column — same distinction
  // sync-registration.ts's own comment calls out.
  if (!row || !profile || profile.recruiterUnlockNudgeOptedOut || !row.email) return

  await sendUnlockRecruiterNetworkNudgeEmail({ id: candidateId, firstName: profile.firstName, email: row.email })
  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { recruiterUnlockNudgedAt: new Date() } })
  revalidatePath('/support/admin/recruiter-database')
}
