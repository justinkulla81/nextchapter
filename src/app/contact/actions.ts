'use server'

import { headers } from 'next/headers'
import type { ContactAudience } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { captureServerEvent } from '@/lib/posthog/server'
import { fileContactInCrm, emailContactSubmission } from '@/lib/contact/process-submission'
import { CONTACT_EMAIL } from '@/lib/contact/constants'

export interface ContactFormValues { fullName: string; email: string; organization: string; role: string; linkedinUrl: string; message: string }
export type ContactFormState =
  | { error?: string; sent?: boolean; name?: string; email?: string; values?: ContactFormValues }
  | undefined

const AUDIENCES = new Set<ContactAudience>(['CANDIDATE', 'ORGANIZATION', 'COACH_RECRUITER', 'JOB_APPLICANT', 'OTHER'])
const MAX_PER_HOUR_PER_IP = 5

export async function submitContactForm(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const text = (k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

  // A field real people never see. Anything filled in here is a bot: answer
  // as if it worked and store nothing.
  if (text('website', 200)) return { sent: true }

  const audienceRaw = text('audience', 40) as ContactAudience
  const audience: ContactAudience = AUDIENCES.has(audienceRaw) ? audienceRaw : 'OTHER'
  const fullName = text('fullName', 120)
  const email = text('email', 200)
  const organization = text('organization', 160) || null
  const role = text('role', 120) || null
  const linkedinRaw = text('linkedinUrl', 300)
  // "linkedin.com/in/x" typed without a scheme is still a profile link.
  const linkedinUrl = linkedinRaw ? (/^https?:\/\//i.test(linkedinRaw) ? linkedinRaw : `https://${linkedinRaw}`) : null
  const message = text('message', 5000)

  // React resets a form after its action runs; handing the typed values
  // back lets the fields come back filled in when there's an error.
  const values: ContactFormValues = { fullName, email, organization: organization ?? '', role: role ?? '', linkedinUrl: linkedinRaw, message }
  const fail = (error: string): ContactFormState => ({ error, values })

  if (!fullName) return fail('Enter your name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address so we can reply.')
  if (audience === 'ORGANIZATION' && !organization) return fail('Enter your organization’s name.')
  if (audience === 'JOB_APPLICANT' && !(linkedinUrl && /linkedin\.com\//i.test(linkedinUrl))) return fail('Add your LinkedIn profile link, like linkedin.com/in/yourname.')
  if (message.length < 10) return fail('Add a sentence or two about how we can help.')

  const ip = await getClientIp()
  if (ip) {
    const recent = await prisma.contactSubmission.count({
      where: { ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    })
    if (recent >= MAX_PER_HOUR_PER_IP) {
      return fail(`That’s a lot of messages from this network in an hour. Please email ${CONTACT_EMAIL} instead.`)
    }
  }

  const userAgent = (await headers()).get('user-agent')?.slice(0, 300) ?? null
  const sub = await prisma.contactSubmission.create({
    data: { audience, fullName, email, organization, role, linkedinUrl, message, ip, userAgent },
  })

  const crmPersonId = await fileContactInCrm(sub)
  const emailed = await emailContactSubmission(sub, crmPersonId)
  await prisma.contactSubmission.update({
    where: { id: sub.id },
    data: { crmPersonId, emailedAt: emailed ? new Date() : null },
  })

  captureServerEvent(email.toLowerCase(), 'contact_form_submitted', {
    submissionId: sub.id, audience, hasOrganization: !!organization, emailed,
  })

  return { sent: true, name: fullName.split(' ')[0], email }
}
