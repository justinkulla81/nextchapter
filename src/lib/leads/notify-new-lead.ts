import 'server-only'
import { after } from 'next/server'
import { createResend } from '@/lib/email/resend-client'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { allowByTarget, allowRequest, DAY_MS } from '@/lib/security/rate-limit'
import AdminNewLeadEmail from '@/emails/admin-new-lead'

// Emails the admin when someone gives us an email address on the public site
// (journey picker, job alerts, newsletter, guides, résumé submissions,
// waitlists). Call it right after the row is created; it runs after the
// response, never blocks or fails the form, and does nothing when sending is
// not configured.
//
// Two limits keep a script from filling the inbox: one alert per address per
// week, and DAILY_CAP alerts a day in all. Past the cap the lead is still
// stored and still appears in the daily digest and the captured-emails page.
// The contact form is not routed through here: it already emails the admin.

const DAILY_CAP = 40

export interface NewLead {
  email: string
  name?: string | null
  /** In words: "Newsletter", "Guide download", ... Matches the captured-emails page. */
  channel: string
  /** Which page or offer it came from. */
  detail?: string
}

async function send(lead: NewLead): Promise<void> {
  const adminEmail = getAccountActivityAdminEmail()
  if (!adminEmail || !process.env.RESEND_API_KEY) return
  // Never alert on the admin's own test signups.
  if (lead.email.trim().toLowerCase() === adminEmail.toLowerCase()) return
  if (!(await allowByTarget('new-lead-alert', lead.email, 1, 7 * DAY_MS))) return
  if (!(await allowRequest({ bucket: 'new-lead-alert-all', key: 'all', limit: DAILY_CAP, windowMs: DAY_MS }))) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    to: adminEmail,
    subject: `New lead: ${lead.channel}`,
    react: AdminNewLeadEmail({
      email: lead.email.trim().toLowerCase(),
      name: lead.name ?? null,
      channel: lead.channel,
      detail: lead.detail ?? '',
      listUrl: `${appUrl}/support/admin/captured-emails`,
    }),
  })
  if (error) console.error('Failed to send new-lead alert:', error)
}

export function notifyNewLead(lead: NewLead): void {
  const run = () => send(lead).catch((error) => console.error('New-lead alert failed:', error))
  try {
    after(run)
  } catch {
    // Outside a request (a script or a test): run it now, still without awaiting.
    void run()
  }
}
