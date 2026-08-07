import 'server-only'
import { Resend } from 'resend'
import RecruiterNewCandidateAlertEmail from '@/emails/recruiter-new-candidate-alert'

export async function sendRecruiterNewCandidateAlertEmail(
  recruiter: { id: string; fullName: string; workEmail: string },
  candidate: { primaryFunction: string; level: string; targetRoleType: string; industry: string; geo: string }
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping recruiter new-candidate alert email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalUrl = `${appUrl}/recruiters/search`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/recruiter/${recruiter.id}?type=candidate-alert`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: recruiter.workEmail,
      subject: 'A new A-grade candidate just unlocked',
      react: RecruiterNewCandidateAlertEmail({
        fullName: recruiter.fullName,
        primaryFunction: candidate.primaryFunction,
        level: candidate.level,
        targetRoleType: candidate.targetRoleType,
        industry: candidate.industry,
        geo: candidate.geo,
        portalUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send recruiter new-candidate alert email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send recruiter new-candidate alert email:', error)
    return { sent: false as const }
  }
}
