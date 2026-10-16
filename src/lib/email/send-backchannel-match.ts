import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import BackchannelMatchEmail from '@/emails/backchannel-match'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { draftBackchannelNote, type BackchannelContact } from '@/lib/email/backchannel-note'
import { captureServerEvent } from '@/lib/posthog/server'

// `contacts` must already be ranked best-first (see rankBackchannelContacts) —
// the email leads with contacts[0] and mentions the rest as a count.
export async function sendBackchannelMatchEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  job: { id: string; companyName: string; role: string | null; appliedAt: Date | null },
  contacts: (BackchannelContact & { id: string })[],
  otherCompanyCount: number
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping backchannel match email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // #jobs-applied is the Application Tracker section's scroll anchor on
  // Find Full-Time Jobs (see find-my-job/page.tsx).
  const otherCompaniesUrl = `${appUrl}/dashboard/find-my-job#jobs-applied`
  const [lead, ...rest] = contacts
  const note = draftBackchannelNote({
    contactName: lead.name,
    role: job.role,
    companyName: job.companyName,
    senderFirstName: candidate.firstName,
  })
  const contactHasEmail = Boolean(lead.email)
  const actionUrl = lead.email
    ? gmailComposeHref(lead.email, note.subject, note.body)
    : `${appUrl}/dashboard/network/contacts/${lead.id}`
  const unsubscribeUrl = candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly')

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: `${lead.name} works at ${job.companyName}`,
    react: BackchannelMatchEmail({
      firstName: candidate.firstName,
      companyName: job.companyName,
      role: job.role,
      appliedOn: job.appliedAt
        ? job.appliedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : null,
      contact: { name: lead.name, title: lead.title },
      moreContactCount: rest.length,
      note,
      actionUrl,
      actionLabel: contactHasEmail ? `Email ${lead.name.split(/\s+/)[0]}` : 'Open their contact page',
      contactHasEmail,
      otherCompanyCount,
      otherCompaniesUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send backchannel match email:', error)
    return { sent: false as const }
  }

  captureServerEvent(candidate.id, 'backchannel_match_email_sent', {
    jobId: job.id,
    companyName: job.companyName,
    contactId: lead.id,
    matchedContactCount: contacts.length,
    contactHasEmail,
    otherCompanyCount,
  })

  return { sent: true as const }
}
