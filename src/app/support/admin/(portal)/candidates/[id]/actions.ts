'use server'

import { revalidatePath } from 'next/cache'
import type { AdminNudgeType, CandidateStakeholderType } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildNudgeDraft, type NudgeDraft } from '@/lib/admin/nudge-content'
import { sendAdminNudgeEmail } from '@/lib/email/send-admin-nudge'
import { addStakeholderNote } from '@/lib/admin/stakeholder-relationships'
import { sendMessage } from '@/lib/messaging/threads'

// Sent as MessageSenderRole.ADMIN, never as the coach/recruiter/employer's
// own role — see that enum value's schema comment. candidateId is only
// used for the revalidate/analytics call, not to authorize the reply (any
// admin can reply into any thread they can already see on this page).
export async function sendAdminThreadReply(candidateId: string, threadId: string, formData: FormData) {
  const admin = await requireAdmin()
  const body = (formData.get('body') as string | null)?.trim()
  if (!body) return

  await sendMessage(threadId, 'ADMIN', body)
  captureServerEvent(candidateId, 'admin_thread_reply_sent', { threadId, sentByEmail: admin.email })
  revalidatePath(`/support/admin/candidates/${candidateId}`)
}

export async function addCandidateStakeholderNote(
  candidateId: string,
  stakeholderType: CandidateStakeholderType,
  stakeholderId: string | null,
  formData: FormData
) {
  const admin = await requireAdmin()
  const body = (formData.get('body') as string | null)?.trim()
  if (!body) return

  await addStakeholderNote(candidateId, stakeholderType, body, admin.email ?? 'admin', stakeholderId)
  revalidatePath(`/support/admin/candidates/${candidateId}`)
}

export async function generateNudgeDraft(
  candidateId: string,
  nudgeType: AdminNudgeType
): Promise<{ draft: NudgeDraft } | { error: string }> {
  await requireAdmin()
  try {
    const draft = await buildNudgeDraft(candidateId, nudgeType)
    return { draft }
  } catch (error) {
    console.error('Failed to generate nudge draft:', error)
    return { error: 'Could not generate a draft for this candidate — try again.' }
  }
}

export async function sendCandidateNudgeEmail(
  candidateId: string,
  nudgeType: AdminNudgeType,
  subject: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string
): Promise<{ error?: string } | undefined> {
  const admin = await requireAdmin()

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { userId: true },
  })
  if (!candidate) return { error: 'Candidate not found.' }

  const authClient = createAdminClient()
  const { data: userData } = await authClient.auth.admin.getUserById(candidate.userId)
  const recipientEmail = userData.user?.email
  if (!recipientEmail) return { error: "Could not find this candidate's account email." }

  const result = await sendAdminNudgeEmail({
    to: recipientEmail,
    subject,
    bodyText: body,
    ctaLabel,
    ctaUrl,
  })

  await prisma.adminEmailLog.create({
    data: {
      candidateId,
      nudgeType,
      subject,
      body,
      recipientEmail,
      sentByEmail: admin.email ?? 'admin',
      status: result.sent ? 'sent' : 'failed',
      errorMessage: result.sent ? null : result.error,
    },
  })

  captureServerEvent(candidateId, 'admin_nudge_email_sent', {
    nudgeType,
    sentByEmail: admin.email,
    status: result.sent ? 'sent' : 'failed',
  })

  revalidatePath(`/support/admin/candidates/${candidateId}`)

  if (!result.sent) return { error: result.error }
  return undefined
}
