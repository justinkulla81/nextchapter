'use server'

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { fileContactInCrm, emailContactSubmission } from '@/lib/contact/process-submission'
import { isUndeliverableAddress } from '@/lib/email/resend-client'

// The one-field inquiry at the bottom of every public SEO page, for the organization that runs, hires in or is listed on the page.
// It files exactly what /contact files (a ContactSubmission, the CRM person, the admin email), so the team sees it where it
// already looks. The page it came from goes in `source` as `page:<kind>:<slug>`.

export type OwnerInquiryState = { error?: string; sent?: boolean; email?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCE = /^page:(state|county|city|industry|title|company|college|ranking|topic):[a-z0-9-]{1,70}$/
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'

const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function submitOwnerInquiry(_prev: OwnerInquiryState, formData: FormData): Promise<OwnerInquiryState> {
  if (text(formData, 'website', 200)) return { sent: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email) || isUndeliverableAddress(email)) return { error: 'Enter your work email address.', email }
  const source = SOURCE.test(text(formData, 'source', 90)) ? text(formData, 'source', 90) : null
  const organization = text(formData, 'organization', 160) || null
  const pageLabel = text(formData, 'label', 120)

  if (!(await allowByIp('owner-inquiry', 6, HOUR_MS)) || !(await allowByTarget('owner-inquiry', email, 3, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const userAgent = (await headers()).get('user-agent')?.slice(0, 300) ?? null
    const sub = await prisma.contactSubmission.create({
      data: {
        audience: 'ORGANIZATION',
        // Only the address is asked for; the CRM record is named from it and flagged for a person to complete.
        fullName: email.split('@')[0].slice(0, 120),
        email,
        organization,
        message: `Asked for details from the page ${source ?? 'unknown'}${pageLabel ? ` (${pageLabel})` : ''}. Left only a work email.`,
        source,
        ip,
        userAgent,
      },
    })
    const crmPersonId = await fileContactInCrm(sub)
    const emailed = await emailContactSubmission(sub, crmPersonId)
    await prisma.contactSubmission.update({ where: { id: sub.id }, data: { crmPersonId, emailedAt: emailed ? new Date() : null } })
    captureServerEvent(email, 'owner_inquiry_submitted', { submissionId: sub.id, source, hasOrganization: !!organization, emailed })
    return { sent: true, email }
  } catch (error) {
    console.error('owner inquiry failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
