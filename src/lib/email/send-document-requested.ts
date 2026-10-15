import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import DocumentRequestedEmail from '@/emails/document-requested'

export async function sendDocumentRequestedEmail(params: {
  to: string
  requesterLabel: string
  title: string
  instructions: string | null
  dueAt: Date | null
  uploadUrl: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping document request email.')
    return { sent: false as const }
  }
  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: params.to,
      subject: `${params.requesterLabel} asked you for a document`,
      react: DocumentRequestedEmail({
        requesterLabel: params.requesterLabel,
        title: params.title,
        instructions: params.instructions,
        dueLabel: params.dueAt ? params.dueAt.toLocaleDateString('en-US', { dateStyle: 'long' }) : null,
        uploadUrl: params.uploadUrl,
      }),
    })
    if (error) {
      console.error('Failed to send document request email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send document request email:', error)
    return { sent: false as const }
  }
}
