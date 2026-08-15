import 'server-only'
import { Resend } from 'resend'
import ReferenceRequestEmail from '@/emails/reference-request'

export async function sendReferenceRequestEmail({
  refereeEmail,
  refereeName,
  candidateName,
  token,
  confidentialSearchMode,
}: {
  refereeEmail: string
  refereeName: string
  candidateName: string
  token: string
  // PART TWO §9 — confidential mode gets its own subject line ("A quick
  // favor" per spec's exact wording); the existing subject is already
  // neutral enough to keep as-is for open mode (no "job search"/"resume"/
  // etc. per neutralizeEmailSubject's flagged-term list).
  confidentialSearchMode: boolean
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping reference request email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const referenceUrl = `${appUrl}/ref/${token}`
  const subject = confidentialSearchMode
    ? 'A quick favor'
    : `${candidateName} has requested a reference from you`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: refereeEmail,
      subject,
      react: ReferenceRequestEmail({ candidateName, refereeName, referenceUrl, confidentialSearchMode }),
    })

    if (error) {
      console.error('Failed to send reference request email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break reference request creation.
    console.error('Failed to send reference request email:', error)
    return { sent: false as const }
  }
}
