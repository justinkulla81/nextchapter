import 'server-only'
import { Resend } from 'resend'
import OutplacementSeatInviteEmail from '@/emails/outplacement-seat-invite'
import OutplacementSeatLinkedEmail from '@/emails/outplacement-seat-linked'
import OutplacementOrgInviteEmail from '@/emails/outplacement-org-invite'

function resendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendOutplacementSeatInviteEmail(invitedEmail: string, orgName: string, acceptUrl: string) {
  const resend = resendClient()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping outplacement seat invite email.')
    return { sent: false as const }
  }
  try {
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `${orgName} set up a NextChapter benefit for you`,
      react: OutplacementSeatInviteEmail({ orgName, acceptUrl }),
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

export async function sendOutplacementSeatLinkedEmail(invitedEmail: string, orgName: string) {
  const resend = resendClient()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping outplacement seat linked email.')
    return { sent: false as const }
  }
  try {
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `${orgName} set up a NextChapter benefit for you`,
      react: OutplacementSeatLinkedEmail({ orgName }),
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
