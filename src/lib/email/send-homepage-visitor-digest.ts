import 'server-only'
import { Resend } from 'resend'
import HomepageVisitorDigestEmail from '@/emails/homepage-visitor-digest'

interface VisitorSummary {
  ip: string
  visitCount: number
  firstSeen: string
  links: { href: string; label: string }[]
  referrer: string | null
  userAgent: string | null
}

export async function sendHomepageVisitorDigestEmail(adminEmail: string, date: string, visitors: VisitorSummary[]) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping homepage visitor digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminUrl = `${appUrl}/support/admin/visitors`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: adminEmail,
      subject: `Homepage visitors: ${visitors.length} on ${date}`,
      react: HomepageVisitorDigestEmail({ date, visitors, adminUrl }),
    })

    if (error) {
      console.error('Failed to send homepage visitor digest email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send homepage visitor digest email:', error)
    return { sent: false as const }
  }
}
