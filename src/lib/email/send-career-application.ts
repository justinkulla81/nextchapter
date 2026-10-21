import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { CAREERS_EMAIL } from '@/lib/contact/constants'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Sends a new career application, with the resume attached, to careers@. Never throws: the application is already saved. */
export async function sendCareerApplicationEmail(input: {
  fullName: string | null
  email: string
  roleTitle: string
  note: string | null
  fileName: string
  file: Buffer
}): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping career application email.')
    return { sent: false }
  }
  try {
    const resend = createResend(process.env.RESEND_API_KEY, 'admin')
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: CAREERS_EMAIL,
      replyTo: input.email,
      subject: `Application: ${input.roleTitle}, ${input.fullName ?? input.email}`,
      html: `<p><strong>${esc(input.fullName ?? input.email)}</strong>${input.fullName ? ` (${esc(input.email)})` : ''} applied for <strong>${esc(input.roleTitle)}</strong>.</p>${
        input.note ? `<p>What they would do here:<br>${esc(input.note).replace(/\n/g, '<br>')}</p>` : ''
      }<p>Resume attached. Reply to this email to answer them.</p>`,
      attachments: [{ filename: input.fileName, content: input.file }],
    })
    if (error) {
      console.error('Failed to send career application email:', error)
      return { sent: false }
    }
    return { sent: true }
  } catch (error) {
    console.error('Failed to send career application email:', error)
    return { sent: false }
  }
}
