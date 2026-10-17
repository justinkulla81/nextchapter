import 'server-only'
import type { Resend } from 'resend'
import { createResend } from '@/lib/email/resend-client'
import OutplacementSeatInviteEmail from '@/emails/outplacement-seat-invite'
import OutplacementSeatLinkedEmail from '@/emails/outplacement-seat-linked'
import OutplacementOrgInviteEmail from '@/emails/outplacement-org-invite'
import OutplacementAccessEndingEmail from '@/emails/outplacement-access-ending'
import type { OutplacementProgramType } from '@prisma/client'
import { PROGRAM_TYPE_BENEFIT } from '@/lib/employer/program-type'

function resendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return createResend(process.env.RESEND_API_KEY)
}

export async function sendOutplacementSeatInviteEmail(invitedEmail: string, orgName: string, acceptUrl: string, program?: { welcome: string | null; services: string[] }, opts: { reminder?: boolean; programType?: OutplacementProgramType } = {}) {
  const resend = resendClient()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping outplacement seat invite email.')
    return { sent: false as const }
  }
  try {
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: opts.reminder ? `Reminder: ${orgName} set up a NextChapter benefit for you` : `${orgName} set up a NextChapter ${PROGRAM_TYPE_BENEFIT[opts.programType ?? 'OUTPLACEMENT']} benefit for you`,
      react: OutplacementSeatInviteEmail({ orgName, acceptUrl, welcome: program?.welcome ?? null, services: program?.services ?? null, programType: opts.programType }),
    })
    if (error) {
      console.error('Failed to send outplacement seat invite email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send outplacement seat invite email:', error)
    return { sent: false as const }
  }
}

export async function sendOutplacementSeatLinkedEmail(invitedEmail: string, orgName: string, programType: OutplacementProgramType = 'OUTPLACEMENT') {
  const resend = resendClient()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping outplacement seat linked email.')
    return { sent: false as const }
  }
  try {
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `${orgName} set up a NextChapter ${PROGRAM_TYPE_BENEFIT[programType]} benefit for you`,
      react: OutplacementSeatLinkedEmail({ orgName, programType }),
    })
    if (error) {
      console.error('Failed to send outplacement seat linked email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send outplacement seat linked email:', error)
    return { sent: false as const }
  }
}

export async function sendOutplacementOrgInviteEmail(
  invitedEmail: string,
  orgName: string,
  roleLabel: string,
  acceptUrl: string
) {
  const resend = resendClient()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping outplacement org invite email.')
    return { sent: false as const }
  }
  try {
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `You're invited to ${orgName}'s NextChapter for Employers account`,
      react: OutplacementOrgInviteEmail({ orgName, roleLabel, acceptUrl }),
    })
    if (error) {
      console.error('Failed to send outplacement org invite email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send outplacement org invite email:', error)
    return { sent: false as const }
  }
}

export async function sendOutplacementAccessEndingEmail(to: string, orgName: string, endsOn: string, dashboardUrl: string) {
  const resend = resendClient()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping outplacement access-ending email.')
    return { sent: false as const }
  }
  try {
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to,
      subject: `Your ${orgName} NextChapter benefit ends ${endsOn}`,
      react: OutplacementAccessEndingEmail({ orgName, endsOn, dashboardUrl }),
    })
    if (error) {
      console.error('Failed to send outplacement access-ending email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send outplacement access-ending email:', error)
    return { sent: false as const }
  }
}
