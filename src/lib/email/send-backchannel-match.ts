import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import BackchannelMatchEmail from '@/emails/backchannel-match'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { draftBackchannelNote, type BackchannelContact } from '@/lib/email/backchannel-note'
import { captureServerEvent } from '@/lib/posthog/server'
import { pickBackchannelStat } from '@/lib/email/backchannel-stats'
import { readStoredLinks } from '@/lib/jobs/application-posting-link'

// `contacts` must already be ranked best-first (see rankBackchannelContacts) —
// the email leads with contacts[0] and mentions the rest as a count.
export async function sendBackchannelMatchEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  job: { id: string; companyName: string; role: string | null; appliedAt: Date | null },
  contacts: (BackchannelContact & { id: string })[],
  otherCompanyCount: number,
  sentBefore: number
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
  const MAX_LISTED = 5
  const listed = contacts.slice(0, MAX_LISTED)
  const people = listed.map((c) => {
    const draft = draftBackchannelNote({
      contactName: c.name,
      role: job.role,
      companyName: job.companyName,
      senderFirstName: candidate.firstName,
    })
    return {
      name: c.name,
      title: c.title,
      email: c.email,
      actionUrl: c.email
        ? gmailComposeHref(c.email, draft.subject, draft.body)
        : `${appUrl}/dashboard/network/contacts/${c.id}`,
    }
  })
  const note = draftBackchannelNote({
    contactName: listed[0].name,
    role: job.role,
    companyName: job.companyName,
    senderFirstName: candidate.firstName,
  })
  // Link the role to NC's own listing page when this application is matched to
  // a board posting; applications NC has no listing for just show plain text.
  const boardLink = (await readStoredLinks([job.id]).catch(() => new Map())).get(job.id)
  const roleUrl = boardLink?.postingId ? `${appUrl}/dashboard/jobs/${boardLink.postingId}?src=email` : null

  const unsubscribeUrl = candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly')

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: `A way in at ${job.companyName}`,
    react: BackchannelMatchEmail({
      firstName: candidate.firstName,
      companyName: job.companyName,
      role: job.role,
      appliedOn: job.appliedAt
        ? job.appliedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : null,
      roleUrl,
      people,
      moreCount: Math.max(0, contacts.length - MAX_LISTED),
      moreUrl: `${appUrl}/dashboard/network/contacts`,
      note,
      why: pickBackchannelStat(sentBefore),
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
    contactIds: listed.map((c) => c.id),
    matchedContactCount: contacts.length,
    contactsWithEmail: listed.filter((c) => c.email).length,
    roleLinkedToListing: Boolean(roleUrl),
    otherCompanyCount,
  })

  return { sent: true as const }
}
