import 'server-only'
import { Resend } from 'resend'
import type { ContactAudience, ContactSubmission, CrmPersonRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isRealOrgName } from '@/lib/crm/normalize'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { CONTACT_AUDIENCE_SHORT } from '@/lib/contact/constants'

/** Where /contact messages are emailed. Override with CONTACT_FORWARD_TO. */
const FORWARD_TO = process.env.CONTACT_FORWARD_TO || 'justin.kulla@consequentialcapital.com'

const ROLE_FOR: Record<ContactAudience, CrmPersonRole | null> = {
  CANDIDATE: 'JOB_SEEKER',
  COACH_RECRUITER: null, // coach vs recruiter isn't asked; left for a human to tag
  ORGANIZATION: null,
  JOB_APPLICANT: null,
  OTHER: null,
}

/**
 * Files the sender in the CRM: the existing person with this email, or a new
 * one (with their organization, when they gave a real one), plus an inbound
 * note carrying the message so it shows on their record and the Home feed.
 * Never throws — a CRM hiccup must not lose or fail the submission.
 */
export async function fileContactInCrm(sub: ContactSubmission): Promise<string | null> {
  try {
    const email = sub.email.trim().toLowerCase()
    let person = await prisma.crmPerson.findFirst({
      where: { deletedAt: null, OR: [{ email }, { emails: { has: email } }] },
      select: { id: true, roles: true, affiliations: { select: { id: true }, take: 1 } },
    })
    const role = ROLE_FOR[sub.audience]
    if (!person) {
      person = await prisma.crmPerson.create({
        data: {
          fullName: sub.fullName,
          email,
          emails: [email],
          roles: role ? [role] : [],
          linkedinUrl: sub.linkedinUrl,
          // No organization and no role to go on: a human should look.
          needsCompletion: !(sub.organization && isRealOrgName(sub.organization)),
        },
        select: { id: true, roles: true, affiliations: { select: { id: true }, take: 1 } },
      })
    } else if (role && !person.roles.includes(role)) {
      await prisma.crmPerson.update({ where: { id: person.id }, data: { roles: { push: role } } })
    }

    if (sub.organization && isRealOrgName(sub.organization) && person.affiliations.length === 0) {
      const key = normalizeOrgName(sub.organization)
      if (key) {
        const org = await prisma.crmOrganization.upsert({
          where: { canonicalNameNormalized: key },
          create: { name: sub.organization.trim(), canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
          update: {},
        })
        await prisma.crmAffiliation.create({
          data: { personId: person.id, orgId: org.id, title: sub.role?.trim() || '', isPrimary: true },
        })
      }
    }

    await prisma.crmActivity.create({
      data: {
        type: 'NOTE',
        direction: 'INBOUND',
        personId: person.id,
        subject: `Contact form · ${CONTACT_AUDIENCE_SHORT[sub.audience]}`,
        body: sub.message,
        isAutoLogged: true,
        sourceRef: `contact:${sub.id}`,
      },
    })
    return person.id
  } catch (error) {
    console.error('Failed to file contact submission in CRM:', error)
    return null
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Emails the message to the founder; replying goes straight to the sender. */
export async function emailContactSubmission(sub: ContactSubmission, crmPersonId: string | null): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping contact form email.')
    return false
  }
  const rows: [string, string | null][] = [
    ['From', `${sub.fullName} <${sub.email}>`],
    ['Reaching out as', CONTACT_AUDIENCE_SHORT[sub.audience]],
    ['Organization', sub.organization],
    [sub.audience === 'JOB_APPLICANT' ? 'Interested in' : 'Role', sub.role],
    ['LinkedIn', sub.linkedinUrl],
  ]
  const crmLink = crmPersonId ? `https://admin.launchyournextchapter.com/support/admin/crm/people/${crmPersonId}` : null
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0f1b2b;line-height:1.5">
      <p style="margin:0 0 12px;font-size:17px;font-weight:600">New message from launchyournextchapter.com/contact</p>
      <table style="border-collapse:collapse;margin:0 0 16px">
        ${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#55606e">${k}</td><td style="padding:2px 0">${escapeHtml(v!)}</td></tr>`).join('')}
      </table>
      <div style="white-space:pre-wrap;border-left:3px solid #f4a259;padding:4px 0 4px 12px;margin:0 0 16px">${escapeHtml(sub.message)}</div>
      <p style="margin:0;color:#55606e;font-size:13px">Reply to this email to answer ${escapeHtml(sub.fullName.split(' ')[0] || 'them')} directly.${crmLink ? ` <a href="${crmLink}">Open in the CRM</a>.` : ''}</p>
    </div>`
  const text = [
    'New message from launchyournextchapter.com/contact',
    '',
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    '',
    sub.message,
    '',
    crmLink ? `CRM: ${crmLink}` : '',
  ].join('\n')

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: FORWARD_TO,
      replyTo: sub.email,
      subject: sub.audience === 'JOB_APPLICANT'
        ? `Job application: ${sub.fullName}${sub.role ? ` · ${sub.role}` : ''}`
        : `Contact form: ${sub.fullName}${sub.organization ? ` (${sub.organization})` : ''} · ${CONTACT_AUDIENCE_SHORT[sub.audience]}`,
      html,
      text,
    })
    if (error) {
      console.error('Failed to send contact form email:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Failed to send contact form email:', error)
    return false
  }
}
