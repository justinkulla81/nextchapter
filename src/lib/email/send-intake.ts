import 'server-only'
import type { ReactElement } from 'react'
import { Resend } from 'resend'
import {
  IntakeApprovalDigestEmail,
  IntakeClaimReminderEmail,
  IntakeFitAlertEmail,
  IntakeReplyEmail,
  IntakeSubmissionConfirmationEmail,
  RecruiterFirmInviteEmail,
} from '@/emails/intake-emails'

// NextChapter Talent senders. Same contract as the other send-*.ts wrappers:
// skip without RESEND_API_KEY, never throw, return { sent }.

const FROM_ADDRESS = 'support@launchyournextchapter.com'

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export function intakeClaimUrl(claimToken: string): string {
  return `${appUrl()}/in/claim/${claimToken}`
}

export function intakeUnsubscribeUrl(claimToken: string): string {
  return `${appUrl()}/api/unsubscribe/intake/${claimToken}`
}

// Display names can't carry quotes or angle brackets in a From header.
function safeName(name: string): string {
  return name.replace(/["<>]/g, '').trim() || 'NextChapter'
}

async function send({
  to,
  subject,
  react,
  fromName,
  replyTo,
  idempotencyKey,
}: {
  to: string
  subject: string
  react: ReactElement
  fromName: string
  replyTo?: string
  idempotencyKey?: string
}): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY is not set — skipping Talent email "${subject}".`)
    return { sent: false, error: 'email not configured' }
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send(
      {
        from: `${safeName(fromName)} <${FROM_ADDRESS}>`,
        to,
        subject,
        react,
        replyTo: replyTo ?? FROM_ADDRESS,
      },
      idempotencyKey ? { idempotencyKey } : undefined
    )
    if (error) {
      console.error(`Failed to send Talent email "${subject}":`, error)
      return { sent: false, error: error.message }
    }
    return { sent: true }
  } catch (error) {
    console.error(`Failed to send Talent email "${subject}":`, error)
    return { sent: false, error: error instanceof Error ? error.message : 'send failed' }
  }
}

export function sendIntakeSubmissionConfirmation(args: {
  to: string
  firstName: string
  firmName: string
  recruiterName: string | null
  recruiterEmail: string | null
  claimToken: string
  connectionId: string
}) {
  return send({
    to: args.to,
    subject: `${args.firmName} has your resume`,
    fromName: `${args.firmName} via NextChapter`,
    replyTo: args.recruiterEmail ?? undefined,
    idempotencyKey: `intake-confirm-${args.connectionId}-${new Date().toISOString().slice(0, 10)}`,
    react: IntakeSubmissionConfirmationEmail({
      firstName: args.firstName,
      firmName: args.firmName,
      recruiterName: args.recruiterName,
      claimUrl: intakeClaimUrl(args.claimToken),
      unsubscribeUrl: intakeUnsubscribeUrl(args.claimToken),
    }),
  })
}

export function sendIntakeReply(args: {
  replyId: string
  to: string
  subject: string
  body: string
  firmName: string
  recruiterName: string
  recruiterEmail: string | null
  claimToken: string
  includeClaimLink: boolean
}) {
  return send({
    to: args.to,
    subject: args.subject,
    fromName: `${args.recruiterName}, ${args.firmName}`,
    replyTo: args.recruiterEmail ?? undefined,
    idempotencyKey: `intake-reply-${args.replyId}`,
    react: IntakeReplyEmail({
      body: args.body,
      firmName: args.firmName,
      claimUrl: args.includeClaimLink ? intakeClaimUrl(args.claimToken) : null,
      unsubscribeUrl: intakeUnsubscribeUrl(args.claimToken),
    }),
  })
}

export function sendIntakeClaimReminder(args: {
  to: string
  firstName: string
  firmName: string
  claimToken: string
  final: boolean
  sequence: number
}) {
  return send({
    to: args.to,
    subject: 'Your free NextChapter profile is waiting',
    fromName: 'NextChapter',
    idempotencyKey: `intake-claim-${args.claimToken}-${args.sequence}`,
    react: IntakeClaimReminderEmail({
      firstName: args.firstName,
      firmName: args.firmName,
      claimUrl: intakeClaimUrl(args.claimToken),
      unsubscribeUrl: intakeUnsubscribeUrl(args.claimToken),
      final: args.final,
    }),
  })
}

export function sendIntakeFitAlert(args: {
  to: string
  recruiterId: string
  recruiterFirstName: string
  candidateName: string
  searchTitle: string
  summary: string[]
  reasons: string[]
  connectionId: string
}) {
  return send({
    to: args.to,
    subject: `Fit for ${args.searchTitle}: ${args.candidateName}`,
    fromName: 'NextChapter Talent',
    idempotencyKey: `intake-fit-${args.connectionId}`,
    react: IntakeFitAlertEmail({
      recruiterFirstName: args.recruiterFirstName,
      candidateName: args.candidateName,
      searchTitle: args.searchTitle,
      summary: args.summary,
      reasons: args.reasons,
      reviewUrl: `${appUrl()}/recruiters/talent/${args.connectionId}`,
    }),
  })
}

export function sendIntakeApprovalDigest(args: {
  to: string
  recruiterId: string
  recruiterFirstName: string
  items: { candidateName: string; kind: string; reason: string }[]
  sendingEnabled: boolean
}) {
  return send({
    to: args.to,
    subject: `${args.items.length} ${args.items.length === 1 ? 'reply' : 'replies'} waiting for your OK`,
    fromName: 'NextChapter Talent',
    idempotencyKey: `intake-digest-${args.recruiterId}-${new Date().toISOString().slice(0, 10)}`,
    react: IntakeApprovalDigestEmail({
      recruiterFirstName: args.recruiterFirstName,
      items: args.items,
      reviewUrl: `${appUrl()}/recruiters/talent/replies`,
      sendingEnabled: args.sendingEnabled,
    }),
  })
}

export function sendRecruiterFirmInvite(args: { to: string; firmName: string; inviterName: string; token: string }) {
  return send({
    to: args.to,
    subject: `${args.inviterName} invited you to ${args.firmName} on NextChapter`,
    fromName: 'NextChapter Talent',
    idempotencyKey: `firm-invite-${args.token}`,
    react: RecruiterFirmInviteEmail({
      firmName: args.firmName,
      inviterName: args.inviterName,
      signupUrl: `${appUrl()}/recruiters/signup?invite=${args.token}`,
    }),
  })
}
