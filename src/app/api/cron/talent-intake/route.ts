import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { processIntakeResume } from '@/lib/recruiter/intake/pipeline'
import { intakeRepliesSendingEnabled, sendApprovedReply } from '@/lib/recruiter/intake/replies'
import { firstNameOf } from '@/lib/recruiter/intake/reply-templates'
import { INTAKE_CLAIM_REMINDER_GAP_DAYS, INTAKE_MAX_CLAIM_INVITES, INTAKE_REPLY_KIND_LABELS } from '@/lib/recruiter/intake/constants'
import { sendIntakeApprovalDigest, sendIntakeClaimReminder } from '@/lib/email/send-intake'

// NextChapter Talent daily job:
//   1. Read resumes left QUEUED by a firm's daily parse cap.
//   2. Email each recruiter (or, for the general hopper, the firm's admins
//      and coordinators) the replies waiting for approval.
//   3. Send approved replies that were approved while sending was off.
//   4. Claim reminders: at most 2 after the first invite, a week apart, only
//      to people who already got one email and haven't unsubscribed.
//   5. Delete unclaimed intake profiles (and their files) past purgeAt.

export const maxDuration = 300

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = { parsed: 0, stillQueued: 0, digests: 0, repliesSent: 0, reminders: 0, purged: 0, errors: 0 }

  // 1. Queued parses, oldest first. processIntakeResume re-checks the cap.
  const queued = await prisma.intakeResume.findMany({ where: { parseStatus: 'QUEUED' }, orderBy: { createdAt: 'asc' }, take: 400, select: { id: true } })
  for (const resume of queued) {
    try {
      const outcome = await processIntakeResume(resume.id)
      if (outcome === 'done') summary.parsed++
      if (outcome === 'queued') summary.stillQueued++
    } catch (error) {
      summary.errors++
      console.error('talent-intake cron: parse failed', resume.id, error)
    }
  }

  // 2. Approval digests.
  const sendingEnabled = await intakeRepliesSendingEnabled()
  const drafts = await prisma.intakeReply.findMany({
    where: { status: 'DRAFT', connection: { disconnectedAt: null } },
    include: { connection: { select: { firmId: true, recruiterId: true, tagReasons: true, intakeCandidate: { select: { fullName: true } } } } },
  })
  const byRecipient = new Map<string, typeof drafts>()
  const generalByFirm = new Map<string, typeof drafts>()
  for (const draft of drafts) {
    if (draft.connection.recruiterId) {
      byRecipient.set(draft.connection.recruiterId, [...(byRecipient.get(draft.connection.recruiterId) ?? []), draft])
    } else {
      generalByFirm.set(draft.connection.firmId, [...(generalByFirm.get(draft.connection.firmId) ?? []), draft])
    }
  }
  for (const [firmId, items] of generalByFirm) {
    const leads = await prisma.recruiter.findMany({ where: { recruiterFirmId: firmId, firmRole: { in: ['ADMIN', 'COORDINATOR'] } }, select: { id: true } })
    for (const lead of leads) byRecipient.set(lead.id, [...(byRecipient.get(lead.id) ?? []), ...items])
  }
  for (const [recruiterId, items] of byRecipient) {
    const recruiter = await prisma.recruiter.findUnique({ where: { id: recruiterId } })
    if (!recruiter) continue
    const result = await sendIntakeApprovalDigest({
      to: recruiter.workEmail,
      recruiterId,
      recruiterFirstName: firstNameOf(recruiter.fullName),
      items: items.map((d) => ({
        candidateName: d.connection.intakeCandidate.fullName,
        kind: INTAKE_REPLY_KIND_LABELS[d.kind],
        reason: d.connection.tagReasons[0] ?? '',
      })),
      sendingEnabled,
    })
    if (result.sent) {
      summary.digests++
      captureServerEvent(recruiterId, 'talent_approval_digest_sent', { recruiterId, replyCount: items.length })
    }
  }

  // 3. Approved-but-unsent replies (approved while sending was off).
  if (sendingEnabled) {
    const approved = await prisma.intakeReply.findMany({ where: { status: 'APPROVED' }, select: { id: true }, take: 500 })
    for (const reply of approved) {
      if ((await sendApprovedReply(reply.id)) === 'sent') summary.repliesSent++
    }
  }

  // 4. Claim reminders.
  const gapCutoff = new Date(Date.now() - INTAKE_CLAIM_REMINDER_GAP_DAYS * 86_400_000)
  const due = await prisma.intakeCandidate.findMany({
    where: {
      claimedAt: null,
      emailOptedOutAt: null,
      claimInvitesSent: { gte: 1, lt: INTAKE_MAX_CLAIM_INVITES },
      lastClaimInviteAt: { lt: gapCutoff },
      purgeAt: { gt: new Date() },
      connections: { some: { disconnectedAt: null } },
    },
    include: { connections: { where: { disconnectedAt: null }, include: { firm: { select: { name: true } } }, take: 1 } },
    take: 500,
  })
  for (const person of due) {
    const sequence = person.claimInvitesSent + 1
    const result = await sendIntakeClaimReminder({
      to: person.email,
      firstName: firstNameOf(person.fullName),
      firmName: person.connections[0]?.firm.name ?? 'A search firm',
      claimToken: person.claimToken,
      final: sequence >= INTAKE_MAX_CLAIM_INVITES,
      sequence,
    })
    if (result.sent) {
      summary.reminders++
      await prisma.intakeCandidate.update({ where: { id: person.id }, data: { claimInvitesSent: sequence, lastClaimInviteAt: new Date() } })
    }
  }

  // 5. Purge unclaimed profiles past purgeAt: files first, then rows
  // (cascades to resumes, connections, consent events, replies).
  const expired = await prisma.intakeCandidate.findMany({
    where: { claimedAt: null, purgeAt: { lt: new Date() } },
    include: { resumes: { select: { filePath: true } } },
    take: 500,
  })
  const storage = createAdminClient().storage.from('resumes')
  for (const person of expired) {
    try {
      const paths = person.resumes.map((r) => r.filePath)
      if (paths.length > 0) await storage.remove(paths)
      await prisma.intakeCandidate.delete({ where: { id: person.id } })
      summary.purged++
    } catch (error) {
      summary.errors++
      console.error('talent-intake cron: purge failed', person.id, error)
    }
  }

  return NextResponse.json(summary)
}
