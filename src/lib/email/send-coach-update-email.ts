import 'server-only'
import { createResend } from '@/lib/email/resend-client'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The words of the notice. Pure so the test can check that no summary text can be in it: it takes none. */
export function coachUpdateEmailContent(p: { memberFirstName: string | null; coachFirstName: string; confidential: boolean; url: string }) {
  const hello = p.memberFirstName ? `Hi ${p.memberFirstName},` : 'Hi,'
  // Confidential Search Mode: a subject and body that name nothing about a search, in case this is read on a shared screen.
  const subject = p.confidential ? 'An update from NextChapter' : `${p.coachFirstName} sent you an update`
  const line = p.confidential ? 'You have an update waiting in NextChapter.' : `${p.coachFirstName} added an update for you in NextChapter.`
  const text = `${hello}\n\n${line}\n\nOpen it: ${p.url}\n\n— NextChapter`
  const html = `<p>${escapeHtml(hello)}</p><p>${escapeHtml(line)}</p><p><a href="${escapeHtml(p.url)}">Open your update</a></p><p>— NextChapter</p>`
  return { subject, text, html }
}

// Sent when a coach presses "Send to <name>" on a session summary. It says there is an update and links to it. It
// carries no summary text, no follow-ups and no topics: those are read in the app, signed in.
export async function sendCoachUpdateEmail(p: { to: string; memberFirstName: string | null; coachFirstName: string; confidential: boolean; url: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping coach update email.')
    return { sent: false as const }
  }
  const { subject, text, html } = coachUpdateEmailContent(p)
  try {
    const resend = createResend(process.env.RESEND_API_KEY, 'candidate')
    const { error } = await resend.emails.send({ from: 'NextChapter <support@launchyournextchapter.com>', to: p.to, subject, html, text })
    if (error) {
      console.error('Failed to send coach update email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    // Email must never undo a send that already happened.
    console.error('Failed to send coach update email:', error)
    return { sent: false as const }
  }
}
