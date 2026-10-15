import 'server-only'
import { createResend } from '@/lib/email/resend-client'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Sent only when no Google Calendar invitation went out (the calendar was not connected or
// the call failed), so a booking is never silent.
export async function sendBookingEmail(params: {
  to: string
  kind: 'booked' | 'cancelled'
  otherPartyName: string
  startsAt: Date
  /** The coach's zone, so the time is stated unambiguously. */
  timezone: string
  meetUrl: string | null
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping coaching booking email.')
    return { sent: false as const }
  }
  const when = params.startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: params.timezone, timeZoneName: 'short' })
  const who = escapeHtml(params.otherPartyName)
  const subject = params.kind === 'booked' ? `Coaching session booked for ${when}` : `Coaching session cancelled: ${when}`
  const body =
    params.kind === 'booked'
      ? `<p>A coaching session with ${who} is booked for <strong>${escapeHtml(when)}</strong>.</p>${
          params.meetUrl ? `<p>Join here: <a href="${escapeHtml(params.meetUrl)}">${escapeHtml(params.meetUrl)}</a></p>` : '<p>Your coach will share the meeting link.</p>'
        }<p>To change or cancel it, use your NextChapter dashboard.</p>`
      : `<p>Your coaching session with ${who} on <strong>${escapeHtml(when)}</strong> was cancelled.</p><p>You can book another time from your NextChapter dashboard.</p>`
  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: params.to,
      subject,
      html: `${body}<p>— NextChapter</p>`,
    })
    if (error) {
      console.error('Failed to send booking email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send booking email:', error)
    return { sent: false as const }
  }
}
